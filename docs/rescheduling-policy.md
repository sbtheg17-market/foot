# Rescheduling policy — current behavior and final product policy

**Status:** Current behavior audited from code on 2026-08-23. Final policy items are
**Recommended** unless explicitly marked **Approved**. No runtime, schema, API, or
notification behavior is changed by this document.
**Scope:** Roadmap item 9. Complements `docs/booking-statuses.md`,
`docs/rescheduling-history-design.md`, `docs/booking-overlap-policy.md`, and
`docs/service-area-travel-policy.md` without superseding their approval gates.

---

## Part 1 — Current behavior (verified against code)

Source of truth inspected:

- State machine: `artifacts/api-server/src/lib/booking-state-machine.ts`
  (`ALLOWED_TRANSITIONS`, `TERMINAL_STATUSES`, `isTransitionAllowed`).
- Endpoint: `PATCH /api/bookings/:bookingId/status` in
  `artifacts/api-server/src/routes/bookings.ts`.
- Availability/timezone: `artifacts/api-server/src/lib/availability.ts`
  (`getMarketplaceTimezone`, `isWithinAvailability`, default `America/Toronto`,
  override `MARKETPLACE_TIMEZONE`).
- Web client UI: `artifacts/web/src/components/ui/reschedule-modal.tsx`,
  `artifacts/web/src/pages/booking-detail.tsx`, `artifacts/web/src/pages/bookings.tsx`.
- Web provider UI: `artifacts/web/src/pages/portal/bookings.tsx`.
- Mobile UI: `artifacts/mobile/components/reschedule-modal.tsx`,
  `artifacts/mobile/app/booking/[id].tsx`, `artifacts/mobile/app/(tabs)/bookings.tsx`.
- Notifications: `artifacts/api-server/src/lib/push-notifications.ts`,
  `artifacts/api-server/src/lib/notification-bus.ts`.

### State machine (exact current state names)

Statuses: `requested`, `confirmed`, `completed`, `cancelled`, `rescheduled`, `no_show`.

| From | To | Client | Provider | Admin |
|---|---|---|---|---|
| `requested` | `confirmed` | no | yes | yes |
| `requested` | `cancelled` | yes | yes | yes |
| `confirmed` | `completed` | no | yes | yes |
| `confirmed` | `cancelled` | yes | yes | yes |
| `confirmed` | `rescheduled` | yes | yes | yes |
| `confirmed` | `no_show` | no | yes | yes |
| `rescheduled` | `confirmed` | no | yes | yes |
| `rescheduled` | `cancelled` | yes | yes | yes |

`completed`, `cancelled`, and `no_show` are terminal. Admin bypasses the transition
table entirely (`isTransitionAllowed` returns `true` for `admin`).

### Client reschedule request

- The client sends `PATCH /api/bookings/:bookingId/status` with
  `{ status: "rescheduled", scheduledAt: <ISO instant> }` from a `confirmed` booking.
- **The new time is applied immediately and atomically.** Inside one transaction the
  server: locks the booking row (`SELECT … FOR UPDATE`), re-checks ownership and
  `isTransitionAllowed` against the locked status, validates that `scheduledAt` is a
  parseable future instant, that the booking's service still exists and `isActive`,
  that the full service duration fits one availability window evaluated as wall-clock
  time in the marketplace timezone, takes the provider advisory lock
  (`pg_advisory_xact_lock(42001, providerId)` — the same lock `POST /bookings` uses),
  rejects a same-client active duplicate tuple (409, friendly duplicate message), and
  rejects cross-client provider overlap (409, friendly unavailable message). The DB
  partial unique index `bookings_active_booking_unique_idx` remains the race safety net;
  a violation is mapped to the same friendly 409 without leaking PostgreSQL internals.
- The booking then holds status `rescheduled` **with the new `scheduledAt` already
  written**. There is no proposal record, no pending time, and the original time is not
  retained anywhere (no history table exists — see
  `docs/rescheduling-history-design.md`, design only).
