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
