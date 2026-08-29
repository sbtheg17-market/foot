# Canonical Prototype and Isolated Client Instance Model

**Added:** 2026-08-29 (branch `docs/canonical-instance-operating-model`).
**Status:** authoritative operating model. Docs-only; no runtime behavior,
schema, deployment, or account was changed by this document.
**Companion runbook:** `docs/instance-provisioning-checklist.md`.

This document exists so that every future agent, operator, and contributor
understands the deliberate long-term operating model of this project and never
confuses the prototype with a shared production marketplace, one client
instance with another, canonical source changes with provider-instance
configuration, deployment metadata with secrets, local pilot data with real
provider/client data, or vertical-specific customization with changes to core
scheduling, privacy, authorization, or booking logic.

---

## A. Decision statement

```text
OnCall Foot is the canonical prototype.
It is not a shared customer database or a source of real customer-instance data.

Future provider deployments are isolated, single-provider/client instances.
Each instance has separate GitHub, Railway, Supabase, data, credentials,
billing, backup responsibility, and deployment history.
```

Expressed as the standing formula:

```text
One client/provider instance
= one GitHub account/repository
+ one Railway account/project
+ one Supabase project/database
+ one deployment configuration
+ one private client dataset
+ one tracked release/migration/backup record
```

- **Canonical repository:** `sbtheg17-market/foot`
- **Canonical prototype instance:** OnCall Foot

This is a **deliberate early operating model**, chosen for data isolation,
provider ownership, and low blast radius at small scale. It is **not** an
accidental fork strategy, and it is **not** a request to build multi-tenancy.
Future agents must not "helpfully" consolidate instances into one database,
one GitHub organization, one Railway project, or one runtime environment.

The canonical repository is where generalizable, tested, security-sensitive,
privacy-sensitive, scheduling-sensitive, and conversion-sensitive improvements
are developed first. Canonical core behavior includes: authentication and role
boundaries; the provider application/verification lifecycle; server-derived
readiness and next actions; the provider dashboard; services; availability;
travel/territory logic; Emergency Openings; Time Off/Vacation Ranges; public
booking pages; booking/rescheduling/cancellation rules; privacy safeguards;
API contracts; schema/migration policy; and the tests, CI, Graphify, and
operational docs that protect all of the above.

### Product vision preserved

Foot's core promise, which every instance must deliver:

```text
A provider receives a dedicated business hub:
their services,
their territory,
their availability,
their schedule exceptions,
their booking page,
their clients,
their booking rules,
their public sharing link,
and their daily operational guidance.
```

OnCall Foot is the first prototype, initially framed around mobile foot care.
The long-term model may serve providers in many local, mobile,
appointment-based, or online service markets — for example (illustrative only,
never hard-coded): mobile care, wellness, beauty, fitness, home services,
coaching, consulting, education, local repair, professional appointments,
remote service sessions.

The product must remain intuitive:

```text
A provider can join, return, understand the next step,
become bookable, share one professional link,
protect their real schedule, and serve clients without chaos.
```

Conversion and provider comfort matter more than speculative feature count.
No fake urgency. No lead guarantees. No hidden ranking. No misleading claims.
No cross-client data leakage. No assumption that all providers belong in one
shared database.

---

## B. Why isolated instances

### Benefits

- **Provider/client data isolation.** One provider's clients, bookings, notes,
  and schedule live in one database owned by that instance. A defect, breach,
  query mistake, or migration error in one instance cannot leak or corrupt
  another provider's data.
- **Simple local service territory and travel rules.** Each instance serves
  one provider's real territory; no cross-provider ranking, routing, or
  marketplace arbitration logic is needed.
- **Low blast radius.** A bad deploy, an expired trial, a billing lapse, or a
  broken migration affects exactly one provider, not the whole platform.
- **Vertical-specific presentation/configuration.** Vocabulary, branding,
  service templates, and policy copy can fit the provider's market without
  forking core logic.
- **Provider ownership story.** "This is *your* business hub, *your* data,
  *your* link" is literally true — a strong, honest conversion message.
- **Independent provider billing/domain/deployment potential.** Each provider
  can own their accounts, custom domain, and hosting costs, and can leave with
  their data.
