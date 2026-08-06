# API Routes

All routes are prefixed with `/api`. Auth middleware details: see `docs/roles-and-permissions.md`.

---

## Auth

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /auth/register | public | Register new user (client or provider) |
| POST | /auth/login | public | Login, returns JWT |
| POST | /auth/logout | auth | Invalidate session (client-side token drop) |
| GET | /auth/me | auth | Current user profile |
| POST | /auth/password-reset/request | public | Request password reset email (placeholder) |
| POST | /auth/password-reset/confirm | public | Confirm password reset (placeholder) |

---

## Marketplace / Provider Discovery

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /providers | public | Browse providers (filter: city, service, rating, verified) |
| GET | /providers/:id | public | Provider public profile |
| GET | /providers/:id/services | public | Provider's active services |
| GET | /providers/:id/reviews | public | Provider's reviews |

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

---

## Bookings

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /bookings | auth | Own bookings (scoped by role) |
| POST | /bookings | client | Create a booking request |
| GET | /bookings/:id | auth | Booking detail (own only) |
| PATCH | /bookings/:id/status | auth | Update status (role-restricted transitions) |

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
