# Availability Exceptions Policy — Blocked Ranges (Vacation / Time Off)

> Status: implemented (`feat/vacation-ranges`). Append-only — add dated
> sections below; do not rewrite history. Companion doc:
> `docs/emergency-openings-policy.md` (one-off EXTRA slots — the additive
> counterpart of this subtractive feature).

## Goal

Let providers block a **continuous date range** (vacation, a course, family
time) in one action instead of day-by-day. Every day in the range offers no
bookable time; clients simply see no slots on those days.

## Definitions

- **Weekly window** — a recurring `availability` row, unchanged by this
  feature.
- **Emergency opening** — a `provider_emergency_openings` row: one-off EXTRA
  bookable time (`docs/emergency-openings-policy.md`), unchanged by this
  feature except for the mutual-exclusion rule below.
- **Blocked range** — a `provider_blocked_ranges` row: an inclusive
  `[startDate, endDate]` pair of calendar dates (YYYY-MM-DD, marketplace
  timezone) during which the provider offers NO bookable time.
- **Reason** — an optional private note (≤ 200 chars) for the provider's own
  memory ("vacation", "course", "family event"). **Internal only: returned
  solely on the owner-scoped endpoints and never rendered on any
  client-facing surface.** Useful for future support/ops if needed.

## Interaction rules (decided)

1. **One engine, subtractive source.** Blocked ranges are consumed by the
   SAME slot generator and the SAME enforcement helper
   (`generateEffectiveSlotsForDate`, `isWithinEffectiveAvailability` in
   `artifacts/api-server/src/lib/availability.ts`): a blocked day yields
   zero candidate slots and rejects every booking/reschedule interval,
   regardless of weekly windows. No second scheduling engine exists.
2. **Honest 409 on active bookings (chosen: reject, never break).** Creating
   a range whose days contain ANY active booking (requested / confirmed /
   rescheduled) is rejected with an honest 409 `bookings_exist` stating how
   many appointments are in the way — the provider must cancel or reschedule
   them first. This matches the emergency-openings delete guard and never
   silently creates a "blocked but still booked" state.
3. **Mutual exclusion with emergency openings (both directions, write
   time).** A range cannot be created over a date that has an emergency
   opening (409 `emergency_opening_conflict`), and an opening cannot be
   created on a blocked date (409 `blocked_range_conflict`). One of the two
   must be deleted first; the error says so explicitly.
4. **No overlapping ranges.** A new range intersecting an existing one is
   rejected with 409 `range_overlap` (inclusive date comparison).
5. **Guard-free deletion.** Deleting a range needs NO booking guard:
   removing time off only RE-OPENS bookable time and can never invalidate an
   existing appointment. (Contrast with openings, whose deletion can strand
   a booking and is therefore guarded.)
6. **All existing rules still apply** on unblocked days: overlap prevention,
   travel/setup buffers, service-area eligibility, duplicates, and the
   booking state machine are unchanged.
7. **Reschedules.** Provider reschedule actions, proposal validation, and
   proposal lazy-expiry feasibility all consult blocked ranges through the
   same effective-availability check. (Feasibility can never actually hit a
   blocked day thanks to rule 2, but the one-engine rule applies uniformly.)
8. **Validation bounds.** `startDate` ≥ today, `startDate` ≤ `endDate`,
   `endDate` within 365 days (marketplace timezone) — same horizon as
   emergency openings.

## Data model

`provider_blocked_ranges`
(`docs/migrations/PROVIDER_BLOCKED_RANGES_V1.sql`, additive,
disposable-PG tested, restore-based rollback):

| column | type | notes |
| --- | --- | --- |
| id | serial PK | |
| provider_id | integer FK → provider_profiles ON DELETE CASCADE | |
| start_date / end_date | text | "YYYY-MM-DD", inclusive, marketplace timezone, start ≤ end |
| reason | text NULL | private provider-only note, ≤ 200 chars, trimmed |
| created_at | timestamp NOT NULL default now() | |

Index: `(provider_id, end_date)` — supports both the covering-date lookup
(`start_date ≤ d AND end_date ≥ d`) used by slot generation / enforcement
and the upcoming list (`end_date ≥ today`).

## API (owner-scoped, auth-gated: approved provider)

Under the existing availability surface (`/api/providers/me/availability`):

- `GET /providers/me/availability/blocked-ranges` — upcoming only
  (`endDate` ≥ today in marketplace timezone), ordered by start date. The
  private reason is included here (owner surface) only.
- `POST /providers/me/availability/blocked-ranges` — validates rule 8;
  rejects with 409 `range_overlap`, `emergency_opening_conflict`
  (+ `openingCount`), or `bookings_exist` (+ `bookingCount`) per rules 2–4.
- `DELETE /providers/me/availability/blocked-ranges/:id` — 404 when not
  owned (non-leaking); no guard (rule 5).

Public surface: `GET /providers/:providerId/slots` returns an empty slot
list on blocked days. No new public field is exposed and the reason never
leaves the owner surface.

## UI

`/provider/availability` → "Time off" section
(`artifacts/web/src/components/blocked-ranges-section.tsx`): upcoming list
with per-row delete (server errors surfaced verbatim) and a mobile-first
create form (first/last day off, optional private note with an explicit
"only you see this" label). Truthful helper copy: blocking is refused with
an honest message when appointments or openings are in the way — nothing is
ever cancelled automatically.

## Test strategy

- API (`vacation-ranges.integration.test.ts`, live-server,
  `test:vacation-ranges`): authn/authz, validation table, trimmed private
  note round-trip, range overlap 409, blocked-day slot suppression +
  restoration after delete, booking on a blocked day → 400
  `outside_availability`, both mutual-exclusion 409s, active-booking 409 →
  cancel → create succeeds, non-leaking foreign 404, guard-free delete.
- Web (`vacation-ranges.test.tsx`): list/empty/loading states, range label
  formatting, private-note rendering only when present, create payload
  normalization (trim / omit empty note), delete flow, honest 409 error
  surfacing (both reasons), axe scan.

## Open questions / deferred

- Listing-preview (`GET /providers/me/listing-preview`) remains
  weekly-windows-only (documented candidate preview) — same deferral as
  emergency openings.
- No recurring time off, no partial-day blocks (use day-by-day weekly edits
  or wait for evidence), no client notifications when a range is created —
  out of scope until pilot evidence.
- Admin/support visibility of the private reason is NOT implemented; if ops
  ever needs it, add an explicitly documented admin surface — never a
  client-facing one.
