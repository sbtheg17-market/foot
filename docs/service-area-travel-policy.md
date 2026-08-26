# Service-area and travel-buffer policy

**Status:** SUPERSEDED for enforcement — roadmap #12 shipped a Canada-first
postal-prefix (FSA) model with a centrally managed travel/setup buffer. The
design sections below are preserved as history; the authoritative shipped
behavior is the "Implementation record — 2026-08-26 (roadmap #12)" section at
the end of this document.
**Scope (original):** Roadmap item 7 only. The original document authorized no
enforcement, geocoding, routing, persistence, or migration.

## Current state

Providers currently have descriptive `service_area_notes` plus `travel_zones`
rows containing free-text `zone_name`, `city`, and `notes`. Booking requests have
free-text `address`, `city`, and optional `postalCode`. Neither booking creation
nor rescheduling evaluates those fields against coverage. No coordinates,
geocoding, routing, travel time, buffer, maximum-daily-visit, or multi-city policy
is stored.

## Candidate coverage models

| Model | Strength | Main risk |
|---|---|---|
| Postal-code allowlist | Deterministic and relatively private; useful for a curated set of postal prefixes | Postal formatting, boundary changes, and incomplete/ambiguous prefixes |
| Radius | Simple distance rule around a provider base | Requires geocoding and a defensible provider base; straight-line distance is not travel time |
| Polygon/geofence | Accurate boundaries and supports irregular service areas | Requires canonical polygons, GIS evaluation, editing tools, and boundary governance |
| City/region allowlist | Easy to explain and operate; matches current data direction | Coarse boundaries can include impractical trips |
| Hybrid | City/region gate plus postal, radius, or route-time refinement | More policy complexity and more failure modes |

### Recommendation pending approval

Use a **city/region allowlist with an optional postal-prefix refinement** for the
first enforcement release. It is the smallest safe step from the current model,
does not require retaining client coordinates, and is easy to explain to clients.
Add radius, polygons, or route-time checks only after a routing/geocoding source,
privacy review, and provider operating policy are approved. This recommendation is
not an approved policy.

## Required policy approval

The operator must approve:

1. the model and canonical location source;
2. hard rejection versus warning/manual review;
3. whether coverage is checked for both new bookings and reschedules;
4. whether a provider/admin can override an out-of-area result;
5. the exact postal/city/region boundary and normalization rules;
6. travel-buffer unit and value;
7. setup and cleanup time assumptions;
8. maximum daily appointments;
9. first/last appointment rules and overnight behavior;
10. missing, invalid, ambiguous, or inaccessible address behavior;
11. multi-city operation and provider-area change behavior;
12. privacy, retention, and client-facing wording.

## Address and location handling

### Fields

The booking UX may collect a service address, city/region, postal code, and
optional access instructions. Care notes must remain separate from location
data. The system must not require latitude/longitude unless the radius, polygon,
or route-time model is approved.

### Normalization

Normalize at the server boundary: trim whitespace, case-fold comparison values,
normalize postal spacing and punctuation, map approved aliases to canonical
city/region identifiers, and retain the user's display address separately. Do
not use substring matching or provider-entered notes as an authority.

### Geocoding and coordinates

Geocoding is **deferred**. If later approved, use a provider-managed geocoder
through a server-side adapter, store the minimum result needed for evaluation,
encrypt or restrict access to coordinates, avoid returning them to clients, and
define deletion/refresh rules. Do not send addresses to a routing/geocoding
service in this slice.

### Invalid, ambiguous, and inaccessible addresses

- Invalid or incomplete location: block creation/rescheduling with a calm,
  actionable correction message if hard-block behavior is approved.
- Ambiguous location: do not guess; request a more specific city/region/postal
  value.
- Inaccessible address (restricted building, unsafe access, stairs, parking
  limitation): treat as an operational suitability decision, not proof of
  geographic coverage. Capture only approved access information and route to the
  approved provider/manual-review path.

