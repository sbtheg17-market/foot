# Provider Verification Onboarding — Policy and Recovery Record

**Added:** 2026-08-28 (branch `fix/provider-onboarding-verification-flow`).
**Scope:** provider onboarding and verification-document submission only.

## What a verification "document" is

A **credential reference**, not a file: a license number, issuing body, URL,
or document identifier the admin team can verify (e.g. "License #RPN-12345,
College of Nurses"). There are **no uploads, no OCR, no storage buckets, and
no external verification vendors** — explicitly out of scope. The team
contacts the provider if originals are needed.

## Contract and bounds (server-authoritative)

`POST /api/providers/me/verification` (provider session required):

| Field | Rule |
|---|---|
| `docType` | required; one of `license`, `insurance`, `certification`, `other` |
| `fileName` | required; trimmed; 3–200 characters (the credential reference) |
| `notes` | optional; trimmed; ≤ 1000 characters (context for the reviewer) |

Responses: `201 {doc}` on success (also for an idempotent replay), `400` with
a field-specific client-safe message, `401` unauthenticated, `403`
non-provider, `404` no provider profile. Raw SQL/ORM details are never
returned; unexpected failures are the generic safe error contract.

## The 2026-08-28 root cause (fixed)

Both `/providers/me/verification` routes resolved the caller's profile with
`getOwnProfile()`, whose bare Drizzle `select()` emits **every** schema
column of `provider_profiles` — including the Gate B-pending booking-page
columns from `docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql`
(`public_slug`, `booking_page_published`, `booking_page_published_at`). On a
database where those frozen artifacts are not applied yet, PostgreSQL raised
42703 (`column "public_slug" does not exist`), the exception was unhandled,
and the provider saw a generic "Internal server error" — **before any
validation or persistence** (no record was ever written; no orphans existed).

The fix mirrors the PR #56 provider-signup convention: the verification flow
now reads only the signup-era columns it needs (`id`,
`verification_status`), so it works on both current and pre-Gate-B schemas.

## Submission semantics

- One transaction per submission: the provider profile row is locked
  (`SELECT … FOR UPDATE`) to serialize double-taps/retries; an identical
  *pending* submission (same provider + type + reference) returns the
  existing record instead of creating a duplicate; the insert and the
  `pending → under_review` auto-advance commit or roll back together.
- Rejected documents do not block resubmission: submitting the same
  reference again after a rejection creates a fresh `pending` record, and the
  full history is preserved for review.
- Review states are unchanged: docs are `pending | approved | rejected`;
  overall profile verification is `pending | under_review | approved |
  rejected` and only admin review advances it beyond `under_review`.
  Submitting a document never implies approval or public bookability.

## Privacy boundary

Document references and reviewer notes are **sensitive internal review
data**: visible to the owning provider and admins only; never on public
booking pages, never to clients or other providers; never written to logs.
Admin access follows the existing `requireAuth + requireRole("admin")`
patterns (`/admin/verification/*`).

## Schema / migration decision

- **No schema change was required for the fix** (no new unique index —
  duplicate safety is transactional, so no Gate B action is needed for it).
- The onboarding schema audit found one frozen-artifact gap:
  `provider_applications.rejection_reason` is schema-defined and selected by
  the `/providers/application*` routes but had **no frozen artifact**. Added:
  `docs/migrations/PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` (additive
  only, one nullable text column, no `IF NOT EXISTS` per gate policy).
  Disposable-PG checks: `db:push` ×2 idempotent, seed ×2, fresh apply PASS,
  re-apply fails loudly (expected), column type/nullability matches schema.
- **Managed database: NOT ACCESSED.** All artifacts remain Gate B-pending and
  are never auto-applied. Production deployment: not performed.

## Discovered follow-up (documented, intentionally not implemented here)

~24 other authenticated `/providers/me/*` portal routes (services,
availability, travel zones, service-area config, listing preview,
booking-page management, …) still resolve the profile via the bare-select
`getOwnProfile()` and would 500 on a pre-Gate-B database for an *approved*
provider. The booking-page routes legitimately require the #11 artifact;
the rest could adopt narrow selects in a follow-up. Recorded in
`docs/TODO-LEDGER.md`; deliberately out of scope for this focused recovery.

## Retry / error behavior (client)

Web onboarding + portal credentials + Expo onboarding all: keep entered
values after any failure, disable submit while pending, guard double-taps,
show field-specific 400 copy, and show the safe recoverable-failure copy
("We couldn't submit this document right now. Your information has not been
lost. Please try again or contact support.") with the support contact link
for 5xx/network failures. The literal "Internal server error" string is
never rendered.

## Mobile validation (2026-08-28)

- Repo emulation suite: `pnpm run smoke:mobile-emulation` — 9/9 PASS
  (iPhone 13 WebKit + Pixel 5 Chromium incl. 3G throttle).
- Real-browser smoke: 13/13 PASS.
- Targeted Pixel 5-viewport E2E of the exact reported journey (signup →
  onboarding → verification submit → success copy) — PASS on the current
  schema **and** under the Gate B drift simulation.
- Real hardware verification remains DEFERRED (unchanged;
  `docs/native-device-checklist.md`).

## Tests

`pnpm --filter @workspace/api-server run test:verification` (13 tests,
CI-gated): every doc type, notes handling, bounds/validation (nothing
persisted on 400), authz denials + cross-provider isolation, duplicate +
4-way concurrent idempotency, forced-failure rollback (+ safe 500 contract) +
retry, drift simulation, onboarding progression. Web: 11 new
`provider-verification-step` tests incl. axe scans (147 web tests total).

## Stable-vs-optional column selection rule (2026-08-28)

The drift-safe convention introduced for the verification flow
(`getOwnVerificationProfile`: select exactly the signup-era columns a read
needs) is now also the contract for the owner status/activation reads
(`getOwnApplication`, `getOwnActivationProfile` in `routes/providers.ts`):
signup-era columns are the required set; Gate B-pending additive columns are
attempted eagerly and degraded to their backfill-free defaults on
`42703`/`42P01` (via `isSchemaDriftError`), never fabricating approval or
readiness. This keeps a provider's first return truthful on a database whose
frozen additive artifacts have not been applied yet. Regression guard:
`test:return-path-drift`. See
`docs/provider-onboarding-return-path-reliability-plan.md`.