- UI: web and mobile modals allow **server-provided slots only**
  (`GET /api/providers/:providerId/slots?serviceId&date`, marketplace-timezone labeled);
  no free datetime entry. Picking the current appointment time is blocked client-side.

### Provider confirmation (reconfirmation)

- From `rescheduled`, only the provider (or admin) may transition to `confirmed`.
- Reconfirmation **cannot change the time**: `scheduledAt` in the request body is only
  applied when `status === "rescheduled"`. `rescheduled → confirmed` is a pure status
  transition.
- On `confirmed`, an invoice is inserted with `onConflictDoNothing`, so a
  `confirmed → rescheduled → confirmed` cycle keeps the original invoice.

### Provider decline

- There is **no decline verb**. A provider who does not accept a client's rescheduled
  time can only: cancel the booking (`rescheduled → cancelled`, requires
  `cancellationReason` for non-admin), or counter-reschedule after reconfirming
  (`rescheduled → confirmed → rescheduled`). The client's requested time remains the
  booking's live time until one of those happens.

### Provider-initiated rescheduling

- A provider sends the same `PATCH …/status` with `status: "rescheduled"` from
  `confirmed`. The same validation set runs.
- **The client's confirmed time is overwritten immediately, without client
  consent.** The booking moves to `rescheduled` and the provider can then reconfirm
  it themselves (`rescheduled → confirmed` is provider-allowed), completing a
  unilateral time change. The client's only lever is `rescheduled → cancelled` or
  `confirmed → cancelled`/`rescheduled` after the provider reconfirms.
- This is the single largest gap between current behavior and the recommended policy.

### Reconfirmation, cancellation, no-show

- Cancellation: `requested|confirmed|rescheduled → cancelled` by either party;
  `cancellationReason` required for non-admin; `cancelledBy` is recorded. Terminal.
- No-show: provider-only, `confirmed → no_show`. Note `no_show` is **not** reachable
  from `rescheduled` — an unreconfirmed rescheduled booking cannot be marked no-show.
  Terminal. No fees, penalties, or dispute flow exist.
- No client-side no-show marking, no disputed-no-show state.

### Notification behavior

- Best-effort Expo push after commit (`void sendPushToUser`; bounded retry with
  redacted logging). Client reschedule → pushes provider; provider reschedule →
  pushes client with the new time; confirm/cancel push the counterparty. SSE exists
  for new bookings (provider portal). Delivery failure never rolls back a booking
  write. No reminders, no deadlines, no scheduled notifications, no email/SMS
  (deferred), no client-side notification persistence.

### Authorization

- `requireAuth` + `requireApprovedProviderIfProvider`; role from server-confirmed
  `req.authz.activeRole`. Clients must own the booking (`clientId === user.sub`);
  providers must own it through their approved provider profile; admin unrestricted.
  Non-owned bookings: 403 on status writes, 404/403 on reads.

### Time ownership (current)

- `bookings.scheduledAt` is the single authoritative time. **The last successful
  reschedule wins immediately, regardless of who initiated it.** There is no
  proposed/pending time and no snapshot of the previous time.

### Stale or concurrent requests (current)

- The row lock serializes concurrent transitions; the loser re-reads the updated
  status and fails `isTransitionAllowed` → 409
  ("…the status may have changed. Please refresh and try again.").
- Reschedule races against booking creation are serialized by the shared provider
  advisory lock; duplicate tuples are additionally caught by the partial unique index.
- There is no idempotency key; a retried identical reschedule of a now-`rescheduled`
  booking fails the transition check (409) rather than double-applying.

---

## Part 2 — Final policy decisions (recommended; approval-gated)

Optimization intent: low client friction; provider control without unilateral
surprise; transparent deadlines; original appointment preserved when possible;
trust during provider-initiated changes; no weakening of authorization,
availability checks, auditability, or user consent.