- **Controlled pilot experimentation.** New verticals or copy experiments can
  run in one instance without risking the canonical prototype or any other
  provider.

### Tradeoffs (accepted knowingly, reviewed at scale thresholds)

- **Update burden.** Every canonical improvement must be rolled out per
  instance; instances can lag releases.
- **Security patch propagation.** A security fix is not done until every
  instance runs it; the registry must track deployed versions.
- **Schema migration drift.** Each instance has its own migration ledger;
  drift between instances must be tracked and reconciled deliberately.
- **Backup/recovery burden.** Each instance needs its own verified
  backup/export procedure and evidence — nobody else's backup covers it.
- **Separate billing/trial expiry.** Each GitHub/Railway/Supabase account has
  its own billing state; a lapsed account can silently take an instance down.
- **Domain/DNS/support workload.** Domains, TLS, DNS ownership, and support
  access are per instance.
- **Possible operational unsustainability at high instance count.** See the
  scaling thresholds in section I; beyond them, this model must be re-assessed
  honestly rather than defended by default.

---

## C. Canonical core vs. instance configuration

The single most important boundary for future agents. When in doubt, treat a
change as canonical core (develop and test it in `sbtheg17-market/foot`
first).

| Canonical core behavior | Per-instance configuration | Never store/configure casually |
|---|---|---|
| Auth and authorization (roles, `requireAuth`/`requireRole`, `requireApprovedProvider` gate) | Business display name | Authorization behavior |
| Booking state machine (`booking-state-machine.ts`) and lifecycle rules | Vertical vocabulary (service-type wording) | Secret/JWT signing configuration |
| Rescheduling policy (consent-first proposals, client direct reschedule) | Public branding/colors/logo | Database migration history |
| Privacy rules (privacy-safe public payloads, no cross-client leakage) | Region/timezone | Booking/rescheduling core logic |
| Schema/migration discipline (frozen additive artifacts, Gate B) | Support contact | Privacy/retention policy |
| API contracts (OpenAPI spec, generated clients) | Public booking-page copy | Approval gate semantics |
| Security fixes | Service examples/categories | Source-of-truth readiness logic (`activation-status` derivation) |
| Travel/availability calculation rules (`generateEffectiveSlotsForDate`, travel buffers) | Service territory labels | Raw database schema |
| Provider/client role boundaries | Local policy copy where legally reviewed | Protected API routes |
| Test suites and CI (16-job pipeline) | Domain/subdomain | — |
| — | Provider-owned services, availability, territory, and schedule exceptions (runtime data, entered by the provider) | — |

Rules of use:

- **Canonical core** changes land in `sbtheg17-market/foot` via tested PR/CI,
  then reach instances as versioned releases (section G). Instances never
  patch core behavior locally.
- **Per-instance configuration** is data, environment configuration, or
  clearly designated presentation values. It must never require editing core
  logic, schema, or protected routes.
- **Never casually vary** means: any difference between instances in these
  areas is a release-gated, explicitly authorized, individually recorded event
  — never a quiet per-instance tweak.

Every proposed broad change is first classified as one of:

1. **Generalizable core improvement** → canonical repo, tested, released.
2. **Safe instance configuration** → registry-recorded configuration change.
3. **Truly bespoke customization** → explicit maintenance-cost and
   version-divergence decision, recorded per instance, owner-approved.

Do not let instances "evolve freely."

---

## D. Account ownership model

Three possible models per instance:

| Model | Description | Implications |
|---|---|---|
| **Platform-managed** | The platform operator owns the GitHub/Railway/Supabase accounts and billing; the provider is a user of the hosted instance. | Fastest provisioning and upgrades; operator carries billing/recovery/uptime burden; weaker provider-ownership story. |
| **Provider-owned** | The provider owns the accounts and billing; the platform operator has documented support access. | Strongest ownership story and clean offboarding; requires documented admin access, recovery paths, and upgrade authorization. |
| **Shared-admin** | Joint access; both operator and provider hold admin credentials on the same accounts. | Ambiguous ownership and recovery; acceptable only as a documented transition state, not a steady state. |

**Recommended early model:**

```text
Provider-owned accounts with documented platform-admin support access,
recovery process, and explicit upgrade/migration authorization.
```

