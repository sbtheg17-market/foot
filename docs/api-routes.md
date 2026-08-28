# API Routes

All routes are prefixed with `/api`. Auth middleware details: see `docs/roles-and-permissions.md`.

---

## Auth

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /auth/register | public | Register new user (client or provider); response includes additive server-confirmed role/application state |
| POST | /auth/login | public | Login, returns JWT plus additive server-confirmed role/application state |
| POST | /auth/logout | auth | Invalidate session (client-side token drop) |
| GET | /auth/me | auth | Current user profile |
| POST | /auth/password-reset/request | public | Request password reset email (placeholder) |
| POST | /auth/password-reset/confirm | public | Confirm password reset (placeholder) |

Auth responses retain the legacy scalar `user.role` field and JWT role claim.
They additionally expose `user.roles`, `user.activeRole`, `user.onboarding`, and
`user.providerApplication`. These fields are read-only compatibility state in
Phases 2/3. Route authorization now confirms role membership from the database,
and provider operations additionally require an approved owned application and
approved provider profile. Credential submission remains available for
onboarding review but does not grant provider operations.

---

## Provider Application (onboarding)

Owner-scoped provider onboarding endpoints. Reading, saving, resetting, or
submitting an application does not grant provider operations — the
approved-provider gate requires provider membership, an owner-linked
application with `approved` status, and an approved provider profile.

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /providers/application | auth (owner) | Own application detail; includes `rejectionReason` (nullable) and `previousSubmissions[]` history |
| GET | /providers/application/status | auth (owner) | Compact server-authoritative status view: `status`, `rejectionReason`, `submissionCount`, `latestSubmission`, server-derived `nextAction`, and `canEdit`/`canReset`/`canResubmit` capability flags. Never exposes `reviewerNotes`. |
| GET | /providers/application/submissions | auth (owner) | Keyset-paginated history of closed rejected submission cycles, newest first (`limit` 1–50 default 20, opaque `cursor`). Returns `summary` (same view as `/status`), `submissions[]` (six public fields only), and `pagination` (`limit`/`hasMore`/`nextCursor`). Never exposes `reviewerNotes`/`reviewedBy`. Records closed rejected cycles only — not a full lifecycle event log. |
| POST | /providers/application | auth | Idempotently start or resume provider onboarding (creates draft) |
| PATCH | /providers/application | auth (owner) | Save draft profile fields; blocked on `rejected`/`under_review`/`approved`/`suspended` |
| POST | /providers/application/reset | auth (owner) | Reset a `rejected` application back to `draft`; snapshots the closed cycle into immutable history and clears rejection fields; idempotent when already `draft` |
| POST | /providers/application/submit | auth (owner) | `draft → under_review`; requires reset first when status is `rejected` |
| GET | /providers/application/completion | auth (owner) | Server-derived completion summary |
| GET | /providers/application/services | auth (owner) | Application-scoped services list |
| POST | /providers/application/services | auth (owner) | Add an application-scoped service |

Application responses expose `rejectionReason` (provider-visible) but never
expose `reviewerNotes` (admin-private). `previousSubmissions` returns only
public snapshot fields per closed cycle.

---

