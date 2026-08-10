# 4. Environment/setup instructions and baseline test results

## 4.1 Setup instructions (canonical)
The authoritative setup document is `.agents/SETUP.md` at `3e76114` (byte copy: `verification/agents_snapshot/SETUP.md`). Summary:
- Node.js 24+, pnpm (see 4.3 drift note), PostgreSQL via host-managed `DATABASE_URL`, `JWT_SECRET` in the host secret manager only. No secret ever in Git, logs, chat, or this packet.
- `pnpm install` → `pnpm --filter @workspace/db run push` → `pnpm run seed` → run API/web/mobile dev servers per SETUP.md.
- Verification battery: `pnpm run typecheck`, `pnpm run build`, api-server suites, `pnpm run git:check`, `git diff --check`, plus `pnpm run publish:gate` for candidates.

## 4.2 INDEPENDENT baseline verification — performed for this packet (2026-08-10)
Environment: fresh anonymous clone of `main` = `3e76114` at `/root/foot-verify`; Node v24.4.1 (arm64); pnpm 10.18.3 via corepack; PostgreSQL 15 **ephemeral local scratch database** created solely for this verification (random credentials generated in-shell, never printed, never persisted — env file shredded after the run; server process stopped). This follows the Session 054 precedent. The managed database was NOT touched and remains UNVERIFIED (Gate B unchanged).

| Check | Result |
|---|---|
| `pnpm run typecheck` (libs + api-server + web + mobile + scripts) | **PASS** (exit 0) |
| `pnpm run build` (typecheck + all non-sandbox/mobile builds) | **PASS** (exit 0; only chunk-size warnings on web) |
| `db push` onto fresh scratch DB + `pnpm run seed` | **PASS** (idempotent seed completed; demo accounts created) |
| `test` (booking-state-machine) | **63/63 PASS** |
| `test:provider-application` | **8/8 PASS** (matches ledger) |
| `test:provider-status` | **9/9 PASS** (matches ledger) |
| `test:onboarding` | **23/23 PASS** (matches ledger) |
| `test:authorization` | **7/7 PASS on a FRESH seed, zero manual DB inserts** (confirms Session 023 seed hygiene) |
| `test:provider-readiness` | **14/14 PASS** (matches Session 054 record) |
| `test:provider-notifications` | **12/12 PASS** (matches Session 052 record) |
| `test:reviewer-decisions` | **14/14 PASS** (matches MC9 record) |
| `test:provider-resubmission` | **11/11 PASS** (matches ledger) |
| `test:marketplace-events` | **12/12 PASS** |

Conclusion: the canonical baseline `3e76114` independently reproduces a fully green verification battery. Recorded ledger results are corroborated, not merely accepted.

## 4.3 Reproducibility drift found (record; fix as its own future candidate)
1. **Frozen install fails at the canonical tip.** `pnpm install --frozen-lockfile` → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` ("overrides" configuration doesn't match the lockfile) under BOTH the pinned `pnpm@9.15.0` and `pnpm@10.18.3`, Node 24.4.1.
2. **packageManager pin vs config mismatch.** Root `package.json` pins `packageManager: pnpm@9.15.0`, but `pnpm-workspace.yaml` uses `overrides`, `minimumReleaseAge`, and `onlyBuiltDependencies` (pnpm-10-era settings). pnpm 9 does not read `overrides` from workspace yaml.
3. **Lockfile drift.** `pnpm install --no-frozen-lockfile` (pnpm 10.18.3) succeeded in ~23s but rewrote `pnpm-lock.yaml` by **787 insertions / 30 deletions** locally (not committed anywhere; local clone only). One unmet-peer warning: `zod-validation-error@3.5.4` wants `zod@^3.24.4`, found `4.4.3` (mobile workspace).
4. Consequence for honesty: the green results in 4.2 ran against the locally refreshed resolution, not the byte-exact committed lockfile (which cannot be installed frozen under either pnpm major tested). The committed lockfile/CI story needs one dedicated hygiene candidate (see `08_next_actions.md` item 11). This does not affect docs-only publications.

## 4.4 Reproduce this verification
```bash
git clone https://github.com/sbtheg17-market/foot && cd foot   # verify 3e76114 first
corepack prepare pnpm@10 --activate
pnpm install                          # note: --frozen-lockfile currently fails (see 4.3)
# create an EPHEMERAL local PostgreSQL db; export DATABASE_URL + random JWT_SECRET in-shell only
pnpm --filter @workspace/db run push && pnpm run seed
pnpm run typecheck && pnpm run build
PORT=<free-port> node --enable-source-maps artifacts/api-server/dist/index.mjs &   # NOTE: 8080 default may be occupied on some hosts
PORT=<free-port> pnpm --filter @workspace/api-server run test:provider-application  # ... and the other suites
# stop the server; destroy the scratch DB; never write the env values to disk
```
