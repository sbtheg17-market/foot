# Rescheduling history design

**Status:** Design complete; recommendation pending operator approval.  
**Scope:** Roadmap item 8 only. No migration, route, persistence, or UI change is
authorized by this document.

## Current behavior and goals

The existing status endpoint accepts a new `scheduledAt` for an allowed
reschedule and updates the booking inside the existing locked transaction. It
already validates future time, active service, availability, duplicate, and
provider-overlap conditions. It does not retain the original time, proposed
times, requester, reason, or request identifier. `rescheduled → confirmed` is a
reconfirmation, not a new time change.

The goal is an immutable, privacy-aware record of accepted time changes while
leaving `bookings` authoritative for the current time and leaving notification
delivery non-transactional.

## Model comparison

| Model | Benefits | Risks |
|---|---|---|
| Append-only reschedule events | Strong auditability; simple immutable ordering | Proposal/confirmation state is awkward without event interpretation |
| Request table plus history | Models pending proposals, accept/decline/expiry, idempotency cleanly | More tables and state transitions |
| Generic audit log | Reusable for many domains | Weak typed contract, difficult authorization and reconstruction |
| Hybrid request plus append-only history | Explicit workflow plus durable accepted-event audit | Highest initial complexity |

### Recommendation pending approval

Use a **request table plus append-only accepted-history table** if the operator
wants requester/confirmation/decline/expiry semantics. If the current endpoint
is intentionally immediate acceptance, omit the request table and use only an
append-only accepted-history table. Do not silently introduce a proposal
workflow as part of history storage.

## Proposed entities and fields

### `booking_reschedule_requests` (only for proposal workflow)

| Field | Type | Nullability / rule |
|---|---|---|
| `id` | serial/bigint | non-null primary key |
| `booking_id` | FK to bookings | non-null; indexed |
| `request_id` | opaque text/UUID | non-null; unique |
| `original_scheduled_at` | timestamp with timezone | non-null snapshot |
| `proposed_scheduled_at` | timestamp with timezone | non-null |
| `requester_user_id` | FK to users | non-null |
| `requester_role` | enum client/provider/admin | non-null snapshot |
| `status` | enum pending/accepted/declined/expired/cancelled | non-null |
| `reason` | text | nullable only if approved |
| `created_at` | timestamp with timezone | non-null |
| `expires_at` | timestamp with timezone | nullable only if no expiry policy |
| `resolved_at` | timestamp with timezone | nullable until resolved |
| `confirmer_user_id` | FK to users | nullable |
| `decliner_user_id` | FK to users | nullable |
| `notification_outcome` | enum not_requested/pending/sent/failed | non-null default |

### `booking_reschedule_history`

| Field | Type | Nullability / rule |
|---|---|---|
| `id` | serial/bigint | non-null primary key |
| `booking_id` | FK to bookings | non-null; indexed |
| `request_id` | FK/opaque request ID | nullable for immediate legacy acceptance; unique when present |
| `original_scheduled_at` | timestamp with timezone | non-null |
| `replacement_scheduled_at` | timestamp with timezone | non-null |
| `requester_user_id` | FK to users | non-null |
| `requester_role` | enum client/provider/admin | non-null snapshot |
| `confirmer_user_id` | FK to users | nullable for immediate acceptance |
| `decliner_user_id` | FK to users | nullable; history rows normally accepted |
| `reason` | text | nullable only if approved; length-limited |
| `previous_status` | booking-status enum | non-null |
| `new_status` | booking-status enum | non-null |
| `notification_outcome` | enum not_requested/pending/sent/failed | non-null |
| `created_at` | timestamp with timezone | non-null immutable event time |
| `request_created_at` | timestamp with timezone | nullable for legacy immediate acceptance |
| `resolved_at` | timestamp with timezone | nullable for immediate workflow |
| `idempotency_key` | opaque text/UUID | non-null per actor/request scope |

All history fields are immutable. Use UTC instants in storage, preserve an
approved IANA timezone only when the request needs the original wall-clock
context, and display localized values in web/mobile clients. DST tests must cover
nonexistent and repeated local times.

### Indexes and uniqueness

Add, after approval, an index on `(booking_id, created_at DESC, id DESC)` for
bounded newest-first history. Add indexes for `requester_user_id` only if an
approved admin/reporting use requires them. Enforce uniqueness on
`(requester_user_id, idempotency_key)` or the approved request scope, and on
`request_id`. Do not use a uniqueness rule that prevents two legitimate future
requests for the same booking unless the request workflow explicitly requires
one pending request.

Foreign keys should preserve audit readability according to the approved
retention policy: restrict deletion, or use a privacy-reviewed nullable
reference. Never cascade-delete a history row because a user or booking is
removed without an approved retention decision.

## Lifecycle and concurrency

### Immediate-acceptance option

Inside the existing booking row lock and provider serialization:

