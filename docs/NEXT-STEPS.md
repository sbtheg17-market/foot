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
PORT=8001 pnpm --filter @workspace/api-server run test:availability # 3
PORT=8001 pnpm --filter @workspace/api-server run test:pressure     # 13
```
Demo logins (all password `demo1234`): `sarah@oncallfoot.com` (provider), `mike@oncallfoot.com` (provider), `jane@oncallfoot.com` (client), `tom@oncallfoot.com` (client), `admin@oncallfoot.com` (admin).

## Task order (checkpoint = one commit + push each)

> **STATUS: all 4 tasks below are DONE and pushed (Session 018, commits `49d049c`, `9730a7f`, `183c255`, `94d629b`). 95 tests green.**

### 1) Availability preset — "9–5 weekdays"  ✅ DONE
One-tap weekday 09:00–17:00 preset on the provider availability screen. Reuses the existing availability save path; idempotent + reapplyable; manual edits still work; mobile-first. Tests: `pnpm --filter @workspace/api-server run test:availability`.
Files: `artifacts/web/src/pages/portal/availability.tsx` (`applyWeekdayPreset`), `artifacts/api-server/src/__tests__/availability-preset.test.ts`.

### 2) Booking filters  ✅ DONE
Status-chip filters (requested / confirmed / completed) with live count badges on the provider bookings inbox. Local, presentational — single fetch, `useMemo`-derived counts/filtering; no writes, no state-machine changes.
Files: `artifacts/web/src/pages/portal/bookings.tsx`.

### 3) Tap-to-reach  ✅ DONE
Client phone is a `tel:` link and address a `https://maps.google.com/?q=` link on booking cards. `GET /bookings` now left-joins `users` to return `clientFirstName/LastName/Phone` (additive OpenAPI fields; client regenerated).
Files: `artifacts/api-server/src/routes/bookings.ts`, `lib/api-spec/openapi.yaml`, `artifacts/web/src/pages/portal/bookings.tsx`.

### 4) Earnings export  ✅ DONE
Printable HTML earnings statement (browser print-to-PDF; no PDF dependency) derived from **completed bookings only** via read-only `GET /providers/me/earnings/export`. Page: `/provider/earnings/statement` with print-CSS (`print:` variants hide navs/toolbar). No Stripe.
Files: `artifacts/api-server/src/routes/providers.ts`, `artifacts/web/src/pages/portal/earnings-statement.tsx`, `earnings.tsx`, `lib/routes.ts`, `App.tsx`, `components/layout/provider-layout.tsx`.

## Provider profile depth ✅ DONE
- Added a provider trust checklist with completion progress and direct links to finish profile, services, and credentials.
- Public web and mobile profiles now show real avatars when available, clearer credential verification, new-client availability, service-area notes, and service eligibility notes.
- No schema, upload dependency, booking, notification, or payment changes were needed.

## What's next (pick with the user)
- Client portal activation (currently scaffolding only — needs explicit request).
- Stripe payments (explicitly out of scope until requested).

## Operational rules
- After each chunk: `pnpm run build` + relevant tests green → commit → **push to origin/main**.
- Append a `.agents/LOG.md` entry per checkpoint (update Current Build State + Next Best Action).
- Never batch unrelated tasks into one commit. If a task grows, split into a shared-foundation commit + a feature commit.
- If you must stop early: commit what's stable, push, and record exactly what remains in `.agents/LOG.md` "Next best action".

## Credit-tight mode
Do **Task 1 only**, stop, push, then ask for the next task.
