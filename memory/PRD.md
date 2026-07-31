# OnCall Foot — Product Requirements

_Last updated: Feb 2026_

---

## 1. Product Vision

**OnCall Foot** is a premium, mobile-first **marketplace and operating system for certified mobile foot care providers** who travel to clients' homes. It is a three-portal product built on one shared marketplace lifecycle.

**Not** a booking site. **Not** a solo scheduling tool. A provider-first vertical marketplace + workflow OS that offers:
- **Providers** — an all-in-one mobile business dashboard
- **Clients** — trusted discovery and easy in-home booking
- **Admin / marketplace ops** — trust, verification, monetization and oversight

**Brand tone:** calm, clinical, premium, trustworthy, operationally useful, mobile-first. Calm.com × Square Appointments × a clinical wellness brand.

---

## 2. Portals & Roles

| Portal | Primary role | Purpose |
| --- | --- | --- |
| Provider Portal | `provider` | Run a mobile foot care practice from a phone |
| Client Portal | `client` | Discover trusted providers and book in-home visits |
| Marketplace / Admin | `admin` | Trust, verification, moderation, monetization, oversight |

RBAC-first. Future-friendly roles scaffolded but inert: `support_agent`, `compliance_reviewer`, `finance_admin`, `marketplace_manager`.

**One shared lifecycle** underneath all three:
```
Provider joins → verified → publishes services + availability + coverage
  → Client discovers → requests booking
  → Provider accepts/confirms/completes/cancels
  → Invoice on complete → Client reviews
  → Admin observes, moderates, monetizes throughout
```

---

## 3. Current Truth (what actually exists in the repo)

### ✅ Built and tested
- **Provider auth:** register / login / logout / refresh / `/me` with JWT httpOnly cookies (60m access + 7d refresh), bcrypt hashing, brute-force lockout (5 fails/15min per `{ip}:{email}`)
- **Provider onboarding:** 3-step wizard (name + photo, bio, certifications) → `PUT /api/providers/me`
- **Provider portal shell:** mobile-first container, glass bottom nav, protected routes, onboarding gating, sage-green wellness design system, Manrope + DM Sans typography
- **Backend architecture (refactored):** modular layout `app/{core,db,models,repositories,services,routers}` — portable across Emergent / Replit / Railway / local
- **RBAC scaffolding:** centralized `Role` and `Permission` enums, `ROLE_PERMISSIONS` map, `require_permission` dependency. Only `provider` role active today; `client` and `admin` sets defined for zero-rewrite extension
- **Route architecture:** canonical `/provider/*` group with nested layout; `/` redirects to `/provider`. `ROUTES` constants file — no hardcoded paths
- **Service catalog (Checkpoint 2):** full CRUD (list, create, edit, active toggle, soft delete), React Query with optimistic updates + rollback + on-settled invalidation, mobile-first bottom-sheet form, delete confirmation
- **Provider dashboard summary:** `GET /api/dashboard/provider-summary` returns active services count (bookings/earnings stubbed at 0)

### 🟡 Scaffolded only (no UI, no writes)
- Client `Role` + permission set
- Admin `Role` + permission set
- Booking / Invoice / Review / Verification / Subscription / Featured status enums (`app/core/constants.py`) — used for shared vocabulary only
- Route groups `/client/*` and `/admin/*` reserved but not mounted

### 🔴 Not built yet (future roadmap)
- Client portal (any of it)
- Admin portal (any of it)
- Monetization UI (plans, subscriptions, featured slots, commissions, payouts)
- Booking system + state machine
- Invoices + PDF generation
- Reviews list
- Verification workflow
- Availability + travel zones
- Seed data (deferred to Checkpoint 4)
- Payments / payouts
- Marketplace discovery flow

---

## 4. Provider Portal — Checkpoint Roadmap

Provider portal is the **only active build**. All other work is deferred until provider is functionally complete.

| # | Checkpoint | Status |
| --- | --- | --- |
| 1 | Foundation & Auth (register, login, onboarding, shell, guards) | ✅ Built |
| 2 | Services CRUD (name, description, category, duration, price, active, soft delete) | ✅ Built |
| 3 | Weekly Availability + Travel Zones (radius / pincodes) | ✅ Built |
| 4 | Bookings Inbox + state machine + **seed mock bookings** | ✅ Built |
| 5 | Earnings summary + Invoices (printable HTML + PDF download) | ✅ Built |
| 6 | Reviews (read-only list + rating breakdown + seed) | ✅ Built |
| 5 | Earnings summary + Invoices (printable HTML + PDF download) | Planned |
| 6 | Reviews (read-only list + rating breakdown + seed) | Planned |