1. **Do provider-initiated changes require client confirmation?** — **Recommended: yes.**
   A provider's proposed new time must not replace the confirmed time until the client
   confirms, unless the client has explicitly opted into provider-controlled
   scheduling. The current data model has **no proposal state; do not add one in this
   session** — this is a required future implementation decision
   (request-table model in `docs/rescheduling-history-design.md`). Until then, the
   documented current behavior (immediate overwrite + client cancel right) stands.
2. **What happens if a client does not respond?** — **Recommended:** reminder before
   the deadline; **no automatic acceptance**; after the deadline, preserve the original
   appointment if still feasible; otherwise route to manual support/provider
   resolution. Never silently cancel or silently move. Exact deadline value:
   **Unresolved (operator approval required).**
3. **Can a provider reschedule multiple times?** — **Recommended: yes**, while the
   booking remains eligible, each pass re-running full validation, with a clearly
   communicated limit or manual-review threshold. Exact count: **Unresolved.**
   Current: unbounded via `rescheduled → confirmed → rescheduled` cycles.
4. **Can a client reschedule after a provider proposal?** — **Recommended: yes** —
   accept, decline, request another eligible time, or contact support. Simultaneous
   conflicting proposals must be serialized by a concurrency rule (single pending
   proposal per booking, or stale-proposal 409). Current: from `rescheduled` a client
   can only cancel.
5. **Cancellation consequences?** — **Recommended:** explicit role-aware rules;
   provider-caused changes get a client-friendly (penalty-free) cancellation path;
   `cancellationReason` + `cancelledBy` retained (already current); no cancellation
   destroys history. Fee schedule: **Deferred** (payments not live).
6. **Refund/payment consequences?** — **Deferred.** Payments are design-only
   (`docs/payments-foundation.md`); invoices are `pending` placeholders. No automatic
   refunds exist and none must be implied. Refund policy is a dependency of the
   payments slice.
7. **Notification deadlines?** — **Recommended:** immediate notification on
   proposal/request (current, best-effort); reminder before expiry; visible in-app
   pending state with a clear deadline. Reminder scheduling infrastructure does not
   exist — **do not implement without approval**. Values: **Unresolved.**
8. **No-shows?** — see the no-show section below. Current: provider-only
   `confirmed → no_show`, terminal, no consequences. Client/provider/disputed
   variants: **Unresolved.**
9. **Who owns the final appointment time?** — **Recommended rule:** the confirmed time
   belongs to the booking, not permanently to either party; a time becomes
   authoritative only after the required workflow transition succeeds (today: the
   validated `rescheduled` write; future: proposal acceptance). Current rule: last
   successful validated reschedule wins immediately.
10. **Requested time no longer available?** — Current and recommended: reject with the
    friendly 409 (`duplicate`/`provider unavailable`) or availability 400; UI refreshes
    slots and prompts a new pick (web toast / mobile alert already do this). Never
    hold/steal a slot before validation succeeds.
11. **Provider becomes unavailable?** — **Recommended:** provider proposes a new time
    (consent flow per item 1) or cancels with reason; client gets penalty-free
    cancellation; if availability windows changed so the slot no longer fits, the
    booking keeps its time until an explicit transition (current behavior — windows are
    validated at write time only). **Unresolved:** whether availability edits should
    flag already-booked conflicts.
12. **Change caused by travel/service-area feasibility?** — **Deferred.** No
    service-area or travel-buffer enforcement exists
    (`docs/service-area-travel-policy.md`, design only). When approved, feasibility
    failures should follow the provider-unavailable path (item 11), never a silent move.
13. **How are repeated changes shown to the user?** — **Recommended:** concise
    chronological change summary (localized time, actor label, approved reason) once
    the approved history table exists. Current: **not shown** — only the live time is
    stored; prior times are unrecoverable. Requires the history implementation
    (**Deferred** to the approved history slice).
14. **Escalation path for disputes?** — **Recommended:** existing support tickets
    (`POST /api/support/tickets`) as the manual path, referenced from reschedule
    failure/expiry states; admin can force transitions as the operator override.
    Dedicated dispute tooling: **Deferred.**

---

## Part 3 — Recommended rescheduling policy (default recommendation)

