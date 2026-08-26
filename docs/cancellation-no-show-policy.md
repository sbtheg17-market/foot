# Cancellation and no-show policy + minimal support workflow (roadmap #13)

**Implemented:** 2026-08-26 · **Branch:** `feat/cancellation-no-show-policy` ·
**Spec:** `docs/roadmap-13-cancellation-no-show-continuity.md` (draft PR #51).
Server-authoritative, conversion-first: the server decides every outcome; the
UI presents it honestly. Payments/refunds/fees remain DEFERRED — a "late"
cancellation is recorded, never charged.

## Provider promise

> Clients and providers know exactly what happens when plans change.
> Cancellations and no-shows are handled fairly, recorded clearly, and
> supported when issues arise.

## Policy

- **Notice window:** centrally managed, default **24 hours**. Environment
  override `CANCELLATION_NOTICE_HOURS` (integer 0–168) is validated at use —
  an invalid value throws (`InvalidCancellationNoticeError`), never a silent
  fallback (same posture as `TRAVEL_SETUP_BUFFER_MINUTES`).
- **Client cancellation:** within notice → `client_cancelled_early` (free);
  inside the window (or after the time) → `client_cancelled_late` (recorded
  as late; no fee — fees are deferred). The boundary instant itself is EARLY.
- **Provider cancellation:** always `provider_cancelled` — never penalizes
  the client. Requires an allowlisted structured `reasonCategory`
  (`illness`, `emergency`, `schedule_conflict`, `client_request`,
  `declined_request`, `reschedule_declined`, `other`). The category is shared
  with the client; free-text `cancellationReason` stays support/admin-only.
- **Support cancellation/correction:** `cancelled_by_support`.
- **No-show:** provider-only, from `confirmed` only (existing state machine),
  and — new #13 server rule — only **after** the scheduled time has passed.
  Recorded with actor (`no_show_marked_by`) and timestamp
  (`no_show_marked_at`). Never applies to `rescheduled` bookings (gate
  preserved). Does not alter payment state (payments deferred).

All boundary math is pure UTC-instant arithmetic (DST-safe); unit-tested
across the 2026 North American DST transitions.

## Cancellation categories (stable identifiers)

```
client_cancelled_early
client_cancelled_late
provider_cancelled
cancelled_by_support
```

Stored on `bookings.cancellation_category` and in the append-only history.

## Append-only outcome history

`booking_outcome_history` (mirrors the rescheduling-history pattern): booking,
actor (user id + role), action (`cancelled` / `no_show` / `support_corrected`),
category, allowlisted `reason_category`, private `reason_snapshot`,
previous/new status, `created_at`. Application code never UPDATEs or DELETEs
rows; every outcome write appends exactly one row in the same transaction as
the booking write. Support corrections append — the original outcome row is
preserved forever.

## API

- `PATCH /bookings/:id/status` — extended: computes/records the category on
  `cancelled`; enforces provider `reasonCategory`; enforces the no-show
  time-passed rule; appends the history row transactionally.
- `GET /bookings/:id/cancellation-preview` — owner-scoped honest preview
  (`free` / `late` / `provider` / `unavailable`, notice hours, `freeUntil`,
  calm copy).
- `GET /bookings/:id/outcome-history` — owner-scoped, newest first.
  Cross-party redaction: `reasonSnapshot` and `actorUserId` are admin-only.
- `POST /support/escalations` — either party of a **terminal** booking
  (cancelled/no_show/completed) opens a dispute; creates a `support_tickets`
  row linked via the new nullable `booking_id`. Idempotent: an unresolved
  escalation for the same booking+user is returned as-is (200), never
  duplicated.
- `GET /support/bookings/:bookingId/escalations` — support/admin only;
  tickets + FULL outcome history (including private fields); audit-logged.
- `PATCH /support/escalations/:ticketId` — support/admin only; updates state
  (`open` / `in_progress` / `resolved`), records a mediation outcome note
  (support message, not full chat), optionally corrects a disputed
  cancelled/no_show outcome to `completed` or `cancelled` (mandatory reason,
  `support_corrected` history row), and can trigger the existing suspension
  mechanism (`users.is_active = false`) for a party to the linked booking.
  Audit-logged.

Public booking pages expose ONLY `cancellationPolicy: { noticeHours, summary }`
(plain language). No dedicated support dashboard exists — the support surface
is the API, by design.

## Privacy rules

Never exposed cross-party or publicly:

- private free-text reasons (`cancellation_reason`, `reason_snapshot`);
- actor user ids in history (`actorUserId`, `no_show_marked_by` is stripped
  from client booking projections);
- support tickets, messages, and admin notes (admin role required; regular
  clients/providers receive 403);
- care notes (existing redaction preserved);
- internal state identifiers on public pages (only `noticeHours` + summary
  copy are public);
- non-owner booking access stays a non-leaking 404 ("Booking not found.").

## Schema / migration

Frozen additive artifact: `docs/migrations/CANCELLATION_NO_SHOW_SUPPORT_V1.sql`
— one enum (`booking_outcome_action`), one append-only table
(`booking_outcome_history` + index), three nullable `bookings` columns
(`cancellation_category`, `no_show_marked_by`, `no_show_marked_at`), one
nullable `support_tickets.booking_id` FK. No destructive DDL, no cascade
deletes, no DOWN (restore-based rollback per
`docs/managed-db-release-gate.md`). Existing bookings remain safely
unconfigured (NULLs) until a cancellation path touches them. Tested against
disposable PostgreSQL only; the managed database was NOT accessed.

## Integration guarantees preserved

- Cancellation resolves pending reschedule proposals (existing behavior,
  regression-tested).
- A cancelled/no-show booking frees the slot and the #12 travel buffer
  (terminal statuses never block bookings — existing behavior).
- Consent-first rescheduling semantics and #12 service-area/buffer behavior
  are unchanged.

## Tests

- `cancellation-policy.test.ts` — pure unit: env validation, boundary math
  (incl. DST), role mapping, allowlist, public-copy safety (25 tests).
- `cancellation-no-show.integration.test.ts` (`test:cancellation`, wired into
  the CI `api-tests` job): early/late/provider cancellation, no-show rules,
  authorization + non-leak 404s, double-cancel + concurrent cancels,
  append-only history + redaction, escalation lifecycle, support corrections,
  suspension, public policy exposure, reschedule-proposal resolution
  (22 tests).
- Web: `cancellation-policy-notice.test.tsx` (copy, variants, no internal
  identifiers, axe) + updated public-booking fixtures.

## Deferred (unchanged from the continuity spec)

Payments/refunds/fees/deposits; reminder/notification delivery; routing /
geocoding / maps; discovery/ranking changes; automated no-show detection;
reliability scoring; support SLAs/queues/assignment; dedicated support UI.
