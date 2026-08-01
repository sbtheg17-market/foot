# Foot-Care Marketplace OS — PRD

## Problem Statement (original)
Web-based marketplace for in-home foot care. Three portals: clients book visits, providers manage services/availability/earnings, admins verify providers and monitor platform revenue. Continues the sbnem01foot2/foot handoff. Re-implemented on Emergent's native FastAPI + MongoDB + React stack while preserving the full domain model.

## User Personas
- **Client** — books in-home services; browses/filters providers; pays with Stripe; tracks status.
- **Provider (Maya/Jordan/Alex seed, or self-signup)** — dashboard with bookings, earnings (commission math), availability editor, and **Opportunity insights** driven by real search/booking data.
- **Admin (sbtheg04@gmail.com)** — Google-authed. Reviews document uploads, approves/rejects providers, toggles listing_active, monitors GMV & commission revenue.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Auto-seeds on empty DB. Modules: `server.py`, `seed.py`, `sms.py` (Twilio stub), `opportunities.py`, `storage_client.py` (Emergent object storage).
- **Frontend**: React + TanStack Query + shadcn/ui + Tailwind. Fonts: Outfit/DM Sans. Palette: forest #2C4C3B + terracotta.
- **Auth**: Emergent Google OAuth — session_token httpOnly cookie, 7-day expiry, `user_sessions` collection. Roles: admin/provider/client with `ADMIN_EMAILS` env allow-list and provider linking by `owner_email`.
- **Payments**: Stripe (Flow A claimable sandbox) — booking POST creates a Checkout Session; `payment_transactions` collection; webhook + poll-based reconciliation.
- **Storage**: Emergent object storage for provider verification docs.
- **SMS**: Twilio stub — logs booking_requested + booking_accepted messages to `sms_log`. Swap `sms.py` internals to enable real SMS.

## Implemented — Phase 2 (2026-02)
### Phase 1 recap
- Client discovery, provider profile with availability-aware booking, client bookings history, provider dashboard (accept/decline/complete + earnings + availability editor), admin verification queue + listings + revenue.

### Phase 2 additions
- **Emergent Google Auth** — real cookie-based sessions, role-based routing (auth-callback → admin/provider/client), `require_admin` on all admin endpoints, auto-fill of client name/email at checkout, admin-only impersonation picker on /provider dashboard.
- **Provider self-signup** at `/become-provider` — profile fields, categories, weekly hours, travel zone, and file upload (Emergent object storage) → lands in admin queue as `status=pending`.
- **Stripe checkout** at booking time — Flow A sandbox provisioned; `checkout.session.completed` + poll fallback updates booking's payment_status; success/cancel pages included.
- **Provider Opportunities (first-class)** — real signals from `search_events` + booking history: category demand in your city, evening demand, weekend demand, senior-friendly interest, verified filter usage. Tone-coded cards.
- **Twilio SMS stub** — `booking_requested` message on booking creation + `booking_accepted` message on provider Accept. All messages logged to `sms_log` with status="stubbed".
- **Analytics** — `POST /api/analytics/search` fires (debounced) whenever a client uses filters, feeding the opportunity engine with real data.

## Backlog
### P0
- Real Twilio credentials (currently stubbed) — flip a single env-driven switch in `sms.py`
- Provider ratings/reviews post-completion
### P1
- Stripe Connect payouts (client charge is captured, provider payout is not yet routed)
- Plan upgrade flow (Free/Pro/Premium billed via Stripe subscription)
- Map view for travel_zone radius
- Client-side notifications (email + SMS reminders)
### P2
- React Native app on the same API
- i18n

## Assumptions
- Twilio deliberately stubbed per user request; message templates and interface are Twilio-ready.
- Stripe uses claimable sandbox — user can claim via onboarding_url whenever ready.
- Preview environment cross-domain cookies work because CORS uses reflected origin + secure/samesite=none.
