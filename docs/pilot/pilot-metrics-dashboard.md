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
