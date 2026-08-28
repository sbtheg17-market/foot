# Availability Exceptions Policy (Phase B)

**Status:** Phase B, first slice — **blocked dates only** (beta).
**Date:** 2026-08-29 (append-only; add sections below, never rewrite history).
**Owner surface:** `/provider/availability` (existing Schedule page, evolved — not rebuilt).

## 1. What counts as an availability exception

An availability exception is a **provider-owned, date-scoped override** of the
weekly availability schedule. Two conceptual kinds exist:

| Kind | Meaning | Status |
| --- | --- | --- |
| `blocked` | The provider is not bookable on a specific marketplace-local calendar date (vacation, course, personal day), regardless of weekly windows. | **IMPLEMENTED in this slice** |
| `emergency_open` (or similar) | Extra one-off openings outside the weekly windows. | **DEFERRED — NOT implemented.** Recorded here only so the model leaves room for it. |

Exceptions are **not** a new scheduling engine. They are a thin, additive
filter evaluated by the SAME existing availability/slot engine
(`artifacts/api-server/src/lib/availability.ts`) and the SAME transactional
booking guards. Weekly windows, travel/setup buffers, overlap locks,
duplicate protection, and consent-first rescheduling are unchanged.

## 2. Product rules (blocked dates)

1. **Date semantics.** A blocked date is a calendar date (`YYYY-MM-DD`)
   interpreted in the **effective marketplace timezone**
   (`MARKETPLACE_TIMEZONE`, default `America/Toronto`) — the same wall-clock
   semantics the weekly windows already use. Because a booking never crosses
   a window boundary (overnight windows are unsupported), checking the local
   calendar date of the booking **start** is sufficient.
2. **Blocking is forward-looking only.** Providers may block **today or any
   future date**. Past dates are rejected. Past rows are retained but no
   longer listed (pruning is deferred).
3. **One row per provider per date** (unique index). Re-blocking an already
   blocked date returns `409`.
4. **Optional private reason** (≤ 200 chars). The reason is provider-owned,
   shown only on the provider's own Schedule page. It is **never** exposed on
   any public or client-facing surface.
5. **Truthful public behavior (non-leaking).** On a blocked date the public
   slots endpoint returns the same stable empty-slots shape as a day with no
   weekly windows. Clients simply see no bookable times — no "vacation"
   labels, no reasons, no distinguishable signal that a block exists.
6. **No manipulation.** Blocking a date never creates urgency copy, scarcity
   claims, or ranking effects anywhere.

## 3. Interaction rules with existing systems

### 3.1 Weekly availability
Blocked dates are evaluated **in addition to** weekly windows. A date is
bookable only when (a) a weekly window fits the requested interval AND
(b) the date is not blocked. Weekly windows are never mutated by exceptions.

### 3.2 New bookings (`POST /bookings`)
A requested start whose marketplace-local calendar date is blocked is
rejected `400` with the existing allowlisted reason code
`outside_availability` (no new public reason code; message:
"This provider is not taking bookings on the selected date."). The check
runs server-side after the window-fit check and before any lock/insert.

### 3.3 Existing bookings — NEVER auto-cancelled
Blocking a date **does not** touch bookings that already exist on that date.
The confirmed appointment stays authoritative (same principle as service-area
coverage changes). The provider must use the existing consent-first
rescheduling or cancellation flows. The Schedule page states this explicitly.

### 3.4 Rescheduling (both paths)
A blocked date is an invalid **target** for any time change:
- Legacy direct reschedule (`PATCH /bookings/:id/status` → `rescheduled`).
- Provider reschedule proposals (`validateRescheduleTarget` — checked at
  proposal creation AND at client consent, same as the other target rules).
Original-time feasibility (`isOriginalTimeFeasible`, lazy proposal expiry) is
**intentionally NOT changed**: a block never invalidates an existing
appointment (rule 3.3), so it cannot flip a pending proposal to `unresolved`.

### 3.5 Travel buffers & service area
Unchanged and orthogonal. Buffer and coverage checks continue to run on
every booking/reschedule path; exceptions add one more date-level gate.

### 3.6 Slot generation & previews
- Public `GET /providers/:id/slots?date=` → blocked date returns `slots: []`.
- Owner `GET /providers/me/listing-preview` 7-day slot preview skips blocked
  dates so the provider's own preview matches what clients can book.
- Public `GET /providers/:id/availability` (weekly windows) is unchanged —
  it describes the recurring schedule, not per-date state.

## 4. Data model (implemented)

```
provider_availability_exceptions
  id          serial PK
  provider_id integer NOT NULL → provider_profiles(id) ON DELETE CASCADE
  date        text NOT NULL            -- "YYYY-MM-DD", marketplace-local
  type        availability_exception_type NOT NULL DEFAULT 'blocked'
                                       -- enum('blocked'); room for future values
  reason      text NULL                -- provider-private, ≤ 200 chars
  created_at  timestamp NOT NULL DEFAULT now()
UNIQUE (provider_id, date)
```

Additive only — no existing table, column, enum, index, or row is modified.
Migration: `docs/migrations/PROVIDER_AVAILABILITY_EXCEPTIONS_V1.sql`
(managed-DB release gate applies; tested on disposable local PostgreSQL only).

## 5. API surface (implemented — extends the existing availability group)

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/providers/me/availability/exceptions` | approved provider | Upcoming (today+) blocked dates, ascending |
| POST | `/providers/me/availability/exceptions` | approved provider | `{ date, reason? }` → `201 { exception }`; `400` invalid/past; `409` duplicate |
| DELETE | `/providers/me/availability/exceptions/:exceptionId` | approved provider | Owner-scoped; `404` when not found/not owned |

No new public endpoint. Public/client surfaces only observe the effect
(empty slots / rejected bookings) through EXISTING endpoints and EXISTING
reason codes.

## 6. Privacy & role boundaries

- Exceptions are strictly provider-owned; endpoints use the same
  `requireAuth + requireRole("provider") + requireApprovedProvider` chain as
  the weekly availability endpoints.
- No reasons, counts, or block existence are exposed to clients, admins
  (this slice adds no admin surface), or any public route.

## 7. Feature flagging

The codebase has no existing feature-flag mechanism; inventing one for this
slice was rejected as disproportionate (per continuity guardrails). The
slice ships enabled in the branch and is marked **Phase B beta** here and in
the TODO ledger.

## 8. Deferred (explicitly out of scope for this slice)

- Emergency/extra one-off openings (`emergency_open`).
- Date **ranges** (multi-day vacations are entered per-date for now).
- Partial-day blocks (block a time span, not the whole date).
- Warning UI listing existing bookings on a date being blocked (the page
  carries a truthful static note instead).
- Pruning of past exception rows.
- Admin visibility/reporting of exceptions.
