# Pilot Operations Dashboard — Metrics API (Part 1)

**Added:** 2026-08-28, branch `feat/pilot-operations-metrics-api`.
**Status:** backend foundation (metric contract, retention storage, admin
API). The `/admin/pilot` UI ships in Part 2; the weekly review pack in Part 3.

## Purpose

An **admin-only** internal tool for running a five-provider controlled pilot.
It answers: are providers activating, reaching first value, publishing and
sharing booking links; are clients booking; are appointments completing; are
cancellations/no-shows manageable; who needs outreach; which sources bring
bookings; are providers likely to retain?

It is **not** a client feature and **not** a provider-facing dashboard.

## Vertical-neutral metric model

Metric logic uses only neutral concepts: provider, provider profile, provider
application, service, booking, appointment outcome, booking page, source
attribution, service-area eligibility, support escalation, retention intent,
activation milestone. No foot-care terms are encoded in calculations; the
"Southern Ontario, five providers" framing is display context only
(`PILOT_PROVIDER_TARGET`, default 5, is presentation — never a denominator).

## Definitions (exact)

- **Activation:** provider is approved (application approved AND verification
  approved — the same boundary as `requireApprovedProvider`), has a complete
  profile (title + bio + city), has submitted verification (≥1 credential
  reference), has service-area configuration (active config + ≥1 active
  prefix — the same check as booking-page publish eligibility), has ≥1 active
  service, has availability configured, and has a published booking page.
  Account creation alone is never activation.
- **First value:** provider receives their first booking (all-time
  `min(bookings.created_at)`, tracked independently of the pilot window).
- **Active:** provider has booking activity within the pilot window
  (bookings are attributed to the window by creation time, UTC days).

Activation status ladder (highest achieved stage):
`not_started → in_progress → ready_to_publish → published → first_booking → active`.

## Pilot window resolution

`PILOT_START_DATE` / `PILOT_END_DATE` (optional env, examples in
`.env.example`). If both are valid ISO dates with end > start they are used
(`isProjected: false`). Otherwise: start = earliest booking date (or today if
no bookings), end = start + 5 weeks, `isProjected: true`. Invalid
configuration **never crashes** the endpoint — it falls back and sets an
internal-safe `pilot.configWarning`. Implementation:
`artifacts/api-server/src/lib/pilot-metrics.ts` (`resolvePilotWindow`, pure
and unit-tested).

## Provider denominator (documented limitation)

`approvedProviders` counts **all** approved provider profiles in the
database. If approved non-pilot providers are added later, introduce an
explicit pilot cohort/allowlist before relying on rates. Cohort management is
deliberately deferred.

## Retention storage

`pilot_provider_retention` (frozen artifact
`docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql`, additive-only): one row
per provider (unique FK), `retention_intent` enum `yes | no | unknown`,
`updated_by` admin FK, `updated_at`. Upserts via
`PATCH /api/admin/pilot/providers/:providerId/retention`; writes are
audit-logged with the admin actor. No cascade delete.

## API

- `GET /api/admin/pilot/metrics` — full payload (`pilot`, `summary`,
  `providers[]`, `sourceAttribution[]`; see `PilotMetricsResponse` in
  `lib/api-spec/openapi.yaml`). Access is audit-logged.
- `PATCH /api/admin/pilot/providers/:providerId/retention` — body
  `{ retentionIntent: "yes" | "no" | "unknown" }`.

