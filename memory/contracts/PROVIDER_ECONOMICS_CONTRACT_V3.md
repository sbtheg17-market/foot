# Provider Economics Contract
**Candidate v3 (NEW derivation, 2026-08-10).** No continuity is claimed with any lost
prior contract document (lost checksum `5a7a2029…` / "plan v2" unrecoverable; re-derived
from the published traceability record in `.agents/LOG.md` Sessions 060–062 and the
canonical codebase at `main = 3e76114`).

Status: **REVIEW REQUIRED before any implementation.** Product/API contract only.
Implemented separately from (and after) Phase 4C comfort profiles — never bundled.

---

## 1. Purpose

Give providers honest, advisory tools to run a profitable mobile practice — boundaries
they set themselves, clear per-appointment economics, and fully provider-controlled
deals — without the platform ever pressuring them into low-value work.

## 2. The seven pinned requirements (verbatim intent preserved)

**R1 — Buffers (provider-set).** A provider may set preparation/travel buffer minutes
around appointments. Respected by opportunity surfacing and availability math.
**Never a ranking input.**

**R2 — Travel boundaries via the existing travel-zone contract, UNCHANGED.** Provider
travel limits reuse the existing travel-zones API exactly as published (list/add/remove;
no update endpoint exists and none is added). This contract adds **no** new travel-zone
fields, routes, or semantics. **Never a ranking input.**

**R3 — Minimum booking value (provider-set).** A provider may set a minimum value
(integer **cents**) below which opportunity surfacing must not promote work to them.
Clients are never shown a provider's minimum. **Never a ranking input.**

**R4 — Preferred blocks (provider-set).** A provider may mark preferred working blocks
(day-of-week + time window). Opportunity surfacing prefers these blocks when suggesting;
bookings outside preferred blocks remain fully allowed. **Never a ranking input.**

**R5 — Advisory-only appointment economics.** For an appointment (requested or
hypothetical), the provider can see: price, duration, estimated travel cost, buffer
impact, and **estimated net value** — each with **visible assumptions** (e.g. the
per-km/per-minute travel assumption used) and **boundary flags** (which of R1–R4 the
opportunity would violate). Advisory only: the platform never blocks, auto-declines,
or auto-accepts anything based on economics.

**R6 — Provider-controlled, capped, time-bounded deals with mandatory pre-publish
preview.** Deal types: `off_peak | first_visit | bundle | recurring | add_on`.
Every deal is created by the provider, has an explicit percentage-or-amount cap, a
start/end time bound, and an optional redemption cap. Publishing REQUIRES the provider
to view a preview of (a) earnings impact per redemption and (b) calendar impact, and to
confirm it. Deals are pausable/cancellable by the provider at any time (existing
redemptions honored).

**R7 — Hard exclusions.** The platform must never: apply **automatic discounts**;
**force acceptance** of any booking or opportunity; make **ranking changes** based on
boundaries, economics, or deals; or present **opaque guarantees** (any earnings or
demand claim must show its assumptions inline).

## 3. Explicitly out of scope (locked)

- No Stripe/payments/payout/dispute work; invoices unchanged.
- No changes to booking state machine, authorization, readiness rules, or travel-zone
  contract (R2).
- No discovery-ranking inputs from anything in this contract (R1–R4, R7).
- No client-facing "provider minimum value" exposure.
- No automatic pricing, surge, or demand-based repricing.
- No new `marketplace_events` emission in the first slice; no analytics.
- No mobile (Expo) work in the first slice.

## 4. Data model (additive-only; final DDL at implementation review)

- `provider_boundary_settings` — `id`, `providerProfileId` (unique FK),
  `bufferBeforeMinutes`, `bufferAfterMinutes`, `minimumBookingValueCents` (int, cents),
  `createdAt`, `updatedAt`.
- `provider_preferred_blocks` — `id`, `providerProfileId` (FK), `dayOfWeek` (0–6),
  `startMinute`, `endMinute` (minutes from midnight, consistent with availability),
  unique per (provider, day, window).
- `provider_deals` — `id`, `providerProfileId` (FK), `dealType` (enum §2 R6),
  `discountType` (`percent` | `amount_cents`), `discountValue` (int; percent ≤ a fixed
  server-side cap, e.g. 50; amounts in cents), `startsAt`, `endsAt`,
  `maxRedemptions` (nullable), `status` (`draft` | `active` | `paused` | `ended`),
  `previewConfirmedAt` (NOT NULL before status may become `active`), `createdAt`,
  `updatedAt`.
- All monetary values integer cents (repo rule). No floats.

## 5. API contract (OpenAPI-first; owner-scoped via existing middlewares)

| Route | Role | Behavior |
|---|---|---|
| `GET /api/providers/me/boundaries` | provider (self) | Boundary settings + preferred blocks (defaults if unset). |
| `PUT /api/providers/me/boundaries` | provider (self) | Upsert buffers + minimum booking value (cents, validated ≥ 0). |
| `POST /api/providers/me/preferred-blocks` | provider (self) | Add block. |
| `DELETE /api/providers/me/preferred-blocks/:id` | provider (self) | Remove block. |
| `GET /api/providers/me/bookings/:id/economics` | provider (booking party) | R5 advisory breakdown for a real booking: price, duration, travel estimate + assumptions, buffer impact, estimated net value, boundary flags. `404` for non-owned bookings. |
| `GET /api/providers/me/deals` | provider (self) | List own deals with status. |
| `POST /api/providers/me/deals` | provider (self) | Create draft deal (validated caps/bounds). |
| `GET /api/providers/me/deals/:id/preview` | provider (self) | Mandatory pre-publish preview: earnings impact per redemption + calendar impact + assumptions. |
| `POST /api/providers/me/deals/:id/publish` | provider (self) | Activates ONLY if a preview was served and confirmed for the current deal values (server-enforced `previewConfirmedAt`). |
| `POST /api/providers/me/deals/:id/pause` / `.../end` | provider (self) | Provider-controlled lifecycle. |

Discovery/read surfaces: active deals MAY render on the provider public profile as
plain-language savings copy (assumptions visible); discovery ordering is untouched (R7).

## 6. Web UI slice (mobile-first, 390px, provider portal)

1. "Business settings" screen: buffers, minimum booking value (currency input stored as
   cents), preferred blocks editor.
2. Booking detail: advisory "Appointment economics" card (R5) with an assumptions
   disclosure ("How we estimate this").
3. "Deals" screen: list, create (type, discount, bounds, caps), mandatory preview step
   with explicit confirm, pause/end controls.

## 7. Acceptance criteria

1. All settings owner-scoped (cross-provider access returns `404`; integration-tested).
2. A deal can never reach `active` without a server-recorded preview confirmation for
   its current values (attempted bypass tested).
3. Economics endpoint shows visible assumptions and correct boundary flags for R1–R4
   violations; changing a boundary changes the flags (tested).
4. No discovery/ranking endpoint reads boundaries, economics, or deals (asserted).
5. Client-facing surfaces never expose minimum booking value or provider net value.
6. All money integer cents; typecheck/build/regression (164 tests) stay green; new
   focused integration suite passes.
7. Copy audit: every earnings/demand number is accompanied by its assumptions (R7).

## 8. Implementation sequencing (after approval; strictly after Phase 4C lands)

E-1: additive schema + codegen → E-2: boundaries + preferred blocks API + tests →
E-3: economics endpoint + tests → E-4: deals lifecycle + mandatory preview + tests →
E-5: provider web UI → regression + E2E. One focused local commit per step; patch +
checksum artifacts; no pushes from this workspace.
