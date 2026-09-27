# Metric definitions

Every number shown to a provider or administrator is defined here with the
exact rule, the SQL that reproduces it, and the fixture-based test that pins
the rule. If a screen shows a figure that is not in this file, the screen is
wrong — add the definition or remove the figure.

Conventions
- "Resolved" visit = booking whose `status` is `completed`, `cancelled` or
  `no_show`. `requested`, `confirmed` and `rescheduled` are unresolved.
- Rates are shares of resolved visits; they are **not shown** until a minimum
  number of resolved visits exists (stated per metric).
- Money is integer cents. Nothing labelled "earnings" is money received unless
  an invoice was explicitly marked `paid`.
- Demo exclusion: until `users.is_demo` exists
  (`docs/migrations/PROPOSED_2026-09-27_DEMO_FLAG_AUDIT_LOG.md`), demo accounts
  are identified by the fixed allowlist `DEMO_EMAILS`
  (`artifacts/api-server/src/lib/demo-data.ts`) and are **tagged, not excluded**
  from admin counts. Provider-facing figures are always the provider's own rows.

`:provider_id` below is `provider_profiles.id`; `:now` is the request time.

## Provider scorecard — `GET /providers/me/scorecard`

Source: `artifacts/api-server/src/lib/provider-scorecard.ts`
(`countBookings`, `suggest`, `computeScorecard`).
Fixture test: `artifacts/api-server/src/__tests__/provider-scorecard.test.ts`.
Preview regression: `backend/tests/test_provider_scorecard.py`.

Windows
- **Last 30 days**: bookings with `scheduled_at BETWEEN :now - interval '30 days' AND :now`
  (past visits only — a booking scheduled tomorrow is not in the window);
  reviews with `created_at` in the same range.
- **All time**: every booking / review of the provider.

| Field | Rule | SQL (all-time form; add the window predicate for last 30 days) |
|---|---|---|
| `total` | all bookings | `SELECT count(*) FROM bookings WHERE provider_id = :provider_id` |
| `completed` / `cancelled` / `noShow` | count by current status | `... AND status = 'completed'` (`'cancelled'`, `'no_show'`) |
| `awaitingOutcome` | unresolved bookings | `... AND status IN ('requested','confirmed','rescheduled')` |
| `resolved` | `completed + cancelled + noShow` | `... AND status IN ('completed','cancelled','no_show')` |
| `distinctClients` | clients with ≥ 1 completed visit | `SELECT count(DISTINCT client_id) FROM bookings WHERE provider_id = :provider_id AND status = 'completed'` |
| `repeatClients` | clients with ≥ 2 completed visits | `SELECT count(*) FROM (SELECT client_id FROM bookings WHERE provider_id = :provider_id AND status = 'completed' GROUP BY client_id HAVING count(*) >= 2) r` |
| `reviews.count` | reviews for the provider | `SELECT count(*) FROM reviews WHERE provider_id = :provider_id` |
| `reviews.averageRating` | mean of 1–5 ratings, one decimal; `null` when count = 0 | `SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE provider_id = :provider_id` |
| `rates` | `null` while `resolved < 5`; otherwise `completed/resolved`, `cancelled/resolved`, `noShow/resolved` rounded to 3 decimals | derived from the counts above |

Suggestions (`suggestions[]`, at most one per `gap`, order fixed, own data only)

| `gap` | Fires when | Copy rule |
|---|---|---|
| `unresolved_past_visits` | last30 `awaitingOutcome > 0` | states the count; asks to record an outcome |
| `no_recent_visits` | last30 `total = 0` and all-time `total > 0` | suggests sharing the booking link |
| `no_shows` | last30 `noShow > 0` | states the count; suggests a confirmation message |
| `cancellations` | last30 `rates` present and `cancellation >= 0.20` | states `cancelled` of `resolved`; suggests checking availability/travel area |
| `no_repeat_clients` | all-time `distinctClients >= 3` and `repeatClients = 0` | suggests offering a follow-up date |
| `no_reviews` | all-time `completed >= 3` and `reviews.count = 0` | suggests asking for a review |

No suggestion may contain causal or revenue claims ("will increase",
"revenue", "guarantee") — asserted in the fixture test.

`isDemo`: provider's user e-mail is in `DEMO_EMAILS` (interim rule, see above).