Both routes live under the admin router's `requireAuth +
requireRole("admin")` gate: unauthenticated → 401, client/provider → 403.

## Calculation notes

- Rates are `null` when the denominator is zero (`activationRate` over
  approved providers; completion/cancellation/no-show over **resolved**
  bookings = completed + cancelled + no_show). UIs must render "No completed
  appointments yet" — never a misleading `0%`.
- Repeat-client rate = unique clients with 2+ bookings with that provider in
  the window ÷ unique clients with 1+ booking in the window (`null` when no
  clients).
- Source attribution groups window bookings by the allowlisted
  `bookings.source`; null/empty group as `unknown`; percentage of total
  window bookings (null when zero bookings). No raw query strings or
  tracking tokens.
- Support escalations = support tickets linked to a booking, created in the
  window.
- Risk flags: `not_activated`, `not_published`, `no_booking_yet`,
  `high_cancellation_rate` (> 0.20), `high_no_show_rate` (> 0.10),
  `retention_risk` (intent = no). Flags are operator aids, never public and
  never a ranking.

## Privacy rules

The payload never contains: client emails/names/phones/identifiers, full
addresses or postal codes, care notes, document references, reviewer notes,
support notes/subjects, internal tokens, raw tracking parameters, or
application details beyond safe approval status. Provider identity is name +
approval status only (already admin-visible). Enforced by test
(`pilot-metrics.integration.test.ts` redaction suite).

## Schema-drift note

The metrics computation reads `provider_profiles.booking_page_published`
(a Gate B-pending #11 column). The dashboard is an internal admin tool and
requires a schema with the frozen artifacts applied (true for `db:push`
environments); on a pre-Gate-B managed database the endpoint would fail —
acceptable for an internal tool and documented here.

## Part 2 UI handoff

Part 2 builds `/admin/pilot` over this API using the generated
`useGetAdminPilotMetrics` / `useUpdatePilotProviderRetention` hooks
(`@workspace/api-client-react`). Part 2 must NOT rebuild: metric
calculations, retention persistence, the migration artifact, authorization,
or the OpenAPI contract. Undefined rates must render the honest empty copy;
thresholds (activation 80%, completion 85%, cancellation ≤20%, no-show ≤10%,
escalations ≤3) are display aids, not API values.

## Continuity handoff — end of Part 1 (2026-08-28)

```text
Pilot Operations Dashboard status:
Part 1 metrics API + retention storage: COMPLETE
Part 2 admin UI + chart + CSV: NOT STARTED
Part 3 weekly review pack: NOT STARTED

Baseline main SHA: 6f5778198470c70e763e8d8ee54003c5662d17f8
Current branch: main (Part 1 merged via PR #60)
Current head SHA: d7dcf115f39e8e2eddc8362f1347da1a4992079c
Uncommitted files: NONE
Committed files: 34 files in PR #60 (metrics lib + routes + schema +
  migration artifact + OpenAPI/clients + tests + docs + env example + CI)
PR: https://github.com/sbtheg17-market/foot/pull/60 — MERGED
Migration artifact: docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql — frozen
  additive artifact; sha256
  ceaac6d50e6336fe4c13281ab7de5fc36eca7d96262a771c16a3f8647bf90cad;
  disposable-PG fresh apply PASS / re-apply fails loudly per policy /
  db:push ×2 + seed ×2 PASS; Gate B-pending; managed DB NOT accessed
API routes: GET /api/admin/pilot/metrics;
  PATCH /api/admin/pilot/providers/:providerId/retention
Metric definitions implemented: everything in "Definitions (exact)" above —
  window resolution w/ safe projected fallback, activation milestones +
  status ladder, first value/active signals, outcome rates, repeat-client
  rate, source attribution (unknown grouping), support escalations,
  retention rollup, risk flags; vertical-neutral throughout
Authorization behavior: both routes under routes/admin.ts requireAuth +
  requireRole("admin"); 401/403 verified by integration tests; access and
  writes audit-logged with the admin actor
Privacy boundaries: enforced by the redaction suite in
  pilot-metrics.integration.test.ts (see "Privacy rules" above)
Tests passed: CI 16/16 GREEN on merged SHA d7dcf11, incl. the CI-gated
  test:pilot-metrics suite (14 tests) and pilot-window unit tests