### Questions that must be answered before provisioning any instance

Record the answers (labels only, never credentials) in the instance registry:

- Who pays GitHub/Railway/Supabase costs?
- Who owns domain registration?
- Who owns the provider/client data?
- Who is the account recovery contact?
- Who can approve migration/deployments?
- Who receives billing or uptime alerts?
- What happens on offboarding?
- What access is revoked after offboarding?

No instance may be provisioned while any of these is unanswered.

---

## E. Instance registry specification

The owner intends to track instance metadata in a Google Sheet initially. The
registry holds **non-secret operational metadata only** — labels, names,
dates, versions, and statuses.

Suggested columns:

```text
instance_id
business_display_name
vertical
region
timezone
instance_status
provider_owner_contact_label
technical_operator_label
github_account_label
github_repo_name
canonical_release_tag
deployed_commit_sha
railway_account_label
railway_project_label
railway_environment_label
supabase_project_label
database_schema_version
latest_migration_artifact
latest_migration_date
backup_method
backup_verified_date
last_restore_test_date
domain_label
dns_owner_label
billing_owner_label
last_smoke_test_date
open_blocker_count
support_tier
offboarding_status
```

Hard boundary:

```text
The registry must not contain passwords, access tokens, connection URLs,
API keys, JWT secrets, recovery codes, provider/client PII, booking data,
health/care information, or payment credentials.
```

"Label" columns mean human-readable identifiers ("Provider A — owner",
"Railway project: instance-a-prod"), never emails-as-credentials, account IDs
that function as secrets, or connection details. Secrets live only in a
password manager or the native platform secret manager (GitHub encrypted
secrets, Railway service variables, Supabase project settings) — never in
Git, Graphify, documents, Google Sheets, screenshots, tickets, or chat.

---

## F. Provisioning lifecycle

Repeatable lifecycle for every new instance (checklist form in
`docs/instance-provisioning-checklist.md`):

```text
1. Select a tested canonical release tag/SHA.
2. Create a new isolated repository from the approved template/release.
3. Create a separate Railway project and app service.
4. Create a separate Supabase project/database.
5. Configure secrets privately in native secret managers.
6. Apply only approved, hash-verified migrations.
7. Record migration status in the instance registry.
8. Configure approved business/vertical branding and terminology.
9. Configure domain/subdomain.
10. Run isolated provider-client smoke protocol.
11. Record release/version/test evidence.
12. Hand over controlled provider access.
```

Explicit readiness rule:

```text
No instance may be marked ready until backup/export,
migration, smoke-test, and domain/ownership checks are recorded.
```

Notes:

- Step 1 always starts from a **tested, tagged canonical release** — never
  from an arbitrary working-tree state or an unmerged branch. GitHub's
  template-repository / release-archive mechanisms fit this step.
- Step 6 uses the same frozen-artifact discipline as the canonical repo
  (`docs/migrations/*.sql`, additive-only, hash-verified, applied once through
  the documented gate — see `docs/managed-db-release-gate.md`).
- Step 10 reuses the provider–client journey protocol
  (`docs/pilot/provider-client-journey-validation.md`) with **fresh, seeded
  demonstration accounts only** — never real provider/client data and never
  another instance's data.

---

## G. Update and release model

```text
Canonical core change
→ tested PR/CI in canonical repository
→ versioned release tag/SHA
→ staged instance upgrade
→ per-instance preflight
→ approved migration if needed
→ deployment
→ provider-client smoke test
→ instance registry update
```

- Instances upgrade to **releases**, not to `main` tip and not to cherry-picked
  commits.
- Security fixes are release-tagged with priority and rolled out to every
  instance; the registry's `deployed_commit_sha` /
  `canonical_release_tag` columns make lag visible.
- "Let each fork evolve freely" is explicitly **not** the model. Divergence is
  a recorded, owner-approved exception (section C classification 3), never a
  default.
- App deployment and database migration are separate steps with separate
  approvals (section H).

---

## H. Backup, migration, and recovery model

Actual stack per instance:

```text
Application hosting: Railway
Database: Supabase
Source: GitHub
```

Rules (aligned with `docs/managed-db-release-gate.md` and
`docs/backup-restore-runbook.md`, which remain authoritative for gate
procedure):

