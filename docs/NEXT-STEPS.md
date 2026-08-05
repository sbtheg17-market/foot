# NEXT STEPS — Resumable Build Plan

> **Read this first, then `.agents/LOG.md` (latest entry) and `replit.md`.**
> This file is the durable handoff so any agent, on any host, can continue.

## Where the build stands (origin/main)
- **Canonical stack:** Node/Express + TypeScript + PostgreSQL + React/Vite + Expo monorepo (pnpm workspaces).
- The `conflict_*` branches are a **different** stack (React + FastAPI + MongoDB) → **reference only, never merge**.
- Repo **builds, typechecks, runs, and deploys as a single service** (Express serves `/api/*` + the built React SPA). See `docs/deployment-notes.md`.
- **Provider-first:** `/` → `/provider`; canonical routes under `/provider/*`; legacy `/portal/*` redirects. Route constants in `artifacts/web/src/lib/routes.ts`.
- Booking state machine, notifications (SSE + Expo push), auth, and RBAC are **stable and passing (92 tests)**. Do not regress them.
- **No Stripe. No new client/admin portals** (they exist only as scaffolding).
- **GitHub is the source of truth** — push every stable checkpoint to `origin/main`.

## Guiding principles
1. Work in the smallest coherent vertical slice.
2. Don't touch unrelated areas mid-checkpoint.
3. Keep changes compatible with the single-service deploy.
4. Preserve booking/notification/auth/RBAC/hosting logic.
5. Push each stable chunk to `origin/main` immediately.
6. Reuse existing models/API/UI; add backend only if the UI truly needs it.
7. Prefer deriving new state from existing source-of-truth data.
8. Add only the tests that prove the feature + guard existing behavior.

## Verify locally before pushing
```bash
# Postgres (this workspace installs it locally; Railway uses managed PG)
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oncallfoot" JWT_SECRET="local-dev-secret"
pnpm install
pnpm run db:push          # idempotent schema push
pnpm run seed             # demo data (accounts below)
pnpm run build            # typecheck + web + api  (must be green)
PORT=8001 NODE_ENV=production pnpm run start   # serves API + web on :8001
# Integration/pressure tests hit a live server on $PORT:
PORT=8001 pnpm --filter @workspace/api-server run test           # 63 unit
PORT=8001 pnpm --filter @workspace/api-server run test:integration  # 16
PORT=8001 pnpm --filter @workspace/api-server run test:pressure     # 13
```
Demo logins (all password `demo1234`): `sarah@oncallfoot.com` (provider), `mike@oncallfoot.com` (provider), `jane@oncallfoot.com` (client), `tom@oncallfoot.com` (client), `admin@oncallfoot.com` (admin).

## Task order (checkpoint = one commit + push each)

### 1) Availability preset — "9–5 weekdays"  ← DO FIRST
One-tap weekday 09:00–17:00 preset on the provider availability screen. Reuse the existing availability save path; idempotent + reapplyable; manual edits still work; mobile-first. No new scheduling engine.
Files: `artifacts/web/src/pages/portal/availability.tsx` (+ availability API in `lib/api-spec` / `artifacts/api-server/src/routes/providers.ts` only if a bulk-set path is missing).

### 2) Booking filters
Status-chip filters (requested / confirmed / completed) on the provider bookings inbox. Local, presentational state derived from existing booking data — no writes, no state-machine changes.
Files: `artifacts/web/src/pages/portal/bookings.tsx`.

### 3) Tap-to-reach
Make client phone `tel:` and address `https://maps` links on the booking detail/card (mobile). Presentational unless a field is missing (then add the smallest model/API mapping).
Files: booking card/detail in `artifacts/web/src/pages/portal/bookings.tsx` (and mobile `artifacts/mobile` if extending there).

### 4) Earnings export
Printable HTML invoice (+ PDF if a light path already exists) derived from **completed** bookings only. Provider-facing, read-only export endpoint if needed. No Stripe.
Files: `artifacts/web/src/pages/portal/earnings.tsx`; invoices already exist in `artifacts/api-server/src/routes/invoices.ts`.

## Operational rules
- After each chunk: `pnpm run build` + relevant tests green → commit → **push to origin/main**.
- Append a `.agents/LOG.md` entry per checkpoint (update Current Build State + Next Best Action).
- Never batch unrelated tasks into one commit. If a task grows, split into a shared-foundation commit + a feature commit.
- If you must stop early: commit what's stable, push, and record exactly what remains in `.agents/LOG.md` "Next best action".

## Credit-tight mode
Do **Task 1 only**, stop, push, then ask for the next task.
