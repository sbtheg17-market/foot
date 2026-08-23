# Service-area, travel-buffer, and rescheduling-history design

**Status:** Design and implementation readiness only  
**Scope:** Roadmap items 7 (service area and travel buffer) and 8 (durable rescheduling history)  
**Non-goals:** Payments, invoices, payouts, taxes, overlap-policy changes, notification persistence or delivery, analytics, reviews, onboarding, deployment, database operations, and new Replit configuration.

## Executive decision

Do not enforce service areas, travel buffers, or address restrictions yet. Do not add
durable rescheduling history yet. The current repository does not contain approved
values for the geographic policy or an approved history schema. Shipping either
behavior now would make provider-entered free text authoritative and would create a
partial audit record with undefined semantics.

The next implementation should be split into two independently reviewed changes:

1. **Coverage policy and evaluation:** normalize and evaluate a booking location
   against an explicitly selected provider coverage model.
2. **Reschedule history:** append an immutable record for every accepted reschedule,
   without replacing the existing booking state machine.

Neither change should be enabled by a migration or feature flag until the decisions
in the approval checklist below are recorded.

## Current-state audit

### Service area and travel

- `provider_profiles.service_area_notes` is free text.
- `travel_zones` stores `zone_name`, `city`, and optional `notes`.
- Providers can list, add, and delete travel-zone rows through the existing owner
  endpoints.
- Booking requests accept `address`, `city`, and optional `postalCode` as free text.
- Booking creation currently validates provider/service ownership, future time,
  availability, and provider overlap. It does **not** consult `travel_zones`,
  `service_area_notes`, postal-code coverage, coordinates, or travel time.
- Rescheduling reuses the future-time, active-service, availability, and overlap
  checks, but has the same absence of geographic evaluation.

The existing schema therefore cannot safely answer “is this address in the
provider's area?” It can support a conservative city/zone policy only after a
canonicalization rule is approved; it cannot support radius or drive-time rules
without a geocoding/routing source and a privacy/data-retention decision.

### Rescheduling

- The booking state machine permits `confirmed → rescheduled` and
  `rescheduled → confirmed` or `cancelled`.
- The status endpoint requires a new `scheduledAt` for a reschedule.
- Accepted reschedules update `bookings.scheduled_at`, `status`, and
  `updated_at` in the existing transaction.
- The old scheduled time, actor, reason, and request timestamp are not retained as
  a durable history row.
- A later `rescheduled → confirmed` transition does not itself represent another
  time change; history must distinguish a requested time change from reconfirmation.
- Authorization remains the existing ownership rule: the owning client or provider
  may act; admin may override the state machine.

## Decisions requiring explicit approval

### Coverage policy

Approve one of these initial models:

| Model | Evaluation | Data needed | Recommendation |
|---|---|---|---|
| Canonical city/zone | normalized booking city matches an enabled provider zone | canonical city/zone identifiers | **Preferred first release** |
| Postal prefix | normalized postal prefix belongs to provider coverage | postal-prefix set and normalization rules | Viable where postal data is reliable |
| Radius | geocoded client location is within provider radius | coordinates, radius, geocoder | Defer until privacy and provider are selected |
| Drive time | route estimate is within provider limit | routing API, cache, failure policy | Defer; operationally and financially heavier |

Also approve:

- whether the policy is a hard booking block or a warning requiring provider
  review;
- whether coverage is evaluated at request time only or again at reschedule time
  (recommended: both);
- whether the provider may accept an out-of-area request manually (recommended:
  no hard-block override unless an explicit admin/provider override is added);
- whether nearby-area travel buffers use minutes, kilometres, or a fixed surcharge;
- the buffer value, whether it is added before/after the visit, and whether it
  applies between all bookings or only when locations differ;
- handling for missing or ambiguous city/postal values;
- the client-facing error wording and whether the exact coverage boundary is
  disclosed;
- who may edit coverage, and whether existing bookings remain valid after a
  provider changes coverage.

Recommended safety defaults for approval: use canonical city/zone coverage, reject
ambiguous locations before creating or rescheduling a booking, evaluate coverage
server-side at both write points, and never expose provider or client coordinates.

### Rescheduling policy

Approve:

- who may initiate a reschedule and whether the other party must confirm;
- whether a reschedule is a proposal or an immediately accepted time change;
- maximum reschedules per booking, if any;
- minimum notice before the original visit and minimum notice before the new visit;
- whether a reason is required, and the allowed length/content policy;
- whether the actor may return to the original time;
- admin override behavior;
- whether rejected attempts are retained (recommended: no durable row until
  accepted, but server logs may contain normal operational request metadata);
