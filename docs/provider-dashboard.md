# Provider Dashboard — Southern Ontario Pilot (conversion-first)

**Status:** Implemented 2026-08-27 (`feat/provider-dashboard`).
**Route:** `/provider/dashboard` (canonical; `/provider` redirects here).
**API:** `GET /api/providers/me/dashboard`, `GET /api/providers/me/metrics`.

The provider dashboard is the daily home for pilot providers. Every design
decision follows three questions: does it make providers feel more confident,
does it make clients trust the provider more, and does it make paying for Foot
feel like a no-brainer. It is **read-only**: the only mutations reachable from
the page are the pre-existing booking-page publish/share actions.

---

## Access

- Provider-only. Both endpoints sit behind the standard approved-provider
  gate (`requireAuth` + `requireRole("provider")` + `requireApprovedProvider`):
  unauthenticated → 401, clients/admins → 403, unapproved providers → 403.
- Web: the page renders inside `ProviderLayout`, which already redirects
  unauthenticated visitors to `/login`.
- Each dashboard read is audit-logged (`provider dashboard accessed` with
  `userId` and `providerProfileId`) — read-only access trail for the pilot.

## Sections

| Section | Content | Source |
|---|---|---|
| Welcome | Time-of-day greeting, today's booking count, next booking (marketplace timezone) | `todayBookingsCount`, `nextBooking` |
| Quick actions | Set availability → `/provider/availability`; Share booking link (scrolls to link card); View bookings → `/provider/bookings` | static links |
| Readiness + first booking | Existing server-computed cards, unchanged | existing endpoints |
| Upcoming bookings | Next 7 / next 30 days toggle (list view), status color **and** text, client first name + last initial, FSA/city location only | `upcomingBookings` |
| Performance metrics | Completion / cancellation / no-show / repeat-client rates with progress bars, text status chips and supportive copy | `metrics` |
| Booking link | Existing `BookingPageCard` (publish, copy, native share, QR with `source=qr-card`) plus the source-attribution chart | existing + `sourceAttribution` |
| Recent activity | Collapsible (collapsed by default), last 10 outcome changes | `recentActivity` |
| Earnings preview | "Coming soon" badge; honest estimate = completed visits this month × service price; pilot keeps 100% | `earningsPreview` |

## Metric definitions and thresholds

All rates are **0–1 decimals** computed over **resolved bookings**
(`completed + cancelled + no_show`). Active bookings (requested / confirmed /
rescheduled) have no outcome yet, so they are excluded from every denominator.
With zero resolved bookings all rates are `0` and the UI shows an explicit
empty state — never a fake 0% or 100%.

| Metric | Definition | Green | Amber | Red |
|---|---|---|---|---|
| Completion rate | completed / resolved | ≥85% | 70–84% | <70% |
| Cancellation rate | cancelled / resolved | ≤20% | 21–30% | >30% |
| No-show rate | no_show / resolved | ≤10% | 11–20% | >20% |
| Repeat client rate | clients with ≥2 completed bookings / clients with ≥1 completed booking | ≥40% | — (supportive "Growing", never red) | — |

Color is never the only signal: each metric carries a text chip ("On track" /
"Worth a look" / "Needs attention" / "Growing") and a supportive one-line
message. Tone is celebratory on green and gently practical on amber/red — no
shame, no judgment.

**Not displayed (honest scope):** on-time rate (appointment start times are
not tracked) and average rating (reviews exist but the pilot dashboard defers
rating display until review volume is meaningful). Both are recorded in the
TODO ledger.

## Source attribution

Booking counts grouped by the existing allowlist
(`docs/api-routes.md`, roadmap #11): `instagram`, `qr-card` (exposed as
`qrCard`), `text`, `facebook`, `website`; `unknown` counts bookings recorded
without attribution and `other` is reserved for future allowlist growth. The
chart is a dependency-free CSS horizontal bar list (no chart library): labels
and counts are plain text, bars are decorative (`aria-hidden`).

## Privacy

The dashboard payload never contains a client's full address:

- `location` is the postal FSA prefix (e.g. `L2R`) when a postal code exists,
  otherwise the city.
- `clientName` is first name + last initial (e.g. "Alex M.").

## Earnings preview

`estimatedMonthlyCents` = sum of service `priceCents` for bookings **completed
this month** (marketplace timezone), `null` when nothing completed this month.
`available` is always `false` until payments are enabled — no money moves
through the platform during the free pilot, and the UI says so.

## Response shape

See `lib/api-spec/openapi.yaml` (`ProviderDashboardResponse`,
`ProviderMetricsResponse`) — generated types/hooks:
`useGetMyProviderDashboard`, `useGetMyProviderMetrics`.

## Implementation notes

- Single owner-scoped read: one query loads the provider's booking history
  (joined to service + client), everything else is derived in memory.
  Appropriate at pilot scale (5 providers); revisit with SQL aggregation if a
  provider ever exceeds thousands of bookings.
- Marketplace timezone (`MARKETPLACE_TIMEZONE`, default `America/Toronto`)
  defines "today" and "this month" — same source as slot generation.
- `recentActivity` is derived from current booking rows ordered by
  `updatedAt` (`completed → booking`, `rescheduled → reschedule`,
  `cancelled → cancellation`, `no_show → no_show`). It reflects each
  booking's latest state, not the full append-only outcome history.
- No schema change and no new dependencies were introduced.

## Deferred (recorded in `docs/TODO-LEDGER.md`)

- **Emergency availability / block-off dates quick actions** — require a
  date-specific availability-exceptions model (current availability is weekly
  recurring windows only). No fake buttons are shown.
- **Calendar view** for upcoming bookings (list + 7/30-day toggle shipped).
- **On-time rate, average rating** — see above.
- **Response caching** — reads are cheap at pilot scale; add if needed.

## Tests

- API: `artifacts/api-server/src/__tests__/provider-dashboard.test.ts`
  (`pnpm --filter @workspace/api-server run test:provider-dashboard`; wired
  into the CI scripted-suite loop). Authorization, empty state, metric math,
  attribution grouping, 30-day window/ordering, privacy trims, activity
  ordering, earnings preview, `/me/metrics` parity.
- Web: `artifacts/web/src/__tests__/provider-dashboard.test.tsx`
  (loading/error/empty states, greeting, quick actions, metrics + zero state,
  chart + empty state, 7/30 toggle, collapsible activity, earnings preview,
  axe scans on loaded and empty renders).
