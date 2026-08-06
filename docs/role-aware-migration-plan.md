# Role-Aware Marketplace Migration Plan

## Status

Approved for staged implementation. Phase 0 planning artifacts, Phase 1
additive schema, Phase 2 compatibility backfill/server-state exposure, and
Phase 3 authorization hardening are implemented and verified. Signup/onboarding
UI and active-role switching remain future phases.

The following remain intentionally unchanged:

- `users.role`
- JWT claims (claims remain unchanged, but authorization now confirms them
  against database state)
- signup and login flows
- OpenAPI contracts and generated clients
- client, provider, and admin behavior
- booking, review, care-history, notification, and provider workflows
- Stripe, payouts, connected accounts, and payment onboarding

The uploaded approval requires each phase to remain independently reviewable.
Removing `users.role`, requiring re-registration, automatically granting
provider roles, and granting provider access from signup intent are not approved.

## Target data model

### `account_roles`

`account_roles` is the long-term role-membership source for one account holding
one or more roles:

```text
user → client
user → provider
user → admin
```

The `(user_id, role)` pair is unique. Existing `users.role` remains as a
compatibility field until a separate cleanup checkpoint is explicitly approved.
No secondary roles are added automatically during backfill.

Role membership alone is not sufficient for provider operations. Provider
operations require an approved, same-user/same-profile application, an
approved provider profile, and an active user.

### `provider_applications`

`provider_applications` separates provider onboarding/review state from provider
business data and authorization:

```text
draft
under_review
approved
rejected
suspended
```

There is one current application per user and one current application per
provider profile. The table stores the current onboarding step, submission/review
timestamps, reviewer identity, and reviewer notes. It does not store passwords,
tokens, care notes, or document contents.

The existing `provider_profiles.verification_status` remains unchanged by the
compatibility migration and is now required to be `approved` for provider
operations alongside the approved application state.

Provider application events are deferred. The current project has no established
audit-event table or event-retention convention, and the approval says events
are optional when existing audit requirements do not justify them.

## Phase 1 schema decisions

- Additive PostgreSQL enums and tables only.
- Foreign keys cascade when the owning user/profile is deleted.
- Reviewer ownership uses `ON DELETE SET NULL`.
- Unique constraints prevent duplicate role memberships and applications.
- Timestamps support later audit and reconciliation work.
- Phase 1 intentionally had no runtime consumers; Phase 2/3 now read the new
  tables for response state and authorization.
- No API contract changes are included in this checkpoint.

## Development preflight

Run these checks before applying or backfilling the schema:

```sql
SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;

SELECT COUNT(*) AS users_total,
       COUNT(*) FILTER (WHERE role IS NULL) AS users_null_role
FROM users;

SELECT verification_status, COUNT(*)
FROM provider_profiles
GROUP BY verification_status
ORDER BY verification_status;

SELECT COUNT(*)
FROM provider_profiles pp
LEFT JOIN users u ON u.id = pp.user_id
WHERE u.id IS NULL;

SELECT COUNT(*)
FROM users u
LEFT JOIN provider_profiles pp ON pp.user_id = u.id
WHERE u.role = 'provider' AND pp.id IS NULL;

SELECT COUNT(*)
FROM (
  SELECT user_id FROM provider_profiles
  GROUP BY user_id
  HAVING COUNT(*) > 1
) duplicate_profiles;

SELECT COUNT(*)
FROM (
  SELECT email FROM users
  GROUP BY email
  HAVING COUNT(*) > 1
) duplicate_emails;
```

The development preflight for this checkpoint passed with:

| Check | Result |
|---|---:|
| Client users | 2 |
| Provider users | 2 |
| Admin users | 1 |
| Users with null role | 0 |
| Approved provider profiles | 2 |
| Orphan provider profiles | 0 |
| Provider users without profile | 0 |
| Duplicate provider profiles | 0 |
| Duplicate emails | 0 |

