# OnCall Foot — Bootstrap Report (this container)

Date: 2026-08-10 (continuation session)
Baseline: canonical `main` = `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a`
(tree `bc67dd6e281d3521d679c411fc70cdde6ab24a34`) — verified after clone; working tree clean.
Conflict branches: NOT inspected, NOT merged, NOT based on (16 archival snapshots, left alone per policy).

## Environment

| Item | Value |
|---|---|
| Container | Emergent FARM template (supervisor: uvicorn :8001, `yarn start` :3000 — READONLY conf) |
| Node | v20.20.2 (repo engines `>=20` — satisfied) |
| pnpm | 9.15.0 (repo-pinned packageManager) |
| PostgreSQL | 15 (apt), data dir relocated to persistent `/root/pg_data/15-main` |
| Canonical clone | `/app/foot` (own git; origin = github.com/sbtheg17-market/foot) |
| Secrets | untracked `/app/foot/.env` only (DATABASE_URL local, random JWT_SECRET). Never committed, never printed. |
| GitHub credentials | NONE in this workspace (verified: push impossible). Publication is an external, separately-approved step. |

## Runtime bridge (environment adaptation — zero foot-repo changes)

- `/app/backend/server.py` (FARM entrypoint): FastAPI reverse proxy `:8001 /api/* → :4001`,
  ensures PostgreSQL online + Express API (`artifacts/api-server/dist/index.mjs`) spawned
  (detached; survives reloads). Streams responses (SSE-safe). Auto-runs self-heal when needed.
- `/app/frontend/package.json` `start`: delegates to `pnpm run dev` of `/app/foot/artifacts/web`
  (Vite, `0.0.0.0:3000`, `allowedHosts: true` already in repo config — no repo change needed).
- `/app/scripts/bootstrap_env.sh`: idempotent self-heal after pod restarts (reinstalls
  postgres/pnpm if wiped, restores cluster config from `/root/pg_data/etc_backup`,
  reinstalls node_modules / rebuilds API if missing).
  Tested twice: config wipe + process kill → automatic full recovery → login 200.

## Setup commands executed (documented repo procedure)

1. `pnpm install` — success (peer-dep warning in mobile only, benign)
2. `pnpm --filter @workspace/db run push` — schema applied
3. `pnpm run seed` — 5 demo accounts, profiles, services, availability, travel zones, 4 bookings, 1 review
4. `pnpm --filter @workspace/api-server run build` — success

## Verification results

| Check | Result |
|---|---|
| `pnpm run typecheck` (libs + api + web + mobile) | ✅ PASS |
| `pnpm run build` | ✅ PASS |
| `test` (booking state machine) | ✅ 63/63 |
| `test:integration` (concurrency) | ✅ 16/16 |
| `test:pressure` | ✅ 13/13 |
| `test:provider-application` | ✅ 8/8 |
| `test:provider-status` | ✅ 9/9 |
| `test:provider-notifications` | ✅ 12/12 |
| `test:reviewer-decisions` | ✅ 14/14 |
| `test:provider-readiness` | ✅ 14/14 |
| `test:marketplace-events` | ✅ 12/12 |
| `test:availability` | ✅ 3/3 |
| **Total** | **164/164 API tests, 0 failures** |
| Preview URL serves real web app | ✅ (login page, provider dashboard w/ Phase 4B readiness banner, client discovery at 390px) |
| `/api/*` via preview URL → Express | ✅ (login 200) |

## Database / Gate B status — explicit

- Local PostgreSQL 15 only. **Gate B is NOT passed** — Gate B requires the managed
  environment with runtime-injected `DATABASE_URL`; nothing here claims otherwise.
- No production database access, no production event writing, no migrations against
  any managed environment.

## Missing contracts (lost with the prior workspace; only checksums survive)

1. Phase 4C consent-first comfort-profile contract — to be re-derived as a NEW candidate.
2. Provider economics contract (7 pinned requirements) — to be re-derived separately.
No continuity is claimed with the lost documents.

## Git workflow going forward (simplified, per operator directive)

local branch off canonical main → one focused change → local commit → tests/typecheck/build →
patch artifact + SHA-256 into `/app/memory/patches/` → update `.agents` traceability locally →
hand off exact commit/patch for separately approved publication → independently verify remote.
No pushes from this workspace. No secrets in tracked files, logs, or chat.

## Blockers

- None for local development.
- External (unchanged, operator-owned): managed-DB Gate B verification; publication channel;
  optional conflict-branch cleanup (leave alone for now).