## Travel feasibility and buffers

### Travel-time sources

Possible sources are provider-entered estimates, a deterministic distance
calculation, a commercial routing provider, or an internal routing service.
Provider-entered estimates are not sufficient for automated hard blocking.
Routing introduces a provider dependency, quota/cost concerns, location
disclosure, map freshness, and an outage policy; it is deferred.

### Buffer definition

An appointment buffer should include approved setup, cleanup, parking, and
handoff time—not only driving time. The operator must decide whether the buffer
is fixed, service-specific, distance-based, or route-time-based, and whether it
applies before the next appointment, after the prior appointment, or both.
Do not add buffer minutes to the existing overlap rule before approval.

### Operating constraints

Approval must define:

- maximum daily appointments, including whether travel-heavy visits count
  differently;
- earliest first appointment and latest last appointment;
- minimum gap between appointments;
- whether an appointment may cross midnight;
- how overnight appointments are represented and displayed;
- whether the provider's local timezone or marketplace timezone governs all
  rules.

Recommended representation is an absolute instant for persisted booking times,
with an approved IANA timezone for display and wall-clock policy evaluation.
Daylight-saving transitions must reject nonexistent local times, disambiguate
repeated local times, and be covered by tests.

### Multi-city operation

A provider may serve multiple approved cities/regions only through explicit
coverage members. Do not infer multi-city service from a comma-separated note.
The first release should evaluate each booking location independently and should
not persist multi-city routing or daily travel optimization.

## Change and cancellation policy

Changing a provider's service area must not silently invalidate existing
confirmed bookings. The operator must choose whether changes affect only future
requests, future reschedules, or also prompt a manual review of existing visits.

Travel-related cancellation is deferred. If later approved, it must define who
may cancel, notice, reason, refund/payment dependency, and client/provider
communications. Payment and refund behavior is explicitly **deferred** to the
payments workstream; no travel-based cancellation or refund is implemented here.

## Failure and outage behavior

For an approved external geocoder/router, the policy must choose fail-closed,
fail-open with a warning, or manual review. Recommended behavior for a hard
coverage decision is fail closed to an actionable manual-review state—not a
silent allow and not a raw provider error. Cache only approved normalized
results, bound cache lifetime, and never cache sensitive data beyond retention.
No routing or geocoding calls are made in this slice.

## Future schema and migration implications

The current text fields cannot safely serve as a canonical policy. A future
city/region release likely needs:

- a versioned provider coverage policy with enabled state and timestamps;
- canonical coverage members, with provider ownership and uniqueness;
- a policy version captured with any booking decision if auditability is
  required;
- optional, separately approved buffer settings.

Postal, radius, polygon, and route-time releases require different fields and
indexes. Do not add speculative geometry, coordinates, routing IDs, or daily
capacity columns now. Any schema change requires an OpenAPI/data-model review,
migration plan, backfill/compatibility behavior, and rollback plan.

## Future API and authorization

Existing provider travel-zone endpoints remain descriptive until the model is
approved. A future API must keep provider coverage writes owner-scoped and
server-authorized, prevent clients from changing coverage, and define admin
override explicitly. Booking and reschedule writes must use the same pure
server-side evaluator. Client responses should expose a stable reason such as
`outside_service_area` or `location_ambiguous`, never coordinates, internal
policy IDs, vendor errors, or another client's address.

## Required future tests

- canonical city/region and postal normalization;
- exact boundary, alias, case, whitespace, and malformed inputs;
- invalid and ambiguous addresses;
- inaccessible-address/manual-review behavior;
- coverage checks on new booking and reschedule;
- coverage changes racing writes;
- missing policy and geocoder/router outage behavior;
- DST spring-forward/fall-back and timezone display;
- overnight, first/last appointment, setup/cleanup, and daily-cap rules;
- multi-city membership and policy-version behavior;
- no coordinate/address leakage;
- unchanged availability, duplicate, overlap, and cancellation behavior.

