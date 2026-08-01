# Foot-Care Marketplace OS — PRD

## Problem Statement (original)
Web-based marketplace for in-home foot care. Three portals: clients book visits, providers manage services/availability/earnings, admins verify providers and monitor platform revenue. Continues the sbnem01foot2/foot handoff — the previous stack (pnpm/Express/Drizzle) is re-implemented on Emergent's native FastAPI + MongoDB + React stack while preserving the full domain model (commission math, availability rules, travel zones, plan tiers, verification queue, listing_active toggle).

## User Personas
- **Client** — books in-home massage, pedicure, wellness visits; browses/filter providers; tracks booking status.
- **Provider (Maya, Jordan, Alex seed)** — sees today's bookings, accepts/declines, edits weekly hours + blocked dates + travel zone + min lead, reviews earnings breakdown (GMV / platform fee / net) and plan tier.
- **Admin** — approves/rejects providers via docs, toggles listing_active, watches GMV & commission revenue with weekly/daily views.

## Architecture (this phase)
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (motor). Auto-seeds curated providers/services/bookings on first startup via `/app/backend/seed.py`.
- **Frontend**: React + TanStack Query + shadcn/ui + Tailwind, palette Forest #2C4C3B + Terracotta #C08261 + Bone White #F9FBF9. Fonts: Outfit (headings), DM Sans (body).
- **API prefix**: `/api`. Endpoints: providers listing/filtering, provider detail, services, availability (slot generator respecting weekly_hours/blocked_dates/min_lead), bookings CRUD + status updates, provider earnings, availability updates, admin verification, admin listing toggle, admin revenue (weekly/daily buckets).

## Implemented (2026-02-XX — Phase 1-3 + polish)
- Client portal: hero, filters (city, category, senior-friendly, verified, search), provider grid, sticky nav
- Provider profile: cover/avatar/badges, services selection, availability-aware time picker (14 days horizontal scroll + hour slots), booking form + confirmation screen
- Client bookings history (email-scoped)
- Provider dashboard: identity switcher, status/plan/listing badges, bookings tab with accept/decline/complete, earnings widget (net / upcoming / platform fee), availability editor (weekly hours per day, blocked dates, travel zone, min lead), server persistence
- Admin: verification queue with document links + approve/reject, listings table with per-row listing_active switch, revenue dashboard (weekly/daily toggle, 4 stat cards, GMV bar chart)
- Cross-cutting: LoadingBlock/EmptyState/ErrorBlock, sonner toasts, consistent StatusBadge + PlanBadge

## Prioritized Backlog
### P0 — next
- Real auth (Emergent Google or JWT) replacing seeded provider IDs
- Provider onboarding wizard (new provider self-signup flowing into admin queue)
### P1
- Provider reviews/ratings after completed bookings
- Client email/SMS confirmation via Twilio/Resend
- Payments capture via Stripe (commission math is already computed, needs to be charged)
- Geo/map search using travel_zone radius
### P2
- Plan upgrade flow with Stripe billing (Free → Pro → Premium placement boost)
- Provider "opportunity" cards (unmet demand insights)
- Multi-language support
- React Native app reusing the same API

## Assumptions
- Auth is deferred per handoff — provider identity is a demo picker; admin portal is open.
- Payments are computed only (no charging this phase).
- Emergent supervisor manages the FastAPI + React processes; pnpm/Express stack is not deployed.