- **Supabase Free may not provide project backups/PITR.** Never assume managed
  backup coverage exists for an instance. Verify the actual plan and backup
  capability for that specific instance before relying on it; do not claim any
  vendor plan feature or backup guarantee unless it is verified for that
  instance.
- **Each instance needs a documented backup/export procedure before any schema
  change.** For free-tier or unverified-backup instances, this means a regular
  private logical export (e.g. `pg_dump`-class logical backup) with a recorded
  `backup_method` and `backup_verified_date` in the registry.
- **A fresh private logical backup/export must exist before migration** when
  managed backups are unavailable. No backup evidence → no DDL.
- **Backups must never be committed to Git or attached to Graphify.** They
  contain client data; they live only in the instance owner's approved private
  storage.
- **Database migration artifacts remain frozen, additive, hash-verified, and
  applied only through a documented release gate.** The canonical
  `docs/migrations/*.sql` discipline applies to every instance; each instance
  keeps its own migration ledger (registry columns
  `database_schema_version`, `latest_migration_artifact`,
  `latest_migration_date`).
- **App deployment must be separate from database migration.** Startup-time
  schema push is prohibited on every instance, exactly as on the canonical
  prototype (`docs/deployment-notes.md`).
- **Production/provider data must never be used in local test fixtures**, in
  the canonical repo, in another instance, or in demo material.
- **Restore verification should be performed on a disposable target** before
  relying on a backup process at scale; record `last_restore_test_date` per
  instance.

---

## I. Scaling thresholds

Operational review thresholds — **not** hard technical limits:

```text
1 instance:
Manual checklist acceptable.

2–5 instances:
Use registry, release tags, backup proof, and repeatable smoke scripts.

6–20 instances:
Standardize provisioning, upgrade checklist, monitoring, and support access.

21–40 instances:
Assess automation, support load, backup verification, and release cadence.

Beyond 40 instances:
Reassess whether isolated account-per-provider operation remains profitable,
secure, upgradeable, and supportable versus a controlled shared platform.
```

At each threshold the owner reviews: upgrade lag across instances, backup
verification coverage, security-patch propagation time, support workload,
per-instance cost, and billing/account health. Crossing a threshold without
that review is an operational defect.

---

## J. Cross-vertical guardrails

The underlying model stays **vertical-neutral**. The canonical vocabulary is:

```text
provider
client
service
service territory
availability
schedule exception
booking page
appointment
application
readiness
next action
```

Vertical changes should primarily be vocabulary, configuration, branding,
service templates, policy copy, and market positioning — **not** changes to
core security, booking, privacy, or schedule behavior. Do not hard-code a new
vertical into canonical code; example verticals in this document are
illustrative only.

---

## K. Future marketing/context (context only — not authorized work)

- Each instance can be positioned as a provider's **dedicated business hub**.
- Social posts, direct outreach, local partners, QR handouts, and short-form
  videos should direct prospects to an honest working experience.
- Marketing must not promise leads, bookings, approval, or capabilities that
  are not implemented.
- Seeded demonstration data only; never use real provider/client data in
  demos, screenshots, or videos.
- Public page SEO is a future dedicated task and must preserve
  crawlable/provider-safe content.

---

## L. Explicit non-goals

This document does **not** authorize:

- bulk account provisioning;
- moving to Railway PostgreSQL;
- switching away from Supabase;
- multi-tenancy;
- copying client/provider production data;
- mass forking;
- production migrations;
- deployment changes;
- marketing automation;
- any secret handling.

Any of the above requires its own explicitly scoped, owner-approved task.

---

## Sequencing rule (before the first real instance)

Prove the canonical OnCall Foot production path **once** before replicating it
across separate GitHub/Railway/Supabase client environments:

1. Create and verify a private Supabase logical backup/export.
2. Confirm OnCall Foot's actual Supabase project identity and ownership.
3. Apply only the missing frozen Gate-B migrations.
4. Verify schema metadata.
5. Deploy the approved canonical `main` on Railway.
6. Re-run the exact provider-client pilot protocol in production using fresh
   test accounts.
7. Fix any production-only blocker or high-severity finding.
8. Only then provision the first real isolated client instance using
   `docs/instance-provisioning-checklist.md`.
