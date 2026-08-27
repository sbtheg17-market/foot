# Provider Dashboard — Capability Inventory (Truth Table)

**Created:** 2026-08-28, branch `docs/provider-dashboard-readonly-overview`.
Documentation only. Every row verified against source on baseline main
`d273d5f96210a01dee150decce5a082c7e4cf700` — never assumed from roadmaps.

Statuses used exactly: `IMPLEMENTED`, `EXISTS BUT NEEDS WIRING`,
`NEEDS NEW BUILD`, `FUTURE / DEFERRED`, `OUT OF SCOPE`.

## Dashboard concept truth table

| Dashboard concept | Current status | Reuse source | Implementation need | Conversion value |
|---|---|---|---|---|
| Today at a glance (greeting, today count, next appointment) | IMPLEMENTED | `pages/portal/dashboard.tsx`, `GET /providers/me/dashboard` | None | Instant "I'm organized" feeling |
| No-bookings empty state with share prompt | IMPLEMENTED | dashboard header copy | None | Turns quiet days into sharing days |
| Next best action card | EXISTS BUT NEEDS WIRING | `GET /providers/me/activation-status` (`nextAction`, PR #64) | Render hub `nextAction` on dashboard; no new derivation | Faster activation; answers "what now?" |
| Pending reschedule surfacing on dashboard | EXISTS BUT NEEDS WIRING | booking rows status `rescheduled`; review flow on `/provider/bookings` | Count + deep link on dashboard | Fewer missed requests |
| Upcoming bookings (7/30 list, privacy-trimmed) | IMPLEMENTED | `upcomingBookings` in dashboard payload | None | Less coordination chaos |
| Booking actions (view / review reschedule / cancel / no-show) | IMPLEMENTED (on `/provider/bookings`) | roadmap #13 flows, `routes/reschedule.ts`, bookings page | Dashboard deep links only; inline actions optional later | One place to act |
| Booking-link growth card (live status, URL, copy, native share, QR, preview) | IMPLEMENTED | `BookingPageCard`, `share-listing-actions.tsx` (`canNativeShare`) | None | Converts existing audience into bookings |
| Source-attribution summary (provider-safe) | IMPLEMENTED | `sourceAttribution` + `SourceAttributionChart` | None | Shows which sharing works |
| Schedule control: manage availability / services / service areas | IMPLEMENTED | portal availability/services/service-area pages + QuickActions | None | Schedule protection = pay-for reason |
| Block off time / emergency opening | FUTURE / DEFERRED | none — weekly recurring windows only | Availability Exceptions model (Phase B; first schema work) | Real-life schedule control |
| Personal business health (rates, repeat signal, honest empty states) | IMPLEMENTED | `metrics` + `PerformanceMetrics` | None | "Is this helping?" answered simply |
| Recent activity timeline | IMPLEMENTED (latest booking state only) | `recentActivity` derived from booking rows | True event history = FUTURE / DEFERRED (event design) | Fewer missed changes |
| Approval/readiness entry point | IMPLEMENTED | `ReadinessSummaryCard` → `/provider/application-status` hub | Optional: show hub "X of 9" count (EXISTS BUT NEEDS WIRING) | Keeps setup visible without duplication |
| Support entry | IMPLEMENTED | `SupportContactLink` in `ProviderLayout` | None | Trust and retention |
| Earnings preview (honest "coming soon") | IMPLEMENTED | `earningsPreview` | Payments themselves OUT OF SCOPE / FUTURE | Signals future value truthfully |

## Required capability inventory

| Capability | Current truth | Existing source/API/UI | Reuse strategy | New work needed | Pilot evidence needed | Provider conversion value | Future org compatibility |
|---|---|---|---|---|---|---|---|
| Provider approval state | IMPLEMENTED | `GET /providers/application/status`; Activation Hub | Consume as-is | None | None | Clarity → activation | Org-scoped review queues later |
| Activation checklist | IMPLEMENTED | `GET /providers/me/activation-status`; hub checklist | Hub stays canonical; dashboard links to it | None | None | No provider ever guesses next step | Org onboarding views later |
| Verification submission/resubmission | IMPLEMENTED | `/me/verification` + hub recovery flow | Reuse as-is | None | None | Trust signal | Org-managed credentials later |
| Service areas | IMPLEMENTED | #12 coverage APIs + portal page | Reuse as-is | None | None | Bad-fit prevention | Org territory management later |
| Travel/setup buffers | IMPLEMENTED | #12 buffer rules in slot generation | Reuse as-is | None | None | Realistic schedules | Workforce routing later |
| Services | IMPLEMENTED | `/me/services` + portal page | Reuse as-is | None | None | Bookable catalog | Org service catalogs later |
| Availability (weekly recurring) | IMPLEMENTED | `/me/availability` + portal page | Reuse as-is | None | None | Accurate booking times | Workforce scheduling later |
| Booking page publishing | IMPLEMENTED | #11 publish/unpublish + eligibility | Reuse as-is | None | None | One professional link | Branded org pages later |
| Copy/share/QR | IMPLEMENTED | `BookingPageCard`, share actions, QR | Reuse as-is | None | None | Converts existing audience | Org campaign tools later |
| Upcoming bookings | IMPLEMENTED | dashboard payload + bookings page | Reuse as-is | None | None | Daily organization | Org-wide calendars later |
| Rescheduling | IMPLEMENTED | `routes/reschedule.ts` state machine + modal | Reuse as-is; surface pending count on dashboard | Small wiring | Weekly-review friction reports | Fewer lost bookings | Org rebooking policies later |
| Cancellation | IMPLEMENTED | #13 allowlisted-reason flow | Reuse as-is | None | None | Clear client experience | Org policies later |
| No-show marking | IMPLEMENTED | #13 eligible-state flow | Reuse as-is | None | None | Honest outcome records | Org attendance policy later |
| Support contact | IMPLEMENTED | `GET /support/contact` + link component | Reuse as-is | None | None | Trust | Org escalation path later |
| Booking source attribution | IMPLEMENTED | allowlisted `source` + provider chart | Reuse as-is | None | None | Sharing feedback loop | Org campaign attribution later |
| Provider-owned metrics | IMPLEMENTED | `/me/dashboard` + `/me/metrics` | Reuse as-is | Trends = NEEDS NEW BUILD (small queries) | Providers asking "am I improving?" | Reason to continue | Org-scoped metrics later |
| Availability exceptions | FUTURE / DEFERRED | none (ledger row) | Extend existing engine — never a second one | New model + API + UI + slot integration | Block-off/emergency demand in weekly reviews | Schedule protection | Workforce exceptions later |
| Appointment reminders | FUTURE / DEFERRED | none | Consent + delivery design first | Notification infrastructure | Reminder demand validated (existing decision rule) | Fewer no-shows (hypothesis) | Org comms later |
| Payments | OUT OF SCOPE (this phase) / FUTURE | honest earnings preview only | — | Full payments program | Pilot closure + provider willingness | Monetization | Org billing later |
| Offers/notices (engagement) | FUTURE / DEFERRED | none | Design-only constraints recorded | Consent, caps, moderation, audit | Retention evidence + provider requests | Repeat bookings | Org-approved campaigns later |
| Organization/workspace scope | FUTURE / DEFERRED — NOT IMPLEMENTED | none | Boundary doc only | Entire tenancy model | Real org customer demand post-pilot | Second commercial path | Is the future path |

## Metrics classification (Section 6 requirement)

- **Available from current data (shipped):** bookings this period, completed,
  upcoming, cancellation rate, no-show rate, completion rate, repeat-client
  signal, source mix — all owner-scoped with honest empty states.
- **Requiring new API/query work:** period-over-period trends; per-service
  breakdowns; pending-reschedule count on dashboard.
- **Requiring future analytics/event design:** on-time rate (start times not
  tracked), true append-only activity history, page-view/share-click funnel.

## Verified deferred/limitation notes

- Activity timeline reflects latest booking state only (no event persistence
  today) — never present it as a full history.
- Rates render honest empty states below meaningful volume (shipped rule);
  any new metric must follow it.
- The graph artifacts (baseline `96b7102`) predate PR #64; hub findings in
  this inventory were verified directly against source, and the standing
  post-merge Graphify refresh TODO remains open.