## Marketplace / Provider Discovery

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /providers | public | Browse providers (filter: city, service, rating, verified) |
| GET | /providers/:id | public | Provider public profile |
| GET | /providers/:id/services | public | Provider's active services |
| GET | /providers/:id/reviews | public | Provider's reviews |
| GET | /booking-pages/:slug | public | Provider-owned public booking page (published + approved providers only; missing/unpublished/inactive/invalid slugs all return the same generic 404). Includes the privacy-safe `serviceArea` public summary (roadmap #12) — never the raw coverage list |
| POST | /booking-pages/:slug/service-area-check | public | Server-authoritative service-area eligibility check for the public booking page (roadmap #12). Minimal location input (country/province/postal code); returns `eligible \| ineligible \| needs_review \| invalid \| unavailable` with approved copy and an allowlisted reason code. Runs BEFORE service and slot selection on `/book/:providerSlug` |
| POST | /providers/:providerId/service-area-check | public | Same eligibility check for the marketplace flow (web + mobile booking modal) (roadmap #12) |

Marketplace discovery (`/providers`) and the provider-owned booking page
(`/book/:slug` in the web app, backed by `/api/booking-pages/:slug`) are
distinct surfaces that derive from the same source of truth — profile,
services, and availability are never duplicated per surface, and booking flows
through the existing slots + bookings endpoints.

---

## Provider Portal (own profile)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /providers/me | provider | Own profile |
| PUT | /providers/me | provider | Update profile |
| POST | /providers/me/services | provider | Add a service |
| PUT | /providers/me/services/:id | provider | Update a service |
| DELETE | /providers/me/services/:id | provider | Deactivate a service |
| GET | /providers/me/availability | provider | Get availability schedule |
| PUT | /providers/me/availability | provider | Set availability |
| GET | /providers/me/availability/exceptions | provider (approved) | Upcoming blocked dates (availability exceptions, Phase B) — today or later, ascending. See `docs/availability-exceptions-policy.md` |
| POST | /providers/me/availability/exceptions | provider (approved) | Block a marketplace-local `YYYY-MM-DD` date (`{ date, reason? }`, reason ≤ 200 chars, private). 400 invalid/past date; 409 duplicate (unique per provider+date). Never modifies existing bookings |
| DELETE | /providers/me/availability/exceptions/:id | provider (approved) | Remove a blocked date (owner-scoped; 404 when not found/not owned) |
| GET | /providers/me/travel-zones | provider | Get travel zones |
| POST | /providers/me/travel-zones | provider | Add a travel zone |
| DELETE | /providers/me/travel-zones/:id | provider | Remove a travel zone |
| POST | /providers/me/verification | provider | Submit a credential document reference (`docType` ∈ license/insurance/certification/other; `fileName` 3–200 chars; optional `notes` ≤ 1000 chars). Transactional and idempotent: an identical pending submission (same type + reference) returns the existing record — retries/double-taps never create duplicates. First doc auto-advances verification pending → under_review. Drift-safe: reads only signup-era profile columns, so it works before the Gate B artifacts are applied |
| GET | /providers/me/verification | provider | Own verification status + submitted docs (drift-safe narrow profile read) |
| GET | /providers/me/earnings | provider | Earnings placeholder summary |
| GET | /providers/me/dashboard | provider (approved) | Owner-scoped read-only dashboard aggregate: today's count, next/upcoming bookings (30-day window), performance metrics, source attribution, recent activity, earnings preview. Privacy-trimmed client names (first name + last initial) and FSA/city locations — never full addresses. Access is audit-logged. See `docs/provider-dashboard.md` |
| GET | /providers/me/metrics | provider (approved) | The same performance-metrics object served independently (completion/cancellation/no-show/repeat-client rates over resolved bookings) |
| GET | /providers/me/service-area | provider (owner) | Own service-area configuration: country/province/city, public description, active coverage prefixes, and the active travel/setup buffer with its source (`default` \| `environment`) (roadmap #12) |
| PUT | /providers/me/service-area | provider (owner) | Create/update the single owner-scoped service-area configuration; Canada (`CA`) only in this release; province validated against the canonical list |
| POST | /providers/me/service-area/prefixes | provider (owner) | Add a covered Canadian postal prefix (FSA, e.g. `M5V`); normalized server-side; duplicate ACTIVE entries return 409; requires the configuration to exist |
| DELETE | /providers/me/service-area/prefixes/:prefixId | provider (owner) | Remove (deactivate) a covered prefix; the prefix can be re-added later |
| GET | /providers/me/booking-page | provider (member) | Own public booking-page state (slug, publish state, eligibility) |
| POST | /providers/me/booking-page/publish | provider (approved) | Publish the canonical public booking page; assigns an immutable kebab-case slug on first publish (deterministic suffix on collision); idempotent |
| POST | /providers/me/booking-page/unpublish | provider (member) | Remove public access; slug and data retained so republish restores the same URL; idempotent |

---

## Bookings

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /bookings | auth | Own bookings (scoped by role) |
| GET | /bookings/history | client | Bounded client-safe history with provider/service summaries |
| POST | /bookings | client | Create a booking request |
| GET | /bookings/:id | auth | Booking detail (own only) |
| PATCH | /bookings/:id/status | auth | Update status (role-restricted transitions) |

Client booking list, create, detail, and status responses omit provider-private
`careNotes`. Provider and admin booking responses retain the fields needed for
their workflows.

`POST /bookings` accepts an optional allowlisted `source` attribution value
(`instagram`, `qr-card`, `text`, `facebook`, `website`) from provider
booking-page share links. Unknown values are dropped server-side (never stored,
never an error); the value is never used for authorization or pricing and is
never exposed on public endpoints.

Service-area and travel-buffer enforcement (roadmap #12): booking creation,
client immediate reschedules (`PATCH /bookings/:id/status` →
`rescheduled`), provider proposal creation
(`POST /bookings/:id/reschedule-requests`), and proposal acceptance
(`POST /reschedule-requests/:id/accept`) all revalidate the location against
the provider's CURRENT active coverage and reject out-of-area requests with
409 (`reason: "outside_service_area"`), then enforce the centrally managed
travel/setup buffer between the provider's appointments with 409
(`reason: "travel_buffer_conflict"`). The server is authoritative; existing
confirmed bookings are never silently cancelled by coverage changes.

---

## Reviews

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /reviews | client | Submit review (completed booking only) |
| GET | /reviews/booking/:bookingId | client | Get the client's review for an owned booking |
| GET | /reviews/:id | auth | Get review |

---

## Invoices

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /invoices | auth | Own invoices (scoped by role) |
| GET | /invoices/:id | auth | Invoice detail (own only) |

---

## Support

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /support/tickets | auth | Own tickets |
| POST | /support/tickets | auth | Create support ticket |
| GET | /support/tickets/:id | auth | Ticket detail + messages |
| POST | /support/tickets/:id/messages | auth | Reply to ticket |

---

## Admin

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /admin/metrics | admin | Platform health metrics |
| GET | /admin/pilot/metrics | admin | Pilot operations metrics: window, summary, per-provider activation milestones/outcomes/risk flags, source attribution. Privacy-redacted (no client identity, addresses, notes, or document references). Access audit-logged. `docs/pilot/pilot-metrics-dashboard.md` |
| PATCH | /admin/pilot/providers/:providerId/retention | admin | Upsert provider retention intent (`yes`/`no`/`unknown`); admin actor recorded in `updated_by` |
| GET | /admin/users | admin | All users (paginated) |
| GET | /admin/users/:id | admin | User detail |
| PATCH | /admin/users/:id/status | admin | Activate/deactivate user |
| GET | /admin/providers | admin | All providers + verification status |
| PATCH | /admin/providers/:id/verification | admin | Update verification status |
| GET | /admin/bookings | admin | All bookings |
| GET | /admin/reviews | admin | All reviews |
| PATCH | /admin/reviews/:id/visibility | admin | Hide/show a review |
| GET | /admin/support/tickets | admin | All support tickets |
| PATCH | /admin/support/tickets/:id/status | admin | Update ticket status |
| POST | /admin/support/tickets/:id/messages | admin | Respond to ticket |

## Cancellation/no-show + minimal support (roadmap #13 — added 2026-08-26)

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/bookings/:id/cancellation-preview` | owner (client/provider/admin) | Server-computed consequence of cancelling now: `free` / `late` / `provider` / `unavailable`, notice hours, `freeUntil`, calm copy. Non-owners: non-leaking 404. |
| GET | `/api/bookings/:id/outcome-history` | owner | Append-only cancellation/no-show history, newest first. `reasonSnapshot`/`actorUserId` are admin-only (cross-party redaction). |
| POST | `/api/support/escalations` | client/provider (booking party) | Escalate a TERMINAL booking (cancelled/no_show/completed) into a support ticket (`support_tickets.booking_id`). Idempotent per unresolved booking+user escalation. |
| GET | `/api/support/bookings/:bookingId/escalations` | admin (support role) | Tickets + FULL outcome history incl. private fields. Audit-logged. Never callable by regular users (403). |
| PATCH | `/api/support/escalations/:ticketId` | admin (support role) | Update state (`open`/`in_progress`/`resolved`), record mediation note, correct a disputed outcome (`completed`/`cancelled` + mandatory reason → `support_corrected` history row), or suspend a booking party (`users.is_active=false`). Audit-logged. |

`PATCH /api/bookings/:id/status` changes (#13): cancelling computes and stores
`cancellationCategory` (client_cancelled_early / client_cancelled_late /
provider_cancelled / cancelled_by_support); providers must send an allowlisted
`reasonCategory`; `no_show` additionally requires the scheduled time to have
passed and records `noShowMarkedBy`/`noShowMarkedAt`. Every cancel/no-show
appends a `booking_outcome_history` row in the same transaction.
Public `GET /api/booking-pages/:slug` now includes
`cancellationPolicy: { noticeHours, summary }` (safe fields only).

## Pilot Operations Dashboard Part 2 (2026-08-28) — no new API routes

Part 2 added the web route `/admin/pilot` (platform administrator only). It
introduces **zero** new API endpoints: it consumes the Part 1 routes
`GET /api/admin/pilot/metrics` and
`PATCH /api/admin/pilot/providers/:providerId/retention` through the
generated client hooks. CSV export is generated client-side from the
authorized metrics payload — deliberately no server export endpoint.

## Provider Approval Status & Activation Hub (2026-08-28)

One new provider-owned, read-only endpoint:

```text
GET /api/providers/me/activation-status
```

- Gating: `requireAuth` + provider membership (same policy as
  `GET /providers/application/status` and `GET /providers/me/booking-page`) —
  readable in EVERY application state, because the activation hub exists for
  providers who are not yet approved. Clients and platform admins get 403
  (no admin provider-view bypass). Errors are generic and non-leaking.
- Response: `ProviderActivationStatusResponse` — application status +
  provider-visible `rejectionReason` + the same capability flags as the
  status view; status-level verification progress (`not_started | submitted |
  under_review | needs_update | approved`, latest submission time,
  `canResubmit`); nine journey milestones (account, profile, verification,
  approval, #12 coverage, active service, availability, #11 publish, first
  booking) proven from raw source rules; `milestonesCompleted/Total`; the #11
  `bookingPage` view; and a journey-ordered `nextAction` code.
- Deliberately read-only and composition-only: reuses `buildStatusView`,
  `computeReadiness`, `hasActiveServiceAreaCoverage`, `bookingPageView`, and
  a `LIMIT 1` bookings probe. No schema change, no migration, no writes.
- Never returns reviewer-private notes, reviewer identity, raw document
  references/file names, internal scoring, platform pilot metrics, retention
  intent, risk flags, client data, or audit metadata
  (`test:activation-status` enforces the redaction contract).

The hub web page (`/provider/application-status`) otherwise consumes only
existing endpoints (`/providers/application/status` for submission history,
`/providers/me/booking-page` via the existing BookingPageCard,
`/support/contact`, and the existing reset/resubmit mutations).

## Update (2026-08-28) — Provider Dashboard Phase A

`GET /providers/me/dashboard` response extended with `pendingReschedules`:
`{ count, nextRequest }` — client-initiated reschedule requests awaiting the
provider's confirm/decline (bookings currently in status `rescheduled`).
Derived from the booking rows the endpoint already loads (owner-scoped,
read-only, no additional query, not capped by the 30-day upcoming window).
`nextRequest` is the soonest requested time and carries the same privacy
trims as the rest of the payload (first name + last initial, FSA/city —
never full addresses; no client PII beyond existing authorized provider
booking display). No new endpoint, no schema change, no migration. OpenAPI
(`lib/api-spec/openapi.yaml`) updated and clients regenerated.
