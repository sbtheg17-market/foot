# OnCall Foot — Provider Dashboard PRD

## Original Problem Statement
Mobile-first web dashboard for certified foot care providers to manage their business: profile, services, availability, bookings, earnings, and reviews. Part of the OnCall Foot three-sided marketplace. Built checkpoint by checkpoint, one at a time, with review after each.

## Tech Stack & Architecture
- Frontend: React (CRA + craco), Tailwind, Shadcn UI, React Query, react-router v7
- Backend: FastAPI, JWT auth (httpOnly cookies: access 60min + refresh 7d), bcrypt, PyJWT
- DB: MongoDB (motor). Collections: users, login_attempts (bookings, services, availability, invoices, reviews to come)
- Design: "Organic & Earthy" sage green theme (see /app/design_guidelines.json), Manrope + DM Sans, bottom nav, 44px tap targets

## User Personas
- Certified mobile foot care specialist managing bookings/earnings on the go (390px mobile-first)

## User Choices
- Sage green accent; seed mock bookings + reviews when built; invoice = printable HTML view AND PDF download; strict checkpoint-by-checkpoint delivery (stop after each for review)

## Implemented (June 2026)
### Checkpoint 1 — Foundation & Auth ✅ (tested, iteration_1.json)
- POST /api/auth/register, /login, /logout, /refresh; GET /api/auth/me
- Brute force lockout (5 fails → 15 min, X-Forwarded-For aware), unique email index, bcrypt hashing
- PUT /api/providers/me — onboarding (name, photo base64, bio, certifications[]), sets onboarding_complete
- Frontend: AuthContext (null/false/user), ProtectedRoute (+onboarding gating), Login, Signup, 3-step Onboarding wizard, Home dashboard shell, Profile page with logout, BottomNav (Home/Bookings/Services/Earnings/Profile), ComingSoon placeholders
- Test creds: provider@test.com / test1234 (see /app/memory/test_credentials.md)

## Backlog (priority order — user wants sequential checkpoints)
- P0 Checkpoint 2: Services CRUD (name, description, duration, price, active toggle)
- P0 Checkpoint 3: Weekly availability + travel zones (radius/pincodes)
- P0 Checkpoint 4: Bookings inbox, detail view, state machine (accept→confirm→complete/cancel), seed mock bookings
- P1 Checkpoint 5: Earnings summary (today/week/month), auto invoices, printable HTML + PDF download
- P1 Checkpoint 6: Reviews read-only list + rating breakdown, seed mock reviews
- P2 (deferred by user): client app, admin panel, Stripe payments, maps, push/SMS

## Next Task
Checkpoint 2 — Services Management (awaiting user go-ahead after Checkpoint 1 review).
