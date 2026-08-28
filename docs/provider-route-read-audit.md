# Provider Route Read Audit & Schema-Drift Safety Hardening

**Date:** 2026-08-28 · **Baseline `origin/main`:** `8aeb19cd1b5cfabdafc0a66920b03e8194505836`
**Branch:** `fix/provider-route-read-drift-audit`

## 1. Why this audit exists

PR #69 (`fix: restore provider application status after re-login`) proved the
historical failure pattern on the provider status hub:

```text
Broad or unnecessary read selects an optional additive Gate-B column
→ deployed DB lacks that column (startup never pushes schema)
→ PostgreSQL 42703 (undefined_column) / 42P01 (undefined_table)
→ API 500
→ provider sees a generic error
```

PR #69 hardened only the first-login/application-status path
(`getOwnApplication`, `getOwnActivationProfile`, `getOwnVerificationProfile`,
the activation-hub service-area probe). This audit reviews the **adjacent
provider-owned read paths** against the same drift class and fixes only the
additional, source-proven vulnerabilities.

## 2. Drift surface audited (Gate B-pending additive artifacts)

The frozen, not-yet-applied artifacts (`docs/managed-db-release-gate.md`,
ten-artifact inventory at `98a1811`) add the following objects that a drifted
deployed database may lack. Optional columns/relations relevant to
provider-owned reads:

| Artifact | Optional objects read by provider surfaces |
|---|---|
| `PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` | `provider_applications.rejection_reason` |
| `PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql` | `provider_profiles.public_slug`, `provider_profiles.booking_page_published`, `provider_profiles.booking_page_published_at`, `bookings.source` |
| `PROVIDER_SERVICE_AREAS_V1.sql` | `provider_service_areas`, `provider_coverage_areas` (tables) |
| `PROVIDER_EMERGENCY_OPENINGS_V1.sql` | `provider_emergency_openings` (table) |
| `PROVIDER_BLOCKED_RANGES_V1.sql` | `provider_blocked_ranges` (table) |
| `CANCELLATION_NO_SHOW_SUPPORT_V1.sql` | `booking_outcome_history` (table), `bookings.cancellation_category`, `bookings.no_show_marked_by`, `bookings.no_show_marked_at`, `support_tickets.booking_id` |
| `RESCHEDULE_PROPOSALS_HISTORY_V1.sql` | `booking_reschedule_proposals`, `booking_reschedule_history` (tables) |
| `PILOT_PROVIDER_RETENTION_V1.sql`, `PREVENTED_BOOKING_RECORDS_V1.sql`, `PREVENTED_BOOKINGS_DAILY_V1.sql` | admin/analytics relations only — no provider-owned read touches them |

The three fields named in the task scope
(`provider_applications.rejection_reason`, `provider_profiles.public_slug`,
`provider_profiles.booking_page_published`) are the PR #69 set; the audit
covers them plus every other pending additive object a provider-owned read
can touch.

## 3. Stable read-selection rule

The repository-wide contract (extends the PR #69 convention, now shared via
`artifacts/api-server/src/lib/schema-drift.ts`):

1. **Stable signup-era columns are the required read set.** Gate B-pending
   additive columns are *optional* for reads.
2. **Eager select first.** Migrated databases take the exact original query —
   behavior and bytes unchanged.
3. **Degrade only on proven drift.** Fallback runs only when
   `isSchemaDriftError` finds `42703`/`42P01` in the Drizzle `cause` chain,
   and re-reads an explicit stable projection.
4. **Degraded values are the backfill-free defaults** the migration itself
   would produce (`null`, `false`, empty list, unconfigured) — the truthful
   pre-artifact state. Never fabricated approval, readiness, publication, or
   ownership.
5. **Reads degrade; writes fail loudly.** A write that requires an absent
   column/relation keeps returning its loud error — no invented success.
6. **Auth is never masked.** 401/403/404, approval gating, and non-leaking
   ownership semantics are identical on migrated and drifted databases.
7. **No broad catch/ignore.** Any error that is not schema drift is
   re-thrown unchanged.
8. Selects inside an open transaction wrap the eager attempt in a
   **savepoint** (`tx.transaction`) so a drift error cannot abort the caller's
   transaction before the stable fallback runs (`loadOwnedBooking`,
   reschedule-requests list).

## 4. Evidence table — provider-owned routes and shared helpers

