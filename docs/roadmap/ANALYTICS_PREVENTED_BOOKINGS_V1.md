# Analytics Design V1 — Prevented Duplicate Bookings

**Status:** DESIGN-ONLY — approved in principle 2026-08-12 with three required
corrections (marketplace_id, event reliability, source-of-truth wording), all
incorporated below. NO code, schema, migrations, endpoints, dashboard UI, or
event-table changes are part of this document. Every implementation step
requires its own separate review and approval.
**Prime references:** `docs/roadmap/EXTENSIBILITY_BLUEPRINT_V1.md` (§10 events
and projections, §12 core/adapter boundary, §13 advisory-only fences),
`.agents/NEXT_TASK.md` (booking invariant and hard-STOP index rule).

---

## §1 Approved counting rule (operator, 2026-08-12 — verbatim, unchanged)

```text
One prevented-booking event = one booking request that reaches the API and
returns HTTP 409 with a numeric bookingId.
```

This counts **API 409 responses** — both the preflight conflict path and the
database Race-Proof index path — reflecting what the client actually
experienced, without exposing database internals. Deduplication may be added
later only if product requirements demand "unique blocked slots" rather than
"blocked booking attempts."

## §2 Event definition (core, domain-neutral)

- **Name:** `booking.duplicate_prevented` · **`schema_version: 1`**
- **Emission point:** the API bookings insert path, at the moment it decides to
  return **HTTP 409 + numeric `bookingId`** — both branches:
  - `preflight` — the sequential duplicate check before insert;
  - `index_violation` — the concurrent race caught by
    `bookings_active_booking_unique_idx` and detected via
    `isActiveBookingDuplicateViolation()`.
  One qualifying request → exactly one event, matching §1.
- **Payload (ids only — no PII, no SQL internals, no raw database errors):**

  | Field | Content |
  |---|---|
  | `marketplace_id` | **REQUIRED, EXPLICIT** — see §3 |
  | `occurred_at` | server timestamp of the 409 decision |
  | `actor_user_id` | requesting client user id |
  | `subject_booking_id` | the winning active booking's id (the numeric `bookingId` returned) |
  | `provider_id`, `service_id`, `scheduled_at` | the contested slot |
  | `path` | `'preflight' \| 'index_violation'` — internal analytics dimension only; NEVER surfaced to clients |
  | `correlation_id` | request correlation id |

## §3 Required correction 1 — explicit `marketplace_id`

Every `booking.duplicate_prevented` event **must carry an explicit
`marketplace_id` field from the first emitted event**. Tenant scope is never
implicit.

- **Before Blueprint Step 2 exists** (no `marketplaces` table yet), the field is
  populated with the **reserved default OnCall Foot marketplace identifier**:
  a fixed, documented constant (`DEFAULT_MARKETPLACE_ID = 1`, reserved slug
  `oncall-foot`), defined once in core configuration — not inferred, not null,
  not omitted.
- **When Blueprint Step 2 lands**, the additive `marketplaces` migration MUST
  create the default marketplace row with this exact reserved identifier so
  that all historical events join cleanly with zero backfill rewriting.
- Projections (§5) are keyed by `marketplace_id` from day one.

## §4 Required correction 2 — event reliability (decision)

**Decision: a durable request-level recording mechanism must be designed,
implemented, and independently verified before the projection may be described
as a count under §1.** Best-effort fire-and-forget emission is NOT the chosen
model, because it can undercount actual API 409 responses.

Durable mechanism (to be detailed in the implementation task, step 2 of §7):

1. At the 409 decision point, append one record in its **own short
   transaction** (single-row insert; the main booking transaction on the
   `index_violation` branch has already rolled back and is not reused).
2. On insert failure: **one bounded retry**; on second failure, emit a
   **structured reconciliation log line** carrying the full event payload.
3. A periodic **reconciliation job** replays structured reconciliation lines
   into the event store idempotently (keyed by `correlation_id`), closing the
   gap.
4. **Hard rule: the recording path must never delay the client's 409 response
   beyond the bounded single-insert + single-retry cost, and must NEVER alter
   or fail the 409 response.** Any recording failure is invisible to the
   client.

**Honest-labeling rule:** until the mechanism above is implemented AND
independently verified, any interim number derived from these events must be
labeled **best-effort telemetry that may undercount API 409 responses**, and
the projection must NOT be described as an exact count. After verification,
residual undercount is limited to the doubly-failed-write-plus-lost-log case
and is monitored via the reconciliation job's discrepancy metric.

## §5 Projection (rebuildable reporting read model)

- **`prevented_bookings_daily`**: `(marketplace_id, provider_id, day) → count`
  — a FUTURE additive table (its own reviewed migration, step 3 of §7),
  rebuildable from the event stream via an idempotent rebuild script.
- **Dashboard tile** (step 4 of §7) reads the projection only: "Double-bookings
  prevented" with a period selector. Access is capability-gated
  (`can_view_analytics` once Blueprint Step 2 memberships exist;
  provider-sees-own-data rule until then).

## §6 Required correction 3 — source-of-truth boundary

The projection is a **rebuildable reporting read model. It is never the booking
source of truth and never participates in booking authorization or transaction
decisions.** The bookings table, its state machine, and the
`bookings_active_booking_unique_idx` invariant remain the sole authority for
booking correctness. No analytics component — event, projection, endpoint, or
tile — may influence whether a booking is created, confirmed, rejected, or
surfaced to the transactional paths. The API's client-facing 409 contract
(friendly message + numeric `bookingId`) is unchanged by this design.

## §7 Approved sequencing (each step = its own reviewed task)

1. **This design document** (docs-only PR — this file).
2. **Event-emission implementation** — durable recording per §4, explicit
   `marketplace_id` per §3; additive only (new event type; no changes to
   existing tables' schemas); focused validation.
3. **Additive projection migration + rebuild script** (idempotent; reviewed
   migration; no changes to existing tables).
4. **Read endpoint + provider dashboard tile**
   (`GET /api/providers/:id/analytics/prevented-bookings`; UI tile).
5. **Focused validation and independent verification** at every step, with the
   §4 reliability verification gating any "exact count" labeling.

## §8 Fences (inherited, restated)

- Booking invariant untouched; DROP/CREATE on the index remains a hard STOP.
- No client-visible copy changes; no PII or SQL internals in any payload.
- Domain-neutral core naming (`booking.duplicate_prevented`); vertical wording
  only in adapter-side presentation.
- Advisory/reporting only (Blueprint §13 fences apply in full).
- Supabase/managed DB is not touched by this document; all future
  implementation work follows the additive-migration review gate.
