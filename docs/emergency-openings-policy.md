# Emergency Openings Policy — One-Off Extra Slots

> Status: implemented (`feat/emergency-openings`). Append-only — add dated
> sections below; do not rewrite history.

## Goal

Let providers open **one-off extra time windows** outside their normal weekly
hours for urgent or exceptional visits, without changing their recurring
schedule. Clients simply see more available times on the booking page.

## Definitions

- **Weekly window** — a recurring `availability` row
  (`dayOfWeek`, `startTime`, `endTime`), unchanged by this feature.
- **Emergency opening** — a `provider_emergency_openings` row: one calendar
  `date` (YYYY-MM-DD, marketplace timezone) plus a wall-clock window
  (`startTime` < `endTime`, same "HH:MM" format as weekly windows).
  Optionally restricted to specific own active services (`serviceIds`;
  NULL/empty = all) and optionally labeled `urgentOnly`.
- **Urgent-only** — a truthful, client-facing label added by the provider.
  It changes NOTHING about the booking flow, price, or rules. No fake
  urgency: the label is shown only because the provider explicitly set it.

## Interaction rules (decided)

1. **One engine.** Openings are a second *source* of bookable time consumed
   by the SAME slot generator and the SAME enforcement helper
   (`generateEffectiveSlotsForDate`, `isWithinEffectiveAvailability` in
   `artifacts/api-server/src/lib/availability.ts`). No second scheduling
   engine exists.
2. **All existing rules still apply.** Overlap prevention (advisory lock +
   partial unique index), travel/setup buffers, service-area eligibility,
   duplicate protection, and the booking state machine are enforced
   unchanged for bookings landing inside an opening.
3. **Additive only.** An opening never widens, narrows, or overrides a
   weekly window; a time offered by both sources is offered once. A slot is
   labeled urgent-only ONLY when no weekly window or non-urgent opening also
   offers it.
4. **Service restriction.** An opening restricted to services generates
   slots and passes enforcement only for those service ids.
5. **Reschedules.** Client/provider reschedule proposals and provider
   reschedule actions may land inside an opening (same effective-availability
   check as creation). Proposal lazy-expiry feasibility also considers
   openings, so an opening-hosted appointment is not misclassified as
   infeasible.
6. **Deletion guard (conservative by design).** Deleting an opening is
   rejected with an honest 409 when ANY active booking
   (requested/confirmed/rescheduled) overlaps the opening's window on that
   date — even if that booking would also fit a weekly window. Deleting an
   opening never cancels or moves appointments. Known limitation: the guard
   may be stricter than strictly necessary; acceptable at pilot scale.
7. **DST.** Same rules as weekly windows: nonexistent or ambiguous local
   start times are omitted, never duplicated.

## Data model

`provider_emergency_openings`
(`docs/migrations/PROVIDER_EMERGENCY_OPENINGS_V1.sql`, additive,
disposable-PG tested, restore-based rollback):

| column | type | notes |
| --- | --- | --- |
| id | serial PK | |
| provider_id | integer FK → provider_profiles ON DELETE CASCADE | |
| date | text | "YYYY-MM-DD", marketplace timezone |
| start_time / end_time | text | "HH:MM" 24h, start < end |
| service_ids | integer[] NULL | NULL/empty = all active services |
| urgent_only | boolean NOT NULL default false | label only |
| created_at | timestamp NOT NULL default now() | |

Index: `(provider_id, date)` — the lookup used by slot generation and every
enforcement path.

## API (owner-scoped, auth-gated: approved provider)

Under the existing availability surface (`/api/providers/me/availability`):

- `GET /providers/me/availability/emergency-openings` — upcoming only
  (date ≥ today in marketplace timezone), ordered by date + start.
- `POST /providers/me/availability/emergency-openings` — validates: real
  calendar date, today-or-later, ≤ 365 days ahead, HH:MM times with
  start < end, `serviceIds` ⊆ own ACTIVE services, no overlap with an
  existing opening on the same date (409).
- `DELETE /providers/me/availability/emergency-openings/:id` — 404 when not
  owned (non-leaking); 409 `bookings_exist` with honest guidance when active
  bookings overlap the window.

Public surface: `GET /providers/:providerId/slots` now includes opening
slots for the requested service and returns an additive per-slot
`urgentOnly` flag. No other public shape changed.

## UI

`/provider/availability` → "Emergency openings" section
(`artifacts/web/src/components/emergency-openings-section.tsx`): upcoming
list with per-row delete (server errors surfaced verbatim), and a
mobile-first create form (date, time window, optional service restriction,
optional urgent-only label with truthful explainer). Client booking modal
labels urgent-only slots with a small "Urgent" tag and one caption line —
no other flow change.

## Test strategy

- API (`emergency-openings.integration.test.ts`, live-server): authn/authz,
  ownership (non-leaking 404), validation table, same-date overlap 409,
  upcoming-only list, public slots inclusion + urgent labeling + service
  restriction, booking inside an opening succeeds, booking outside both
  sources still 400, delete guard 409 → cancel → delete succeeds.
- Web (`emergency-openings.test.tsx`): list/empty/loading states, create
  payload normalization, delete + honest 409 error surfacing, urgent badge,
  axe scan.

## Open questions / deferred

- Listing-preview (`GET /providers/me/listing-preview`) slot preview remains
  weekly-windows-only (documented candidate preview; openings appear on the
  real public slots endpoint). Revisit if providers ask.
- No recurrence, no capacity > 1, no client notifications on new openings —
  all out of scope until pilot evidence.
- Blocked dates / vacation ranges interaction is defined in
  `docs/availability-exceptions-policy.md` (vacation ranges work): a blocked
  date and an emergency opening are mutually exclusive at write time.
