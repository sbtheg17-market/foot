# Client Booking Overlap Policy

**Status: unresolved — operator approval required.**

## Current behavior

The server currently prevents:

- exact duplicate active bookings for the same client, provider, service, and
  scheduled time;
- overlapping active bookings for the same provider across different clients;
- those same provider and duplicate conflicts when a booking is rescheduled.

It does **not** prevent a client from holding overlapping active appointments
with different providers. This is intentional current behavior, not an
approved product policy. No booking or rescheduling behavior is changed by
this document.

## Options

1. **Allow all client overlaps** — maximum flexibility, but clients can create
   impossible schedules and providers may arrive while the client is absent.
2. **Reject all client overlaps** — clearest marketplace rule and easiest
   client experience, but blocks legitimate appointments that do not overlap
   in practice.
3. **Allow only distinct service/category overlaps** — supports some
   coordinated care, but requires a durable service compatibility policy and
   careful edge-case handling.
4. **Require a travel buffer** — models time between appointments, but needs
   approved service-area/travel data and is explicitly outside this slice.
5. **Marketplace-specific rules** — supports future business rules, but
   requires a written policy, ownership, and test matrix before implementation.

## Recommendation

For in-home foot care, reject overlapping active client appointments unless a
future, explicitly approved travel-buffer or marketplace rule says otherwise.
The client should receive a calm, actionable conflict message and retain the
ability to choose another available time.

This recommendation is not approval. The operator must select one option
before enforcement is added.

## Consequences of a future decision

### Booking creation

The server would check all active bookings owned by the client before insert,
using authoritative service duration and marketplace timezone. Any concurrent
race would require a database-backed uniqueness or exclusion strategy reviewed
under the managed-database release gate. The client-provided total or time
must never be authoritative.

### Rescheduling

The same policy must run inside the existing locked rescheduling transaction,
excluding the booking being moved. A rejected reschedule must leave the
existing booking and its current appointment intact.

## Required tests before enforcement

- non-overlapping bookings for one client remain allowed;
- boundary-touching appointments follow an explicitly chosen rule;
- overlapping bookings across providers are rejected or allowed exactly as
  selected;
- concurrent create/create and create/reschedule attempts cannot bypass the
  policy;
- cancelled, completed, and no-show bookings follow the selected active-set
  rule;
- client and provider ownership/privacy errors remain unchanged;
- web and mobile display a useful recovery action.

## Schema and migration status

No schema or migration is included. Depending on the selected policy and
workload, a database constraint/index may be required. That design must be
reviewed separately with backup, release-gate, and managed-database approval.

**Unresolved operator decision:** select one of the five options above and
approve the exact interval/boundary, active statuses, timezone, and error
message before changing booking or rescheduling behavior.