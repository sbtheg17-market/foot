# plan.md — OnCall Foot Continuation Plan (canonical main only)

## 1) Objectives
- Re-establish a **working local runtime** of the real OnCall Foot app from **canonical `main` = `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a`** (no conflict branches).
- Prove the **core workflow (POC)**: DB + API + web wiring works end-to-end inside the FARM container constraints.
- Capture an auditable local dev workflow: **local commits + patch artifacts**, no pushing from this workspace.
- After baseline is stable: **re-derive** the lost Phase 4C comfort-profile contract and provider-economics contract (docs only), then implement in approved order.

## 2) Implementation Steps

### Phase 1 — Core POC: “Real app runs in this container” (do not proceed until green)
**Core risk:** FARM supervisor is wired to a *different* template (FastAPI+React+Mongo). We must adapt `/app/backend` + `/app/frontend` entrypoints to run Foot’s Node/Express + Vite while preserving the ingress contract (`/api/* → 8001`, rest → 3000).

**User stories (POC)**
1. As a developer, I can start Postgres and the app locally without leaking secrets or editing tracked `.env` files.
2. As a user, I can load the web app in the preview URL and see the landing/discovery UI.
3. As a user, I can log in with a seeded demo account and land in the correct role portal.
4. As a provider, I can view my dashboard/readiness UI and navigate key screens without crashes.
5. As a client, I can browse providers and initiate the booking flow using the live API.

**Steps**
1. **Clone/verify canonical repo** into `/app/foot` and hard-check:
   - `git rev-parse HEAD == 3e76114...`
   - working tree clean.
2. **Install pnpm 9.15.0** (no global lockfile changes); run `pnpm install` from repo root.
3. **Install + run local PostgreSQL** (local-only; no Gate B claims). Create a local DB + user; set `DATABASE_URL` via **untracked** `/app/foot/.env` (from `.env.example`).
4. Set `JWT_SECRET` (random) and other required env vars (untracked only).
5. **DB bring-up**:
   - `pnpm --filter @workspace/db run push`
   - `pnpm run seed` (only if documented in repo).
   - Record demo creds in `/app/memory/test_credentials.md` (not in git).
6. **Bridge FARM supervisor to Foot runtime**:
   - Backend: replace `/app/backend/server.py` with a small FastAPI service that reverse-proxies `/api/*` to the Foot Express server running on an internal port (spawned as a managed subprocess on startup; ensure clean shutdown).
   - Frontend: update `/app/frontend` to start the Foot Vite dev server (or serve built SPA) on `0.0.0.0:3000`.
   - Keep ingress behavior intact: `/api/*` must reach Express, all other routes serve the web UI.
7. **Verification (must pass before any product work):**
   - `pnpm run typecheck`
   - `pnpm run build`
   - API suites: `pnpm --filter @workspace/api-server run test` + `test:integration` + `test:provider-notifications` + `test:provider-readiness` (and any other currently “green by default” suites).
   - Manual smoke: preview URL load, login with demo accounts, provider portal nav, client discovery.
8. **Record baseline report** (before editing product code):
   - commands run, service ports, env setup approach, test results, remaining blockers.
   - Save to `/app/memory/bootstrap_report.md`.

### Phase 2 — V1 continuation: contract reconstruction (docs only; no code)
**User stories (contracts)**
1. As a client, I can express comfort/preferences in an optional, consent-first way.
2. As a client, I can withdraw consent and control what providers see.
3. As a provider, I only see a booking-scoped, minimal projection of client preferences.
4. As a provider, I can set boundaries/buffers and see advisory economics without platform coercion.
5. As an admin/operator, I can confirm the contracts do not weaken RBAC, privacy, or booking-state rules.

**Steps**
1. Read: `.agents/LOG.md`, `.agents/NEXT_TASK.md`, `docs/product-vision.md`, `docs/ux-guidelines.md`, `docs/roles-and-permissions.md`, `docs/booking-statuses.md`, `docs/data-models.md`, `docs/api-routes.md`.
2. Re-derive **Phase 4C comfort-profile contract** as a new candidate document:
   - consent-first, owner-scoped, additive structured fields, no sensitive free-text; per-category visibility; versioned; withdrawable; booking-scoped provider projection.
3. Re-derive **provider-economics contract** as a separate candidate, preserving pinned requirements:
   - provider boundary settings; advisory-only economics; provider-controlled capped deals with preview; explicit exclusions (no forced discounts/acceptance/ranking changes/opaque guarantees).
4. Save both contracts to `/app/memory/contracts/` with SHA-256 checksums and request human approval.

### Phase 3 — Approved implementation (incremental, contract-first)
**User stories (comfort profiles + economics)**
1. As a client, I can create/update my comfort profile and control visibility.
2. As a provider, I can view only the allowed preference projection for an active booking.
3. As a provider, I can configure buffers/min booking value/preferred blocks and see how it impacts opportunities.
4. As a provider, I can preview deal impact (earnings + calendar) before publishing.
5. As a system, all new endpoints are spec’d in OpenAPI first and validated via existing test harness.

**Steps (only after Phase 2 approval)**
1. Comfort profiles (C-2): `openapi.yaml` → codegen → DB schema/migration (if approved) → API routes → web UI (mobile-first) → tests.
2. Provider economics: same contract-first flow; implement separately from comfort profiles.
3. After both land locally: run full verification again.
4. Delegate one round of end-to-end validation to `testing_agent_v3` (web flows via preview URL).

### Phase 4 — Activation Phases 4–7 (after C-2 + economics)
**User stories (activation)**
1. As a client, I only book providers who meet readiness/verification requirements.
2. As a provider, I understand exactly what is blocking my readiness and how to fix it.
3. As an operator, I can measure funnel steps with clear, privacy-safe reporting.
4. As a provider, my travel zones/availability constraints are respected in discovery.
5. As a system, booking transitions remain strict and authorization remains server-owned.

**Steps**
1. Implement readiness enforcement and discovery gating per existing checkpoint docs.
2. Implement funnel-report API + validation.
3. Test + E2E validation.

## 3) Next Actions (immediate)
1. Create `/app/foot` canonical clone at `3e76114...` and start Phase 1 bootstrap.
2. Install pnpm 9.15.0 + PostgreSQL and get seed + API tests running.
3. Implement the FARM bridge (FastAPI proxy + frontend delegator) until preview URL serves the real app.
4. Write `/app/memory/bootstrap_report.md` with results and blockers.

## 4) Success Criteria
- Preview URL serves the **Foot web UI** (not the template) and `/api/*` hits the **Express API**.
- Local Postgres schema push + seed succeed; demo logins work.
- `pnpm run typecheck` + `pnpm run build` pass; core API test suites pass.
- Contracts for Phase 4C + provider economics exist as new reviewed candidates with checksums.
- Local git workflow produces a focused commit + patch artifact without requiring any GitHub credential in this workspace.
