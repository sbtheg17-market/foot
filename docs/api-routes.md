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
| GET | /providers/me/travel-zones | provider | Get travel zones |
| POST | /providers/me/travel-zones | provider | Add a travel zone |
| DELETE | /providers/me/travel-zones/:id | provider | Remove a travel zone |
| POST | /providers/me/verification | provider | Submit verification doc metadata |
| GET | /providers/me/verification | provider | Own verification status |
| GET | /providers/me/earnings | provider | Earnings placeholder summary |
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