## Explicit non-implementation statement (historical — as of the design phase)

Postal rejection, radius rejection, polygon rejection, geocoding, coordinates,
routing, travel-time calculation, travel-buffer enforcement, maximum daily
appointments, travel-based cancellation, and multi-city persistence are **not
implemented**.

---

## Implementation record — 2026-08-26 (roadmap #12)

Roadmap #12 implemented the postal-prefix allowlist variant of the design
above (PR #49, squash-merged 2026-08-25 as `a0083e7`, completed by the
2026-08-26 follow-up PR #50 from `feat/service-area-travel-enforcement`). This
section is the authoritative record of what is enforced.

### Coverage model (approved and shipped)

- **Canada-first FSA allowlist.** A provider configures one service-area row
  (`provider_service_areas`: country `CA` only, canonical province code,
  optional city, provider-written public description, active flag) plus zero
  or more coverage entries (`provider_coverage_areas`), one per Canadian FSA
  — the first three postal-code characters, e.g. `M5V`. Prefixes are
  normalized (uppercase, no whitespace) at the API boundary; removal
  deactivates (never destroys) the row; a partial unique index keeps ACTIVE
  coverage unique per provider. Frozen additive artifact:
  `docs/migrations/PROVIDER_SERVICE_AREAS_V1.sql`.
- **No geocoding, routing, radius, polygons, or coordinates** — anywhere.
  Coverage is a deterministic prefix rule, never a drive-time guarantee.
- Unconfigured providers are safe by default: public eligibility reports
  `unavailable`, and publishing a booking page requires active coverage.

### Eligibility (server-authoritative)

States: `eligible | ineligible | needs_review | invalid | unavailable`, each
with approved plain-language client copy and a small allowlisted reason code
(`fsa_match`, `fsa_not_covered`, `country_not_served`, `province_mismatch`,
`missing_location`, `malformed_postal_code`, `malformed_location`,
`not_configured`). The client is never trusted to decide eligibility; every
booking/rescheduling transition revalidates against the provider's CURRENT
active coverage. Out-of-area requests are hard-blocked (409);
`needs_review` (e.g. province/FSA inconsistency) routes the client to the
provider/support instead of guessing.

Public checks (rate-limit-friendly, minimal input, no account required):
`POST /booking-pages/:slug/service-area-check` (public booking page — runs
BEFORE service and slot selection on `/book/:providerSlug`) and
`POST /providers/:providerId/service-area-check` (marketplace/mobile booking
modal). Provider configuration is owner-scoped under
`/providers/me/service-area*`.

### Travel/setup buffer (approved and shipped)

- **Centrally managed 30-minute default** between a provider's appointments
  (covers travel, setup, parking, handoff). Service duration stays separate.
- Environment override `TRAVEL_SETUP_BUFFER_MINUTES` (integer 0–240,
  validated; invalid values throw — never a silent fallback). Providers see
  the active value and its source (`default` | `environment`) in their
  service-area settings. Per-provider overrides remain DEFERRED.
- Enforced on new bookings, client immediate reschedules, provider proposal
  creation, and proposal acceptance. Conflict math is instant-based
  (DST-safe); zero-gap back-to-back appointments conflict.
- The buffer never alters existing confirmed bookings and never creates a
  maximum-daily-appointments cap.

### Privacy (enforced)

Public responses expose only the safe summary (country, province, optional
city, provider-written description, configured flag) and the eligibility
state/message/reason code. The raw prefix list, private notes, provider
address, client addresses, user/account identifiers, care notes, and
technical errors are never exposed publicly. Missing/unpublished/inactive/
invalid public routes keep the same generic non-leaking behavior as #11.

### Change behavior

Coverage changes affect future bookings and future reschedules only;
existing confirmed bookings are never silently cancelled. Reschedule paths
revalidate the booking's stored location against CURRENT coverage and reject
with a calm, actionable 409 when it no longer passes.