Demo-ready upgrades to add during the remaining provider checkpoints: active services count on home (done for 2), upcoming bookings widget, earnings this week card, profile completion progress, verification badge placeholder, review score teaser, polished empty states.

---

## 5. Scope Table (source of truth)

| Area | Status |
| --- | --- |
| Provider auth / onboarding / shell | Built |
| Provider services | Built |
| Provider availability | Built |
| Provider bookings | Built |
| Provider earnings / invoices | Built |
| Provider reviews | Built |
| Provider earnings / invoices | Planned (Checkpoint 5) |
| Provider reviews | Planned (Checkpoint 6) |
| Client portal | Not built |
| Admin portal | Not built |
| Seed data | Deferred to Checkpoint 4 |
| Monetization UI | Not built |
| Monetization schema stubs | Optional / cheap only, not applied yet |
| Payments / payouts | Not built |
| Push / SMS notifications | Not built |
| Maps / geocoding | Not built |

---

## 6. Tech Stack

- **Frontend:** React 19, react-router v7, TailwindCSS 3 + Shadcn UI, @tanstack/react-query 5, axios, sonner, lucide-react. Fonts: Manrope + DM Sans.
- **Backend:** FastAPI, `motor` async MongoDB, PyJWT, bcrypt.
- **Auth:** JWT in httpOnly cookies (access 60m + refresh 7d) with Bearer fallback.
- **API prefix:** every backend route is under `/api` (Kubernetes ingress rule).
- **Env:** `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS` in `backend/.env`; `REACT_APP_BACKEND_URL` in `frontend/.env`.
- **Portable:** stack works unchanged on Emergent, Replit, local dev, GitHub, Railway.

---

## 7. Data Model — Current

### `users`
`_id, email (unique), password_hash, name, role, photo, bio, certifications[], onboarding_complete, created_at`

### `login_attempts`
`identifier ({ip}:{email}), count, last_attempt`

### `services` (Checkpoint 2)
`_id, provider_id, name, description, category, duration_minutes, price_cents, currency, active, display_order, deleted_at (soft-delete), created_at, updated_at`
Indexes: `provider_id`, `(provider_id, deleted_at)`

---

## 8. Data Model — Reserved (not yet created)

Names locked so future work slots in without rename churn:
`provider_profiles, client_profiles, households, availability, travel_zones, bookings, invoices, reviews, verification_submissions, admin_notes, disputes, support_threads, plans, subscriptions, commission_rules, featured_slots, payout_records, audit_logs`

---

## 9. API Surface — Current

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account, sets cookies |
| POST | `/api/auth/login` | Login, sets cookies |
| POST | `/api/auth/logout` | Clear cookies |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/providers/me` | Onboarding / profile update |
| GET | `/api/services` | List provider's services (excl. soft-deleted) |
| POST | `/api/services` | Create service |
| GET | `/api/services/{id}` | Get one |
| PUT | `/api/services/{id}` | Update |
| PATCH | `/api/services/{id}/toggle` | Flip active |
| DELETE | `/api/services/{id}` | Soft delete |
| GET | `/api/dashboard/provider-summary` | Active services + booking/earning stubs |

---

## 10. Route Map — Frontend

**Canonical.** All paths come from `frontend/src/lib/routes.js`.

```
/login, /signup, /onboarding                    public / auth flow
/                                               → redirects to /provider
/provider                                       provider home
/provider/services                              service catalog (Checkpoint 2)
/provider/bookings                              placeholder (Checkpoint 4)
/provider/earnings                              placeholder (Checkpoint 5)
/provider/profile                               profile + logout

/client/*                                       reserved, not mounted
/admin/*                                        reserved, not mounted
```

---

## 11. Non-Goals for This Cycle

Explicitly out of scope until the provider portal is done:
- No client-facing UI or discovery
- No admin UI or moderation flows
- No live monetization or checkout
- No seed data (starts in Checkpoint 4)
- No payments integrations, push, SMS, or maps
- No PDF invoicing yet

---

## 12. Deployment / Portability

- Backend supervisor entrypoint: `server:app` (thin re-export of `app.main:app`)
- Frontend served on port 3000, backend on 8001 (K8s ingress routes `/api` to 8001)
- No vendor-locked patterns; app has no dependency on Emergent runtime
- GitHub remains the source of truth