Tests not run: none outstanding for Part 1
CI status: GREEN (16/16 on d7dcf115f39e8e2eddc8362f1347da1a4992079c)
Exact next action: build Part 2 /admin/pilot UI over the generated
  useGetAdminPilotMetrics / useUpdatePilotProviderRetention hooks; do NOT
  rebuild Part 1 calculations, persistence, migration, auth, or contract
```

```text
Strategic boundary:
This is a platform-admin pilot dashboard.
Organization-admin/workspace/workforce functionality remains FUTURE and NOT IMPLEMENTED.
Provider-facing dashboard remains FUTURE and is not part of this branch.
```

## Part 2 — `/admin/pilot` dashboard UI (2026-08-28)

**Route:** `/admin/pilot` (web, wouter). **Platform administrator only** — an
internal Foot operator surface. It is not a provider dashboard, not an
organization-administrator dashboard, not an agency/workforce console, and
not client-facing. Server authorization is authoritative (Part 1
`requireAuth + requireRole("admin")`); the page renders no metric data until
the authorized fetch succeeds (no sensitive flash), with distinct 401
(sign-in) and 403 (platform-administrator restriction) states and a retry
state for other failures.

**Part 1 reuse (no duplication):** consumes `useGetAdminPilotMetrics` and
`useUpdatePilotProviderRetention` (`@workspace/api-client-react`, generated).
No new API routes, no schema/migration change, no authorization logic in the
client, no metric recalculation — display derivations only (e.g. "providers
with first booking" counts rows where `firstBookingAt` is set).

**Sections** (`artifacts/web/src/pages/admin/pilot.tsx` +
`artifacts/web/src/components/admin-pilot/`):

- **Pilot context:** window dates, five-provider target and Southern Ontario
  framing as display context only, `Projected window` badge + "configure
  PILOT_START_DATE and PILOT_END_DATE" guidance when projected,
  `configWarning` passthrough, generated-at timestamp.
- **Summary cards:** approved/activated (+rate), published pages, providers
  with first booking, total bookings, completion/cancellation/no-show rates,
  support escalations, retention rollup. Thresholds are quiet text aids
  (activation 80%, completion 85%, cancellation ≤20%, no-show ≤10%,
  escalations ≤3), status is never color-only, and undefined rates show
  honest empty copy ("No completed appointments yet") — never `0%`.
- **Activation/readiness ladder:** the nine Part 1 onboarding milestones in
  journey order with per-step provider counts; read-only, framed as
  "who could use a hand", never mutates provider setup.
- **Provider health table:** provider, activation status, booking page,
  first booking, bookings/completed/cancelled/no-shows, completion rate,
  retention intent, follow-up signal. Semantic table with sr-only caption,
  row headers, and horizontal-scroll overflow strategy on small screens.
  No sorting (kept simple), no ranking, no client identity, no documents/
  notes/addresses/tracking data.
- **Follow-up labels (non-punitive):** `not_activated` → "Setup incomplete",
  `not_published` → "Ready but not shared", `no_booking_yet` → "No booking
  yet", `high_cancellation_rate` → "Review cancellations",
  `high_no_show_rate` → "Review no-shows", `retention_risk` → "Check in with
  provider". Internal operator aids only.
- **Retention control:** Yes/No/Unknown native select per provider (labeled
  "Retention intent for {name}", keyboard accessible), PATCHes via the Part 1
  hook, shows a subtle role="status" "Saved" confirmation, and on failure
  preserves the previous value and reports the error. `updatedBy` is never
  displayed.
- **Source attribution chart:** dependency-free CSS horizontal bars (no
  Recharts); label + count + percentage as text, bars decorative
  (aria-hidden); `unknown` renders as "Direct / unknown"; zero-data state.
- **Weekly review prompts:** factual, cautious "review/check/assess" prompts
  derived from returned numbers only (publish gap, share gap, elevated
  no-show/cancellation vs guardrails, escalations present) with an explicit
  "not automated diagnosis" note and an all-quiet state.

**CSV export (client-side; no new endpoint, no export library):**
`artifacts/web/src/lib/pilot-csv.ts` builds the file from the already
authorized metrics payload. Unified allowlisted header with a `recordType`
column (`summary` / `provider` / `source_attribution`); every row carries
pilot start/end dates, the projected-window indicator, generation timestamp
and provider target. RFC 4180 escaping (quote doubling, CRLF), spreadsheet
formula-injection protection for strings starting `=`, `+`, `-`, `@`
(numbers untouched), dated filename
`pilot-operations-metrics-YYYY-MM-DD.csv`. Excluded by construction: client
PII, addresses/postal codes, care/reviewer/support notes, document
references, application details, tokens, raw tracking parameters, and
audit identifiers (`updatedBy`). Undefined rates stay empty cells.

**Accessibility/mobile:** landmarks (`main`, labeled sections, h1/h2
hierarchy), labeled controls, keyboard-operable retention select, status
conveyed by text, axe scans clean on loaded and empty states (jsdom level;
color-contrast excluded as non-deterministic without real rendering).
Responsive: card grid collapses (2 → 3 → 5 columns), table scrolls
horizontally inside its container at small widths.

**Known limitations:** no column sorting; the dashboard needs the current
schema (Part 1 schema-drift note applies); "providers with first booking" is
derived client-side; hardware-device verification remains the standing
deferred ledger item.

**Part 3 handoff:** build the weekly review pack (operator guide, decision
rules, closure docs) from current `main`. Part 3 must NOT duplicate:
`artifacts/api-server/src/lib/pilot-metrics.ts`,
`artifacts/api-server/src/routes/admin-pilot.ts`,
`artifacts/web/src/pages/admin/pilot.tsx`,
`artifacts/web/src/components/admin-pilot/*`,
`artifacts/web/src/lib/pilot-csv.ts`,
`docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql`.

```text
Pilot Operations Dashboard status:
Part 1 metrics API + retention storage: MERGED.
Part 2 admin UI + source chart + CSV: COMPLETE.
Part 3 weekly review pack: NOT STARTED.
Baseline main SHA: 4285bb8991b4d9abbc3bac0d8f486e4b6b9e0401
Current branch: feat/pilot-operations-dashboard-ui
Current head SHA: 61fa0e39c88121f443c5bd01b4f3fda0edb0911b (code; this docs commit lands on the same PR)
PR: https://github.com/sbtheg17-market/foot/pull/62
Merge SHA: pending at time of writing — squash-merge after CI green; exact SHA in Git history and the final session report
Admin route: /admin/pilot (platform administrator only)
Part 1 hooks reused: useGetAdminPilotMetrics; useUpdatePilotProviderRetention (generated, unmodified)
UI sections implemented: pilot context, summary cards, activation ladder, provider health table, retention control, source chart, review prompts, CSV export, loading/401/403/error/empty states
CSV status: client-generated, allowlisted columns, RFC 4180 + formula-injection safe, privacy exclusions test-enforced
Accessibility: axe clean (loaded + empty, jsdom level); labels/landmarks/keyboard covered by tests
Mobile emulation: NOT RUN this session (needs running server + PostgreSQL); responsive layout implemented and unit-tested at DOM level; on-demand `pnpm run smoke:mobile-emulation` available
Tests: web 180/180 PASS (34 new Part 2); full typecheck PASS; build PASS; build:deploy PASS; git diff --check PASS; secret scan PASS; API/PG suites via CI
CI: pending at time of writing — merge gated on green
Known limitations: no column sorting; requires current schema; providersWithFirstBooking derived client-side
Uncommitted work: NONE after this commit
Exact Part 3 next action: weekly review pack (operator guide, decision rules, closure docs) from current main
Files Part 3 must not duplicate: listed above
```

## Part 3 — Dashboard operator guide (2026-08-28)

How to *use* the dashboard, week to week. The weekly workflow, decision
rules, and closure criteria live in `docs/pilot/weekly-pilot-review.md`.

### Who can access `/admin/pilot`

Platform administrators only (the internal Foot operator role). The Part 1
routes enforce `requireAuth + requireRole("admin")` server-side: signed-out
visitors get a sign-in prompt (401), provider and client accounts get a
platform-administrator restriction notice (403), and no metric data renders
until the authorized fetch succeeds. There is no provider-facing,
organization-facing, or client-facing view of this page.

### What each metric means

Exact definitions are in "Definitions (exact)" above; the operator reading:

- **Providers approved** — all approved provider profiles (see the
  denominator limitation above). The five-provider target is display context.
- **Activated (+rate)** — providers who completed *every* onboarding
  milestone including a published booking page. Account creation is never
  activation.
- **Published pages** — providers whose booking page is live and shareable.
- **Providers with first booking** — reached first value at least once
  (all-time, independent of the window).
- **Bookings** — bookings created inside the pilot window.
- **Completion / cancellation / no-show rates** — over *resolved* bookings
  only. "No completed appointments yet" means the denominator is zero — it is
  never shown as a misleading 0%.
- **Support escalations** — booking-linked support tickets created in the
  window.
- **Retention intent** — your recorded judgment (Yes/No/Unknown) after direct
  provider conversations; never inferred by the system.
- **Source attribution** — window bookings grouped by allowlisted share
  channel; "Direct / unknown" collects bookings with no recorded source.

### What projected pilot dates mean

If `PILOT_START_DATE` / `PILOT_END_DATE` are not configured (or invalid), the
window is *projected*: start = earliest booking (or today), end = start +
5 weeks, and the dashboard shows a `Projected window` badge plus guidance.
Projected dates make the numbers reviewable, not official — configure the
real dates once the pilot window is agreed.

### How to update retention intent

In the provider health table, use the "Retention intent for {name}" select
(Yes / No / Unknown). The change saves via the Part 1 PATCH route, shows a
"Saved" confirmation, and is audit-logged with your admin account. Update it
only after a direct conversation with the provider; leave Unknown rather
than guessing. On a save failure the previous value is preserved.

### How to export CSV

The "Export CSV" action builds the file in your browser from the already
authorized metrics payload (no extra endpoint) and downloads
`pilot-operations-metrics-YYYY-MM-DD.csv` with `summary`, `provider`, and
`source_attribution` rows.

### CSV privacy limitations

The export is allowlisted by construction: it contains **no** client
identities or PII, no addresses or postal codes, no care/reviewer/support
notes, no document or verification references, no tokens, no audit
identifiers, and no raw tracking data. It still contains provider names and
operational performance figures — treat it as internal-confidential: do not
mail it to providers, post it, or attach it to support threads. Undefined
rates stay empty cells; do not backfill them with zeros in a spreadsheet.

### How to use risk/follow-up labels responsibly

Labels like "Setup incomplete", "Ready but not shared", "No booking yet",
"Review cancellations", "Review no-shows", and "Check in with provider" are
non-punitive operator aids that answer "who could use a hand this week".
They are threshold-triggered from small numbers, so treat each one as a
prompt to look and ask — never as a score, a warning to the provider, or a
reason for action without a conversation. They are internal-only and must
not be shared with providers as written.

### Why the dashboard does not rank providers

Five providers with a handful of bookings each cannot be meaningfully
ranked: one cancellation can reorder any leaderboard, providers serve
different areas/services/volumes, and a ranking would punish the providers
who most need onboarding help. The table is deliberately unsorted and
unranked; the pilot's goal is learning and provider success, not comparison.

### Why data must be paired with direct provider conversations

Every metric here records *what* happened; only providers can tell you
*why*. A published page with zero bookings may mean the link was never
shared, the audience is wrong, or the page confused clients — three
different actions the dashboard cannot distinguish. Retention intent is
explicitly a conversation outcome. Run the weekly review
(`docs/pilot/weekly-pilot-review.md`), then talk to at least one provider
before drawing conclusions.
