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

## Phase A (2026-08-28) — Next Best Action + Pending Reschedule visibility

Evolution of the existing dashboard (PR #54, blueprinted in
`docs/provider-dashboard-readonly-overview.md`) — not a rebuild. Two
additions, both composed from existing systems:

- **Next Best Action card**
  (`artifacts/web/src/components/dashboard/next-best-action.tsx`): renders
  the server-derived, journey-ordered `nextAction` from the existing
  Activation Hub endpoint `GET /providers/me/activation-status`
  (existing `useGetMyProviderActivationStatus` hook, shared query key with
  the hub). No activation/business logic is recomputed client-side. One
  plain-language heading, one "why it matters" sentence, one primary action
  per state. Deep links reuse existing routes only (`/onboarding/provider`,
  `/provider/profile`, `/provider/service-area`, `/provider/services`,
  `/provider/availability`, `/provider/application-status`);
  `publish_booking_page` / `share_booking_page` scroll to the dashboard's
  existing BookingPageCard (`#booking-link-card`) instead of duplicating
  publish/share UI; `all_set` links to the server-proven `bookingPage.path`.
  Pre-approval and paused states point to the legitimate status hub — never
  a dead/forbidden route. Loading is a small skeleton; errors fall back to a
  quiet status-hub link; the card never blocks the rest of the dashboard.
  No fake urgency, scarcity, or "clients are waiting" claims (guarded by
  tests).
- **Pending Reschedules card**
  (`artifacts/web/src/components/dashboard/pending-reschedules.tsx`):
  surfaces client-initiated reschedule requests — bookings in status
  `rescheduled` (state machine `rescheduled → confirmed | cancelled`; only
  clients write this status, providers use consent-first proposals). Data
  comes from the same owner-scoped dashboard read: the response now includes
  `pendingReschedules: { count, nextRequest }`, computed from the booking
  rows the endpoint already loads (no new query, no new endpoint, no schema
  change, not capped by the 30-day upcoming window). `nextRequest` is the
  soonest requested time with the exact same privacy trims as every other
  booking in this payload (first name + last initial, FSA/city — never a
  full address). Zero state is a calm one-line row ("No pending schedule
  changes"). The card only links into the existing bookings workflow
  (`/provider/bookings?tab=rescheduled`; the bookings page now reads an
  allowlisted `?tab=` deep-link param). Nothing is auto-accepted,
  auto-declined, or auto-cancelled — consent/approval semantics unchanged.

**Action priority decision (evidence-based):** a `rescheduled` booking holds
a live appointment unconfirmed until the provider confirms or declines, and
the requested time itself expires as it passes — so when
`pendingReschedules.count > 0` the reschedule card renders **above** the
Next Best Action card. Otherwise the nextAction leads and the
schedule-change row stays compact. Resulting hierarchy: header/today + next
appointment → [pending reschedules ⇄ next best action] → quick actions →
existing content (readiness, first booking, upcoming, metrics, booking
link, activity, earnings) unchanged.

**Tests:** API — `test:provider-dashboard` extended to 17 (zero state,
owner-scoped count unbounded by the 30-day window, soonest-first ordering,
privacy trims incl. no full last name in the pending summary, read-only /
no-mutation). Web —
`artifacts/web/src/__tests__/provider-dashboard-actions.test.tsx` (22 tests:
every nextAction code with truthful heading + deep link, loading/error
fallback that never blocks the dashboard, publish/share scroll, honest
under-review copy guard, pending zero/one/many, review deep link, priority
ordering both ways, privacy-trimmed rendering, `?tab=` allowlist, axe on
both action states). Verified live at 390×844 (no horizontal overflow;
review link lands on the existing Reschedules tab).

## Reschedule alerts — portal nav badge (2026-08-29)

The pending-reschedule signal introduced in Phase A is now visible from any
portal page: the existing provider nav (`components/layout/provider-layout.tsx`)
shows a small count badge on the **Bookings** tab whenever client-initiated
`rescheduled` bookings await the provider's confirm/decline, and the Bookings
nav item deep-links to `/provider/bookings?tab=rescheduled` (the allowlisted
`?tab=` param from Phase A) while work is pending. With zero pending
reschedules the badge is absent and the nav item links to plain
`/provider/bookings`.

Data source: the EXISTING owner-scoped bookings list hook
(`useListBookings({ status: rescheduled })` → `total`), mirroring the
adjacent requested-count badge line — the same count the dashboard's
`pendingReschedules.count` reports (all `rescheduled` bookings, no window
cap). Chosen over polling `GET /providers/me/dashboard` from the layout
because that read model is heavier and access-audited; no new endpoint, no
schema change. Truthful count only — no urgency copy. Status is conveyed by
a numeric label + aria-label ("N pending reschedule request(s) awaiting your
response"), not color alone; distinct tone (primary) and position
(bottom-right) keep it separate from the destructive requested-count badge.

Tests: `components/layout/provider-layout.test.tsx` (6 — absent at zero +
plain link, count on mobile & desktop + deep link, aria text, 99+ cap,
independence from the requested badge, axe). Verified live desktop + 390×844
(badge appears/disappears with real data; deep link lands on the
Reschedules tab; zero horizontal overflow).

## Printable QR card — booking page handout (2026-08-29)

A "Print handout" action on the BookingPageCard (published state only) opens
`/provider/booking-page/print` — a presentation-only, print-ready card for
clinics/pharmacies: OnCall Foot mark, provider name + title, up to six
active services (name · duration · price), a QR code encoding the canonical
booking URL with the EXISTING allowlisted `source=qr-card` attribution, the
human-readable URL, and a truthful "Scan the code or visit the link to book"
line. Data sources: the owner booking-page read (slug/publish state) plus
the SAME public `GET /booking-pages/:slug` response clients see — so only
already-public information can appear (no client data, notes, or internal
fields). No new endpoint, no schema change, no business-logic change.

Print behavior: Tailwind `print:` variants render a single high-contrast,
ink-friendly page; the provider layout's existing `print:hidden` chrome
removes all navigation/footers. On screen the view stays readable on mobile
with screen-only Print / Back controls. Unpublished pages get a truthful
zero state ("publish first") instead of a dead QR.

Tests: `pages/portal/booking-page-print.test.tsx` (6 — full render incl.
prices/durations, QR alt text, screen controls + window.print, unpublished
zero state with the public query disabled, six-service cap, axe) plus the
existing booking-page-card suite still green with the new link. Verified
live: desktop screen, `emulate_media(print)` (all chrome hidden,
black-on-white), and 390×844 (0px horizontal overflow).