## Provider performance metrics — `GET /providers/me/dashboard` → `metrics`, `GET /providers/me/metrics`

Source: `computeDashboardMetrics` in `artifacts/api-server/src/routes/providers.ts`.
All-time, own bookings only. Rates are 0 (and the UI shows an empty state)
while `resolvedBookings = 0`; rounded to 4 decimals.

| Field | Rule |
|---|---|
| `completionRate` | `completed / resolved` |
| `cancellationRate` | `cancelled / resolved` |
| `noShowRate` | `no_show / resolved` |
| `repeatClientRate` | `repeatClients / distinctClients` (same client definitions as the scorecard); 0 when no client has completed |
| `totalBookings`, `completedBookings`, `cancelledBookings`, `noShowBookings`, `resolvedBookings` | counts as in the scorecard, all time |

Status chips in `components/dashboard/performance-metrics.tsx` use fixed
thresholds (completion ≥ 85 % good / ≥ 70 % warn; cancellation ≤ 20 % / ≤ 30 %;
no-show ≤ 10 % / ≤ 20 %; repeat ≥ 40 % good). They are presentation only.

## Earnings — `GET /providers/me/earnings`

Source: `/me/earnings` route in `artifacts/api-server/src/routes/providers.ts`.
Invoice-based; the platform processes no payments.

| Field | Rule | SQL |
|---|---|---|
| `paidCents` | invoices marked paid | `SELECT coalesce(sum(amount_cents),0) FROM invoices WHERE provider_id = :provider_id AND status = 'paid'` |
| `pendingPayoutCents` | invoices still pending | `... AND status = 'pending'` |
| `totalCents` | `paidCents + pendingPayoutCents` ("Invoiced value" — not confirmed paid) | sum of the two |
| `invoiceCount` | non-cancelled invoices | `SELECT count(*) FROM invoices WHERE provider_id = :provider_id AND status <> 'cancelled'` |
| `completedBookings` | exact completed count (no longer `review_count`) | `SELECT count(*) FROM bookings WHERE provider_id = :provider_id AND status = 'completed'` |

Dashboard `earningsPreview.estimatedMonthlyCents`: sum of `services.price_cents`
over the provider's `completed` bookings whose `scheduled_at` falls in the
current marketplace-timezone month; `null` when none. Labelled an estimate.

## Admin command center — `/admin`

| Card / figure | Rule | Endpoint |
|---|---|---|
| Credentials awaiting review | `SELECT count(*) FROM verification_docs WHERE status = 'pending'`; oldest = min `submitted_at` | `GET /admin/verification/queue?status=pending` |
| Applications under review | `SELECT count(*) FROM provider_applications WHERE status = 'under_review'`; oldest = min `submitted_at` | `GET /admin/provider-applications?status=under_review` |
| Support requests open | `SELECT count(*) FROM support_tickets WHERE status IN ('open','in_progress')`; oldest = min `created_at` | `GET /admin/support/escalations` (default `unresolved`) |
| Recent application activity | last 8 `provider_application_events` by `created_at DESC` | `GET /admin/provider-applications/events?limit=8` |
| Recent credential decisions | last 8 `verification_docs` with `status IN ('approved','rejected')` by `reviewed_at DESC, id DESC` (no separate event table — honesty boundary) | `GET /admin/verification/events?limit=8` |
| System health | degraded when DB unreachable, any required env var unset, or any frozen artifact probe missing | `GET /admin/system-status` |
| Demo data present | users whose e-mail is in `DEMO_EMAILS` and `role <> 'admin'`, plus their profiles/bookings/reviews | `GET /admin/demo-data` |
| "Waiting > 3 days" attention tone | `daysSince(oldest) >= 3` — a display definition, not an SLA | `artifacts/web/src/pages/admin/index.tsx` `SLOW_DAYS` |

Preview regressions: `backend/tests/test_admin_provider_applications.py`,
`backend/tests/test_admin_phase2_feeds.py`.

## Not shown anywhere (by decision)

Funnel conversion, revenue, forecasts, response-time metrics and
cross-provider benchmarks are not displayed because the underlying events are
not recorded. Adding one requires (1) the event/record, (2) a row in this file,
(3) a fixture test — in that order.
