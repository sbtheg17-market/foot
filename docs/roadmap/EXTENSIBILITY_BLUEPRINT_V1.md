# Extensibility Blueprint V1 — Marketplace Core vs. Vertical Adapter

**Status:** APPROVED IN PRINCIPLE (operator, 2026-08-12) — design-only.
**Scope:** This document contains NO migrations, NO schema changes, NO application
code, NO compatibility views, and NO analytics code. Every implementation step it
describes is a FUTURE task requiring its own separate review and approval.
**Provenance:** Session 079 era; approved packet delivered for review 2026-08-12;
committed as its own reviewed docs-only task per operator instruction.
**Prime references:** `docs/roadmap/NEO_EAGLE_VIEW.md`, `.agents/AGENT-RULES.md`,
`.agents/NEXT_TASK.md` (architecture rule: OnCall Foot = first vertical).

---

## §0 Prime directives (inherited, non-negotiable)

1. OnCall Foot is the **first vertical, not the platform boundary**. Every future
   change is classified **core** or **adapter** before design begins.
2. Additive migrations only — never a rushed rewrite of the verified 18-table
   schema; the live `bookings_active_booking_unique_idx` invariant must never be
   weakened, bypassed, or dropped (DROP/CREATE = hard STOP, separately reviewed
   migration).
3. Vertical terminology (feet, podiatry, care visits) lives **only** in the
   adapter layer; the core speaks neutral marketplace language.

## §1 Marketplace / workspace ownership

- New core concept: **`marketplaces`** (a.k.a. workspace/tenant): identity, slug,
  status, plan tier, settings JSON, created/suspended lifecycle.
- Every tenant-owned record gains a **`marketplace_id`** ownership path — but
  **mapped first, not blindly added to every table** (§2).
- A **default marketplace** row represents the existing OnCall Foot deployment;
  backfill = single additive migration assigning all existing rows to it,
  preserving every current behavior. Zero-downtime, reversible.

## §2 `marketplace_id` ownership mapping (design table, per existing 18 tables)

- **Direct column (root aggregates):** `provider_profiles`, `services`,
  `bookings`, `invoices`, `provider_applications`, `support` threads,
  `marketplace_events` — each carries `marketplace_id` FK + composite index
  `(marketplace_id, …hot path)`.
- **Derived (via parent, no column):** `provider_application_events` /
  `provider_application_submissions` (→ application), `reviews` (→ booking),
  `provider_notifications` (→ provider), `push_tokens` (→ user membership).
- **Global with membership join:** `users` stay global (one identity, many
  tenants); new **`marketplace_memberships`** (user × marketplace × capability
  set, §3) replaces per-tenant user rows. `account_roles` is superseded by
  memberships in the core; kept during transition as the adapter's legacy
  mapping.
- **Booking invariant under tenancy:** the live index columns are unchanged; a
  future *separately reviewed* migration MAY extend uniqueness to include
  `marketplace_id` **only** if cross-tenant provider sharing is ever approved —
  until then providers belong to one marketplace, so the current index already
  implies tenant isolation. Recorded as a watch-item, not a change.

## §3 Capability-based delegated administration

- Replace `role == "admin"` checks with **capabilities** on the membership:
  `can_manage_providers`, `can_review_applications`, `can_edit_branding`,
  `can_edit_landing_pages`, `can_manage_catalog`, `can_view_analytics`,
  `can_manage_members`, `can_handle_support`, …
- **Role = named capability bundle** (per marketplace, editable); enforcement is
  always capability-level in Express middleware (`requireCapability(cap)`),
  never role-name string matching.
- Delegation rule: a member may grant only capabilities they themselves hold
  (`can_manage_members` + subset rule). Platform-operator capabilities
  (cross-tenant) are a distinct, non-delegable set.
- Signup `roleIntent` remains an onboarding request, never an authorization
  claim (existing locked constraint carried forward).

## §4 Independent providers

- Provider identity splits into: global **provider person** (user) +
  per-marketplace **provider engagement** (profile, verification, catalog
  participation). An independent provider is simply a provider engagement in a
  **self-owned single-provider marketplace** — no special-case code path.
- Verification/qualification records attach to the engagement; the
  approved-provider boundary (application AND verification approved) is a core
  rule evaluated per marketplace.

## §5 Clients and client groups

- Clients = users with a client-side membership. New neutral **`client_groups`**
  (respectful terminology; e.g., a family, a residence, an organization's
  cohort) with `client_group_members` and per-group booking/consent context.
- A booking may reference an optional `client_group_id` (additive column, future
  migration) so care coordinators can book on behalf of a group member — gated
  by an explicit consent record (§11) and a `can_book_for_group` capability
  scoped to the group.

## §6 White-label branding

- **`marketplace_branding`**: logo/wordmark assets, palette tokens, typography
  choice, email sender identity, domain/subdomain claim, legal footer.
  Versioned rows (draft → published) so branding edits are previewable and
  auditable.
- Web/mobile read branding via a single resolved **theme contract** endpoint;
  React consumes CSS custom-property tokens — no per-tenant builds.

## §7 Configurable landing pages

- **`landing_pages`** (per marketplace, versioned, draft/published) composed of
  ordered **section instances** drawn from a typed registry: hero, service
  highlights, provider spotlight, testimonials, FAQ, CTA, rich text, media band.