If a future preflight finds null, orphaned, duplicate, or inconsistent data,
stop before backfill. Never map invalid data to provider or admin access.

## Backfill procedure for the next checkpoint

The repository command `pnpm --filter @workspace/api-server run
backfill:role-state` runs the backfill transactionally after a fresh preflight.
It is idempotent and safe to rerun. The current development run inserted five
role memberships and two provider applications on the first run, then zero
rows on the second run.

```text
users.role = client   → one account_roles(client) row
users.role = provider → one account_roles(provider) row
users.role = admin    → one account_roles(admin) row
```

Use conflict-safe inserts so the operation can be rerun. Do not add a client
role to existing providers or a provider role to existing clients.

Provider application mapping must be explicit:

```text
approved     → approved
under_review → under_review
rejected     → rejected
pending      → draft or under_review only after a document/submission rule
               is approved
```

Existing approved providers must remain approved and must not be forced through
new onboarding. A provider user without a profile should be quarantined as a
draft/incomplete case rather than receiving operational access.

## Phase 2 compatibility response state

`POST /auth/register`, `POST /auth/login`, and `GET /auth/me` retain the legacy
scalar `user.role` and token claim while adding:

- `roles`: persisted role memberships, with the legacy role as a compatibility
  fallback if a membership row is temporarily missing;
- `activeRole`: the current legacy role context, not a new authorization grant;
- `onboarding`: client completion and provider application status;
- `providerApplication`: safe status/step/timestamp projection without reviewer
  notes or document contents.

This state is read-only in Phases 2/3. No active-role switch, provider approval
mutation, signup UI, or token-claim change is included.

## Phase 3 authorization hardening

`requireAuth` verifies the JWT and loads the current user, active status, role
memberships, and owned provider application/profile state from PostgreSQL.
`requireRole` requires a matching `account_roles` row; it does not authorize
from the JWT role alone.

Operational provider routes additionally require:

1. provider membership;
2. an application owned by the authenticated user;
3. that application's profile to be owned by the same user;
4. application status `approved`; and
5. provider-profile verification status `approved`.

Provider portal profile/services/availability/travel-zone/earnings routes,
provider booking access/status transitions, provider invoice access, and the
provider notification stream use this gate. Credential document submission
remains available to provider members as the onboarding path to review.

Admin routes retain the same database-backed membership requirement. Removing a
membership immediately denies the corresponding role while leaving the
compatibility JWT unchanged.

## Rollback and deployment sequencing

The additive schema is designed to be reversible before any application code
depends on it:

1. Snapshot the development database before applying the schema.
2. Run the preflight report.
3. Apply the additive schema through the repository's Drizzle development
   workflow.
4. Verify table, enum, foreign-key, and unique-constraint metadata.
5. Do not remove or rewrite existing columns.
6. If verification fails, restore the development checkpoint before proceeding.

For production, do not run direct DDL or custom production migration scripts.
Replit applies the development schema to production through the Publish flow.
The additive tables should be published only after the development checkpoint
is verified and the user reviews the publish diff.

No runtime deployment should require the new tables until a later phase has
dual-read/dual-write behavior and its own rollback plan.

## Open decisions retained

- Whether users may actively switch between client and provider contexts.
- Whether provider role addition needs admin review before draft creation.
- Required provider fields before submission.
- Rejected application resubmission rules.
- Whether approved providers may also book as clients.
- Whether the client landing route is `/discover` or `/client/dashboard`.
- Email/phone verification requirements.
- Whether provider application events become necessary.
- When the compatibility `users.role` field may be removed.

## Verification for this checkpoint

Required before committing:

```bash
pnpm --filter @workspace/db run typecheck
pnpm --filter @workspace/db run push
pnpm run typecheck
pnpm run build
```

Also verify:

- Existing API workflow remains healthy.
- Existing auth behavior is unchanged.
- Existing booking/review/care-history/concurrency suites remain unchanged.
- New tables exist with expected constraints.
- No generated API files changed.
- No signup, middleware, route, or frontend files changed.