### Ownership of time
The confirmed appointment time belongs to the booking, not permanently to either
party. A final time becomes authoritative only after the required workflow
transition succeeds. **Recommended.**

### Client-initiated change
Client requests a new available time; server validates ownership, availability,
future time, provider overlap, service validity, and any approved service-area rules;
in the current immediate-acceptance workflow the change applies atomically; a history
event becomes required once the history implementation is approved; notifications are
best effort and never reverse a successful update. **This matches current behavior**
(except history, which does not exist yet). **Recommended.**

### Provider-initiated change
Provider proposals require client confirmation. Until the client confirms: retain the
existing confirmed time; mark the proposal pending; never silently overwrite; notify
the client; provide a deadline and a safe fallback. **The current data model does not
support a proposal state — not added in this session; documented as a required future
implementation decision** (see `booking_reschedule_requests` in
`docs/rescheduling-history-design.md`). **Recommended / implementation Deferred.**

### Client non-response
Reminder before deadline; no automatic acceptance; after the deadline preserve the
original appointment when feasible, else manual support/provider resolution; never
silently cancel or move. Deadline value requires operator approval. **Recommended /
values Unresolved.**

### Multiple changes
Allowed while the booking is eligible; every change passes full validation (current);
a clearly communicated limit or manual-review threshold, never a hidden one; each
accepted change preserved in immutable history once history exists. Exact count
requires approval. **Recommended / count Unresolved.**

### Client after provider proposal
Client may accept, decline, request another eligible time, or ask support. No
conflicting simultaneous proposals without a concurrency rule. **Recommended /
implementation Deferred (requires proposal state).**

### Cancellation and refunds
Explicit role-aware rules; client-friendly cancellation for provider-caused changes;
refund consequences deferred until payments are implemented and approved; no implied
automatic refunds; no cancellation destroys history. **Recommended / refunds Deferred.**

### Notification deadlines
Immediate notification (current), reminder before expiration, visible in-app pending
state, clear deadline display, safe fallback after expiration. Reminder scheduling is
**not implemented** and must not be built without existing infrastructure plus
explicit operator approval. **Recommended / Deferred.**

### No-shows
Defined separately, all **Unresolved** pending operator approval; no penalties, fees,
or refunds before an approved payment and cancellation policy:

- **Client no-show** — current: provider marks `confirmed → no_show` (terminal).
  Recommended: keep provider marking; add a grace-period guideline and evidence note;
  consequences deferred.
- **Provider no-show** — current: **no state exists**; client can only cancel.
  Recommended: client-reportable provider no-show routed to support; penalty-free
  client outcome; consequences deferred.
- **Disputed no-show** — current: none. Recommended: support-ticket escalation with
  admin transition override as the resolution mechanism.
- **Access/address problem** — current: free-text address only. Recommended: treat as
  disputed/no-fault category via support; interacts with the deferred service-area
  policy.
- **Travel-feasibility failure** — **Deferred** with service-area/travel enforcement.

---

## Part 4 — Policy decision table

Statuses used: `Current` (verified behavior), `Recommended` (this document),
`Approved` (explicit operator approval — none granted here), `Unresolved`
(operator decision required), `Deferred` (blocked on another workstream).