- Section registry is **core**; section *content* and vertical imagery are
  tenant data. Rendering = server-provided JSON layout → React section
  components. Publishing requires `can_edit_landing_pages`.

## §8 Neutral offerings / catalogs

- Core catalog concepts: **`service_category`** → **`service_definition`** (the
  neutral offering; time-based or not) → **`provider_offering`** (a provider's
  enactment: price cents, duration, delivery mode) → **`solution_package`**
  (bundle of offerings) → **`provider_specialty`** (qualification tags).
- Offering **kinds**: `scheduled_service` (today's bookings),
  `physical_product`, `digital_product` (download), `educational_media`,
  `subscription_plan`, `bundle`. Existing `services` table becomes the
  adapter-mapped ancestor of `scheduled_service`; migration is additive with a
  compatibility view, never destructive. (The compatibility view is a FUTURE
  migration deliverable — not part of this document.)

## §9 Fulfillment models

- Per offering kind: **booking** (schedule + lifecycle state machine — the
  existing verified one, untouched), **purchase** (order → payment → fulfillment
  states), **download** (entitlement + signed URL issuance, re-downloadable),
  **subscription** (term, renewal, pause/cancel, entitlement window).
- One neutral **`orders`** spine with kind-specific satellite tables; bookings
  remain their own aggregate joined to the order spine (no rewrite of
  `bookings`). Payments/Stripe stay a separately approved future task (existing
  locked constraint).

## §10 Events and projections

- Extend the proven `marketplace_events` outbox pattern into the tenant era:
  every domain event carries **`marketplace_id`, actor (user + capability
  context), subject (aggregate type + id), correlation_id, causation_id**,
  occurred_at, schema_version.
- Event names are **domain-neutral** (`offering.published`, `order.fulfilled`,
  `booking.conflict_rejected`); vertical flavor lives in adapter-side
  subscribers.
- **Projections** (read models: provider dashboards, admin analytics,
  landing-page counters) are rebuildable, tenant-scoped, and never a source of
  truth.
- **Approved analytics counting rule (operator, 2026-08-12; implementation
  QUEUED until the event/projection design is separately approved):**

  ```text
  One prevented-booking event = one booking request that reaches the API and
  returns HTTP 409 with a numeric bookingId.
  ```

  This counts **API 409 responses** — both the preflight conflict path and the
  database Race-Proof index path — reflecting what the client actually
  experienced without exposing database internals. Deduplication may be added
  later only if product requirements demand "unique blocked slots" rather than
  "blocked booking attempts."

## §11 Consent and audit boundaries

- **`consent_records`**: grantor, scope (what data / what action, e.g., group
  booking, care-note visibility), grantee (user/marketplace), status lifecycle
  (granted → withdrawn), evidence timestamp. Withdrawal is honored by queries,
  not by deletion — audit history is immutable.
- Booking-on-behalf, care-note access, and any ML feature ingestion (§13) each
  require an explicit consent scope. `reviewerNotes` never render client-side;
  only `rejectionReason` + public snapshot fields (existing locked rule,
  restated as a core boundary).
- Audit = append-only event stream (§10) + ledger discipline; no feature may
  write over history.

## §12 Core vs adapter rules (the boundary contract)

- **Core owns:** tenancy, memberships/capabilities, neutral catalog,
  order/fulfillment spine, booking state machine + invariant,
  events/projections, consent/audit, branding/landing engine.
- **Adapter owns:** vertical vocabulary and copy, foot-care service
  definitions/specialties, intake forms, care-note templates, imagery,
  jurisdiction-specific compliance text.
- **Litmus tests:** "Would a tutoring or pet-grooming marketplace need this
  unchanged?" → core. "Does it mention feet, visits, or podiatry?" → adapter. A
  change touching both = split into two reviewed tasks.
- Comfort-Wiring remains reference-only; anything ported arrives stack-native
  through this boundary under its own approval.

## §13 Advisory ML (never overriding)

- ML outputs are **recommendations with explanations** only: suggested time
  slots, offering recommendations, provider-client matching hints, demand
  forecasts.
- **Hard fences (enforced in core, not in the model):** ML may never
  (a) bypass or reorder authorization/capability checks, (b) act without the
  consent scope of §11, (c) waive qualification/verification boundaries,
  (d) read or write across tenant isolation, (e) create/confirm bookings or
  override the duplicate-booking invariant — it proposes; the verified
  transactional path disposes.
- Every surfaced recommendation carries provenance (model, inputs class,
  timestamp) and is logged as an advisory event for audit. Domain-neutrality
  rule applies to every ML handoff (existing operator rule carried forward).

## §14 Sequencing (all future, each its own reviewed task — no schema work now)

1. Blueprint committed (this document, docs-only) →
2. `marketplaces` + memberships/capabilities additive migration +
   default-tenant backfill →
3. Capability middleware swap (behavior-preserving) →
4. Neutral catalog spine + compatibility view →
5. Branding + landing engine →
6. Order/fulfillment spine for non-time offerings →
7. Consent records →
8. Tenant-scoped projections/analytics (counting rule per §10, already
   approved; implementation still requires its own review) →
9. Advisory ML slice.

Each step: one task → one reviewed commit → one patch → LOG entry, publication
via the gate.