Legend: **Decision** = HARDENED #69 (already fixed by PR #69, untouched),
HARDENED (this audit), UNCHANGED (reviewed, no fix needed/allowed).

| Route/helper | Provider surface | Auth/ownership | Columns read | Optional Gate-B columns? | Needed by response? | Drift behavior (before → after) | Risk | Decision |
|---|---|---|---|---|---|---|---|---|
| `getOwnApplication` (helper, 17 call sites) | application/status/onboarding | owner (userId) | stable app set + eager `rejection_reason`, submissions | `rejection_reason` | optional | degrades: `rejectionReason: null`, empty history (since #69) | was 500 pre-#69 | SAFE — HARDENED #69 |
| `getOwnActivationProfile` (helper) | activation hub | owner | narrow booking-page projection | `public_slug`, `booking_page_published(_at)` | optional | degrades: unpublished/no slug (since #69) | was 500 pre-#69 | SAFE — HARDENED #69 |
| `getOwnVerificationProfile` (helper) | verification flow | owner | narrow stable projection | none required | — | unaffected (since #69) | none | SAFE — HARDENED #69 |
| `getOwnProfile` (shared helper, ~30 owner routes) | profile/settings, services, availability, travel zones, earnings, booking-page, openings/ranges guards | owner | **bare `select()`** on `provider_profiles` | `public_slug`, `booking_page_published(_at)` | not needed by most callers | **was: 42703 → 500 on every caller** → now eager-first, stable fallback + truthful unpublished defaults | VULNERABLE | **HARDENED** |
| `GET /providers/me` | profile/settings | owner, approved | via `getOwnProfile` | inherited | no | 500 → 200 truthful | VULNERABLE | **HARDENED** (via helper) |
| `GET /providers/me/services`, `PUT/POST/DELETE` guards | services | owner, approved | `getOwnProfile` + `services` (stable) | inherited only | no | 500 → 200 | VULNERABLE (read gate) | **HARDENED** (via helper) |
| `GET /providers/me/availability` (+ write guards) | weekly availability | owner, approved | `getOwnProfile` + `availability` (stable) | inherited only | no | 500 → 200 | VULNERABLE (read gate) | **HARDENED** (via helper) |
| `GET /providers/me/travel-zones` | service area/travel | owner, approved | `getOwnProfile` + `travel_zones` (original table) | inherited only | no | 500 → 200 | VULNERABLE (read gate) | **HARDENED** (via helper) |
| `GET /providers/me/earnings`, `/earnings/export` | earnings | owner, approved | `getOwnProfile` + explicit `invoices`/`bookings`/`users` projections (stable columns) | inherited only | no | 500 → 200 | VULNERABLE (read gate) | **HARDENED** (via helper) |
| `GET /providers/me/listing-preview` | booking-page preview/share | owner (any member) | `getOwnProfile` + explicit stable projections (`users`, `provider_applications.status`, `services`, `availability`) | inherited only | no | 500 → 200 | VULNERABLE (read gate) | **HARDENED** (via helper) |
| `GET /providers/me/booking-page` | booking-page config/share/QR/print state | owner (any member) | `getOwnProfile` + coverage probe | `public_slug`, `booking_page_published(_at)`, service-area tables | optional | 500 → 200 truthful unpublished/ineligible | VULNERABLE | **HARDENED** |
| `hasActiveServiceAreaCoverage` (helper: booking-page GET/publish/unpublish, activation hub) | booking-page eligibility | owner | `loadProviderCoverage` (service-area tables) | whole tables | optional | **was: 42P01 → 500** → `false` (truthful pre-#12 unconfigured) | VULNERABLE | **HARDENED** |
| `buildOwnServiceArea` (helper: `GET/PUT /providers/me/service-area`) | service area | owner, approved | bare selects on `provider_service_areas`, `provider_coverage_areas` | whole tables | optional | **was: 42P01 → 500** → unconfigured/empty prefixes | VULNERABLE | **HARDENED** |
| `GET /providers/me/availability/emergency-openings` | Emergency Openings list | owner, approved | bare select on `provider_emergency_openings` | whole table | optional | **was: 42P01 → 500** → `[]` (absent relation holds no rows) | VULNERABLE | **HARDENED** |
| `GET /providers/me/availability/blocked-ranges` | Vacation Ranges list | owner, approved | bare select on `provider_blocked_ranges` | whole table | optional | **was: 42P01 → 500** → `[]` | VULNERABLE | **HARDENED** |
| `loadDashboardBookingRows` (helper: `GET /providers/me/dashboard`, `/me/metrics`) | dashboard/metrics | owner, approved | explicit projection incl. `bookings.source` | `bookings.source` | optional (attribution only) | **was: 42703 → 500** → `source: null` | VULNERABLE | **HARDENED** |
| `GET /bookings` (provider + client list) | bookings inbox | authenticated, role-scoped | `getTableColumns(bookings)` + users join | `source`, `cancellation_category`, `no_show_marked_*` | optional | **was: 42703 → 500** → additive fields `null` | VULNERABLE | **HARDENED** |
| `GET /bookings/:id` + `loadOwnedBookingForRead` (cancellation-preview, outcome-history gate) | booking detail | owner, non-leaking | bare select on `bookings` | same bookings columns | optional | **was: 42703 → 500** → `selectBookingByIdDriftSafe` stable fallback | VULNERABLE | **HARDENED** |
| `GET /bookings/:id/outcome-history` | booking outcome audit | owner | bare select on `booking_outcome_history` | whole table | optional | **was: 42P01 → 500** → `[]` | VULNERABLE | **HARDENED** |
| `loadOwnedBooking` (reschedule.ts helper: both reschedule GETs + write gates) | bookings/reschedules | owner, non-leaking 404 | **bare `tx.select()`** on `bookings` | `source`, `cancellation_category`, `no_show_marked_*` | no (ownership uses stable columns) | **was: 42703 → 500** → savepoint eager-first, stable fallback | VULNERABLE | **HARDENED** |
| `GET /bookings/:id/reschedule-requests` | reschedules (provider + client) | owner via `loadOwnedBooking` | bare select on `booking_reschedule_proposals` | whole table | optional | **was: 42703/42P01 → 500** → `[]` | VULNERABLE | **HARDENED** |
| `GET /bookings/:id/rescheduling-history` | reschedule audit trail | owner via `loadOwnedBooking` | bare select on `booking_reschedule_history` | whole table | optional | **was: 42703/42P01 → 500** → `[]` | VULNERABLE | **HARDENED** |
| `GET /providers/application`, `/status`, `/completion`, `/submissions`, `/services`, `/availability` | onboarding/status | owner | `getOwnApplication` + stable tables | `rejection_reason` (inherited) | optional | truthful degrade (since #69) | none now | SAFE |
| `GET /providers/me/activation-status` | status hub | owner (any member) | #69 helpers + hardened coverage probe | all three task columns | optional | truthful degrade (since #69) | none now | SAFE |
| `GET /providers/me/readiness` | activation readiness | owner (any member) | `readinessSourceColumns` explicit stable projection + `services`/`availability`/`travel_zones`/`verification_docs` (stable) | none | — | unaffected | none | SAFE |
| `GET /providers/me/verification` | verification | owner | `getOwnVerificationProfile` + `verification_docs` (stable) | none required | — | unaffected (since #69) | none | SAFE |
| `GET /providers/notifications`, `/unread-count`, `POST /:id/read` | notifications | owner | `provider_notifications` (stable, applied schema) | none | — | unaffected | none | SAFE |
| `GET /auth/me` + role-state bootstrap (portal layout/role-aware routing) | portal bootstrap | authenticated | `users`, `account_roles` (stable) | none | — | unaffected | none | SAFE |
| `GET /providers/`, `/:id`, `/:id/services`, `/:id/availability`, `/:id/reviews` | public marketplace | public | explicit stable projections | none | — | unaffected | none | NOT APPLICABLE (public/client surface; verified no Gate-B columns selected) |
| `GET /providers/:id/slots`, `POST /bookings`, `POST /:id/service-area-check` | public/client booking flow | public/client | shared availability-exception + coverage loaders (pending tables) | whole tables | n/a | 42P01 → 500 on a drifted DB | out of scope | UNCHANGED — client/public surface, not a provider-owned read; loaders are not shared with any provider-owned GET (those were hardened at route level). Recorded as a known follow-up if Gate B stays unapplied. |
| `GET /booking-pages/:slug` (public booking page) | public share target | public | `provider_profiles.public_slug`/`booking_page_published` | required by feature | required | 42703 → 500, but unreachable in practice: publishing requires the same absent columns, so no shared slug can exist pre-Gate-B | REVIEW | UNCHANGED — feature cannot exist without its artifact; hardening would fake a 404 surface for a feature that is entirely gated on the migration |
| `POST /support/escalations` | support escalation (write) | owner, non-leaking | bare booking select + insert requiring `support_tickets.booking_id` | required by write | required | loud failure (write requires absent column) | policy-conformant | UNCHANGED — write path; must fail loudly, nothing fabricated |
| `GET /support/bookings/:id/escalations`, `PATCH /support/escalations/:id` | admin/support only | admin | full internal view | yes (intentional) | yes | admin-internal | out of scope | NOT APPLICABLE (admin surface, not provider-owned) |
| Provider write paths (`PATCH /bookings/:id/status`, publish/unpublish, openings/ranges/service-area/services/availability writes, reschedule propose/accept/decline) | writes | owner, approved | various | some require pending objects | required by the write | loud failure preserved | policy-conformant | UNCHANGED — reads-only audit; writes that require absent objects must keep failing loudly (no invented success) |
| `GET /invoices*`, `GET /reviews*` provider reads | invoices/reviews | owner | original stable tables | none | — | unaffected | none | SAFE |

**Totals:** 38 routes/helpers reviewed · 14 hardened before this branch closed
(11 recovered from the interrupted session + 3 completed in this session:
`loadOwnedBooking`, `GET /bookings/:id/reschedule-requests`,
`GET /bookings/:id/rescheduling-history`) · 4 previously hardened by PR #69 ·
20 reviewed and intentionally unchanged (SAFE / NOT APPLICABLE / UNCHANGED
with reasons above).

## 5. Fixes delivered on this branch

- `artifacts/api-server/src/lib/schema-drift.ts` (NEW): shared
  `isSchemaDriftError` (moved verbatim from `routes/providers.ts`), shared
  `bookingStableColumns` + `BOOKING_DRIFT_DEFAULTS`.
- `routes/providers.ts`: drift-safe `getOwnProfile` (eager-first + stable
  projection + truthful unpublished defaults), `hasActiveServiceAreaCoverage`
  → `false` on drift, `buildOwnServiceArea` → unconfigured, emergency-openings
  and blocked-ranges owner lists → `[]`, `loadDashboardBookingRows` →
  `source: null`.
- `routes/bookings.ts`: `selectBookingByIdDriftSafe` (detail +
  `loadOwnedBookingForRead`), drift-safe list read, outcome-history → `[]`.
- `routes/reschedule.ts`: drift-safe `loadOwnedBooking` (savepoint
  eager-first; non-leaking 404 unchanged), reschedule-requests list → `[]`,
  rescheduling-history → `[]`.
- No OpenAPI, generated-client, schema, or migration change. Response
  contracts on a migrated database are byte-identical (eager path).

## 6. Drift regression coverage

`test:route-read-drift`
(`src/__tests__/provider-route-read-drift.integration.test.ts`, 19 tests,
added to the CI scripted loop) uses the disposable-PostgreSQL drift
simulation proven in PR #69: fixtures are created on the migrated schema,
the Gate B objects are dropped (same DDL surface as the frozen artifacts),
every hardened read is exercised, then the schema is restored. It proves:

- no hardened provider route returns 500 on a pre-Gate-B schema;
- migrated-path parity (attributed `bookings.source` passes through
  unchanged before the drop);
- truthful empty/unpublished/unconfigured degraded states — never fabricated;
- ownership isolation, wrong-role 403, unauthenticated 401, and non-leaking
  404 stay intact under drift;
- no SQL details, pg error codes, query text, reviewer/internal fields, or
  client PII leak in any degraded response.

PR #69's `test:return-path-drift` (11 tests) continues to guard the
first-login/status-hub path and is untouched.

## 7. Boundaries honored

- Managed database: **NOT ACCESSED**. All simulation on disposable local
  PostgreSQL 15 only.
- No migration applied or modified; the frozen artifacts are byte-untouched.
- No production deployment. Gate B remains a separately authorized release
  operation (`docs/managed-db-release-gate.md`) — drift is survivable now,
  not desirable: booking pages, service areas, exceptions, reschedules, and
  cancellation flows still need their artifacts to actually function.
- No Emergency Openings/Vacation Ranges behavior change, no dashboard
  redesign, no Status Hub Progress meter, no QR/SEO/payments/CRM work, no
  broad ORM refactor, no client-only feature changes.