| # | Scenario | Current behavior | Recommended behavior | Who acts | Final time owner | Notification | Timeout | Cancellation consequence | Refund dependency | Audit/history requirement | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Client reschedules confirmed booking | Immediate validated overwrite; status → `rescheduled` | Keep immediate acceptance | Client, then provider reconfirms | Booking (validated write) | Push to provider, best effort | None | Either party may cancel with reason | Deferred (no payments) | History row once approved | Current + Recommended |
| 2 | Provider reconfirms rescheduled time | `rescheduled → confirmed`, time unchanged | Keep; invoice preserved | Provider | Booking | Push to client on confirm | None | — | Deferred | History row optional (reconfirmation ≠ time change) | Current + Recommended |
| 3 | Provider declines client's new time | No decline verb; cancel or counter-reschedule | Add explicit decline with restore-original once proposal state exists | Provider | Booking | Push to client | Unresolved | Reason required | Deferred | Required | Recommended / Deferred |
| 4 | Provider-initiated time change | Immediate overwrite, no client consent | Pending proposal; original time retained until client confirms | Provider proposes, client decides | Booking (after client confirm) | Push + in-app pending state | Unresolved deadline | Client-friendly cancel path | Deferred | Required | Recommended / Deferred (needs proposal state) |
| 5 | Client ignores provider proposal | N/A (no proposal state) | Reminder; no auto-accept; preserve original if feasible; else support | System/support | Booking (original preserved) | Reminder push | Unresolved | No silent cancel/move | Deferred | Required | Recommended / Unresolved |
| 6 | Repeated reschedules | Unbounded via reconfirm cycles | Allow while eligible; communicated limit/review threshold | Either | Booking | Push each change | None | — | Deferred | Immutable history once approved | Recommended / count Unresolved |
| 7 | Requested time taken/duplicate | 409 friendly message; UI re-picks slot | Keep | Requester | Booking (unchanged) | None (synchronous error) | None | — | — | No history row on rejection | Current + Recommended |
| 8 | Service deactivated before reschedule | 409 "service no longer offered"; cancel-and-rebook | Keep | Requester | Booking (unchanged) | None | None | Cancel with reason | Deferred | — | Current + Recommended |
| 9 | Concurrent/stale transition | Row lock; loser gets refresh 409 | Keep; add idempotency key with history slice | Either | Booking | None | None | — | — | Stale approvals must never write history | Current + Recommended |
| 10 | Client cancels (any active state) | `→ cancelled`, reason + `cancelledBy` recorded | Keep; fee schedule deferred | Client | — | Push to provider | None | Terminal | Deferred | Cancellation never destroys history | Current + Recommended |
| 11 | Provider cancels | Same as above, mirrored | Keep; client-friendly messaging for provider-caused | Provider | — | Push to client | None | Terminal | Deferred | Same | Current + Recommended |
| 12 | Client no-show | Provider marks `confirmed → no_show`, terminal, no penalty | Keep marking; consequences deferred | Provider | — | None currently | Unresolved grace period | Terminal | Deferred | Required once history exists | Current / consequences Unresolved |
| 13 | Provider no-show | No state; client can only cancel | Client-reportable, support-routed, penalty-free for client | Client → support | — | Support flow | Unresolved | Penalty-free client cancel | Deferred | Required | Recommended / Unresolved |
| 14 | Disputed no-show | None | Support ticket + admin override | Support/admin | — | Support flow | Unresolved | Case-by-case | Deferred | Required | Recommended / Unresolved |
| 15 | Travel/service-area infeasibility | Not evaluated | Provider-unavailable path; never silent move | Provider/system | Booking | Push | Unresolved | Client-friendly | Deferred | Required | Deferred (item 7 policy) |
| 16 | Reschedule history shown to users | Not possible (no storage) | Chronological localized summary per approved design | — | — | — | — | — | — | Append-only history table | Deferred (item 8 design) |
| 17 | Dispute escalation | Support tickets exist; admin can force transitions | Reference support from failure/expiry states | Client/provider → support/admin | Booking | Ticket messages | — | — | Deferred | Admin overrides should be audited | Current + Recommended |

**No item in this table is marked Approved.** Operator approval is required for:
provider-proposal consent workflow and its deadline; reschedule count limit;
no-show taxonomy and consequences; reminder scheduling; history implementation
(model choice already designed); refund/fee schedule (blocked on payments).

---

## Approval gate

This document changes no runtime behavior. Before any implementation of the
recommended policy: approve the proposal-state model, deadlines, limits, no-show
taxonomy, and history slice per `docs/rescheduling-history-design.md`; then implement
behind the existing state machine without weakening validation, authorization, or
concurrency guarantees. Defects found during this audit: **none** — the implementation
matches `docs/booking-statuses.md` exactly; the provider-unilateral-overwrite gap is a
product-policy gap, not a code defect.