- whether history is visible to client, provider, and admin, and which fields are
  redacted.

Recommended first-release semantics: the current endpoint remains an immediate
accepted change; only successful time changes create history; reconfirmation does
not create a reschedule row; and each history row records the actor and a
client/provider-visible reason when supplied.

## Proposed implementation contract after approval

### Coverage data model

Prefer replacing ambiguous text matching with explicit, normalized coverage data.
The exact table shape depends on the approved model, but a city/zone first release
needs at least:

- a provider coverage-policy row containing policy version, enabled state, and
  any approved buffer settings;
- canonical coverage members keyed by a stable city/zone identifier;
- audit timestamps and owner/provider scoping;
- an explicit policy version captured on each evaluated booking decision.

Do not add a radius, geocode, or routing column “for future use.” Those fields
would imply retention and accuracy decisions that have not been approved.

### Evaluation behavior

Add a pure provider-neutral evaluator before wiring it to routes. It should accept
canonicalized location input and a provider policy, and return:

- `allowed` or `blocked`;
- a stable reason such as `covered`, `outside_service_area`,
  `location_ambiguous`, or `policy_unavailable`;
- the policy version used;
- no raw address, coordinates, or internal provider identifiers in the client
  error payload.

Use the same evaluator from `POST /bookings` and the reschedule branch of
`PATCH /bookings/:bookingId/status`. Run it inside the write transaction or
revalidate under the same provider lock so a coverage change cannot race the
booking write. Existing availability and overlap checks remain separate and
unchanged.

### Rescheduling-history data model

After approval, add an append-only booking reschedule-history table with:

- immutable row id;
- booking id;
- actor user id and actor role at the time of action;
- previous scheduled instant;
- new scheduled instant;
- reason, nullable only if the approved policy permits it;
- policy version or rule version used for validation, if applicable;
- created timestamp;
- optional correlation/request id only if its retention and privacy behavior are
  approved.

Do not make the history row the source of truth for current booking time. The
booking remains authoritative; history is an audit trail. Do not update or delete
history rows through normal application routes.

### API

After approval, choose one of these read shapes:

- add a bounded `reschedulingHistory` projection to the authorized booking detail;
  or
- add `GET /bookings/:bookingId/rescheduling-history` for a separately paginated
  history surface.

The separate endpoint is safer for the first release because it keeps current
booking consumers backward-compatible and makes field-level authorization
explicit. It must:

- require authentication and booking ownership, with admin access as approved;
- return newest-first rows with a hard page-size cap;
- never return private care notes, full addresses, internal error text, or hidden
  admin-only metadata;
- return `404` for an inaccessible booking rather than confirming its existence;
- clearly distinguish an accepted time change from a later reconfirmation.

If the write contract later changes from immediate acceptance to proposal/approval,
that is a separate state-machine/API change and must not be smuggled into the
history endpoint.

## Test plan

### Coverage

- exact canonical city/zone match;
- case, whitespace, and postal normalization rules;
- missing and ambiguous location;
- outside-area rejection on new booking;
- outside-area rejection on reschedule;
- provider policy update racing a booking write;
- policy-unavailable behavior;
- no leakage of addresses, coordinates, or policy internals;
- unchanged availability, duplicate, and provider-overlap behavior.

### Rescheduling history

- one row for each accepted time change;
- old and new times are exact and ordered;
- client and provider ownership boundaries;
- admin visibility/override behavior;
- no row for rejected validation or overlap attempts;
- no row for `rescheduled → confirmed` when the time does not change;
- multiple reschedules remain append-only and newest-first;
- history cannot be updated or deleted through the public API;
- concurrent status requests produce one valid state transition and one
  corresponding history row;
- client-safe projections exclude private fields.

## Approval gate

Implementation may begin only after the product owner records:

1. the coverage model and normalization source;
2. hard-block versus warning behavior;
3. the exact travel-buffer unit and value;
4. missing/ambiguous-location behavior;
5. reschedule actor, notice, count, reason, and confirmation rules;
6. history visibility and retention policy;
7. the approved schema/API shape;
8. whether policy evaluation is enabled for existing bookings.

Until then, this document is the implementation contract draft. The current
travel-zone endpoints and rescheduling checks remain unchanged.