1. validate ownership, state transition, time, availability, service, duplicate,
   overlap, and approved service-area policy;
2. update the booking;
3. insert exactly one history row in the same transaction;
4. commit; only then attempt best-effort notification delivery.

If the history insert fails, the booking update must roll back. A retry with the
same idempotency key must return the existing accepted result, not append a
second row.

### Proposal option

Create one pending request per approved uniqueness scope. The confirmer/decliner
must lock both the request and booking, re-read current status and scheduled
time, reject stale approvals with a conflict, and atomically resolve the request,
update the booking, and insert the accepted history row. Expired, cancelled, or
already-resolved requests cannot mutate the booking.

Duplicate requests return a stable conflict such as `reschedule_request_exists`.
Concurrent requests serialize on the booking/request lock. A stale approval
returns `409` with a refresh-safe message and never writes history.

Cancelled bookings are terminal: pending proposals are resolved according to the
approved policy, and no new reschedule is accepted. History remains readable
subject to retention and redaction.

## Proposed API

### Immediate acceptance

Keep the existing status write contract for the first approved implementation:

`PATCH /api/bookings/:bookingId/status`

```json
{
  "status": "rescheduled",
  "scheduledAt": "2030-04-15T18:00:00.000Z",
  "reason": "A different time works better."
}
```

The response remains the authorized booking projection. The `reason` field,
notice rules, idempotency header/key, and conflict codes require approval before
OpenAPI changes.

### Proposal workflow, if approved

- `POST /api/bookings/:bookingId/reschedule-requests`
- `GET /api/bookings/:bookingId/reschedule-requests`
- `POST /api/reschedule-requests/:requestId/accept`
- `POST /api/reschedule-requests/:requestId/decline`
- `GET /api/bookings/:bookingId/rescheduling-history`

Example request:

```json
{
  "proposedScheduledAt": "2030-04-15T18:00:00.000Z",
  "reason": "A different time works better.",
  "idempotencyKey": "client-generated-opaque-value"
}
```

Example bounded history response:

```json
{
  "history": [
    {
      "id": 42,
      "bookingId": 7,
      "originalScheduledAt": "2030-04-10T18:00:00.000Z",
      "replacementScheduledAt": "2030-04-15T18:00:00.000Z",
      "requesterRole": "client",
      "reason": "A different time works better.",
      "previousStatus": "confirmed",
      "newStatus": "rescheduled",
      "createdAt": "2030-04-01T15:00:00.000Z"
    }
  ],
  "limit": 20,
  "nextCursor": null
}
```

Use a capped cursor/keyset page rather than unbounded history. The response
must not include full addresses, care notes, coordinates, internal error text,
notification vendor details, or hidden admin metadata.

## Authorization, privacy, and retention

Clients may read history for their own booking; providers may read it for their
owned provider booking; admin access requires explicit approval. Requester,
confirmer, and decliner identities should be reduced to approved role/display
fields, and user contact data must not be serialized. A `404` for an inaccessible
booking avoids confirming its existence.

The operator must approve retention duration, legal hold behavior, deletion or
anonymization of actor references, and whether reasons are user-visible. History
must be append-only through application code: no update/delete route, immutable
columns, and database permissions that prevent ordinary application mutation.

## Notification linkage and failure behavior

History may record notification outcome only as a coarse enum plus approved
timestamps; it must not make delivery a booking transaction prerequisite.
Notification delivery occurs after commit. A failed push/SSE/email attempt (email
and SMS remain deferred) cannot roll back a successful reschedule. Retry,
redaction, and persistence rules belong to the separate notification workstream.
The history record should remain `failed` or equivalent for observability without
exposing vendor errors to clients.

Web and mobile displays should show a concise chronological change summary,
localized date/time, actor label, and approved reason. They should not expose
internal IDs or present a failed notification as a failed reschedule. UI work is
deferred with the implementation.

## Required validation and tests

- original and every replacement time are preserved exactly;
- requester, confirmer, decliner, booking ID, request ID, reasons, statuses, and
  timestamps obey nullability and authorization;
- event ordering is deterministic for equal timestamps;
- repeated idempotency key returns the same result;
- duplicate, concurrent, stale, expired, and cancelled requests are safe;
- no history row for rejected validation, conflict, or reconfirmation;
- accepted update and history insert commit or roll back together;
- DST/timezone display and overnight edge cases;
- client/provider/admin redaction and inaccessible-booking behavior;
- pagination limits and cursor stability;
- notification success/failure linkage without rollback;
- web/mobile response compatibility once UI is implemented.

## Approval gate and explicit non-implementation

Before implementation, approve immediate acceptance versus proposal workflow,
notice windows, maximum reschedules, reasons, expiry, retention, visibility,
idempotency scope, conflict codes, notification outcome semantics, and the
schema/API above. No request table, history table, migration, API route,
OpenAPI change, notification provider, web screen, or mobile screen is created
in this design slice.