# OnCall Foot — Product Requirements & Progress

## Original Problem Statement
Execute the approved phased plan for the OnCall Foot monorepo (Node/Express 5, Postgres/Drizzle, React 19/Vite, Expo) cloned at `/app/external/foot` from `https://github.com/sbtheg17-market/foot.git`. Work proceeds in strict, single-purpose micro-checkpoints (MCs), verified locally with the repo's `pnpm` integration test suites. The container has NO GitHub write access — every completed checkpoint must produce a single focused local commit plus a `.patch` file at `/app/*.patch` (via `git format-patch -1 --stdout HEAD`) with a SHA-256 report, then STOP at "1 ahead / 0 behind" and wait for the user to apply the patch externally. NEVER run `git push`.

## Environment
- Repo: `/app/external/foot` (do NOT relocate). Package manager: `pnpm@9.15.0` via `corepack prepare pnpm@9.15.0 --activate` (Node 20 in container; pnpm 11 is incompatible).
- Local Postgres: db `foot_test_db`, user `foot_test`. Root `.env` has `DATABASE_URL`, `JWT_SECRET`, `PORT=8091`.
- API server for integration tests must run on PORT 8091: `cd artifacts/api-server && set -a; source ../../.env; set +a; node --import tsx/esm ./src/index.ts &` (no hot reload — restart after src changes before re-running tests).
- Run tests with env sourced: `set -a; source .env; set +a; pnpm --filter @workspace/api-server run test:<name>`.
- `test:authorization` needs `pnpm run seed` PLUS manual `provider_applications` rows for seeded providers (seed-script gap, queued hygiene slice).

## Completed (chronological)
- Phase 1 MC1 (`54534b0`): rejected-provider resubmission server transitions — merged upstream.
- Phase 1 MC2 (`1f4c018`): rejection-reason/status API — merged upstream.
- Phase 1 MC3 (`dc7a40d`): web rejected-state UI — merged upstream.
- Phase 1 MC4 (`f2ed537`): mobile Expo rejected-state UI — merged upstream.
- 2026-08-08 — Baseline test-drift cleanup (`27c8a1d`, patch `/app/baseline-test-drift.patch`, SHA-256 `b8c6f14032cb6647026b066408c02410e021f5770d5c30147c7a972956c013f3`):
  - F1: stale submit-validation assertion updated to generic error + `missingRequirements` array contract.
  - F2: happy-path submit test now seeds service + availability + verification doc before `/submit`.
  - F3 (product fix): public `GET /providers/:providerId/services` gated on `verificationStatus === "approved"`; unapproved providers return `{ services: [] }`.
  - Verified: provider-application 8/8, onboarding 23/23; regression sweep provider-status 9/9, provider-resubmission 11/11, authorization 7/7.
  - STATUS: applied externally as `ceb01e3` (published origin/main), local synchronized 0/0.
- 2026-08-08 — Seed-script hygiene (`1e41689`, patch `/app/seed-script-hygiene.patch`, SHA-256 `cfc5b2af8d33550e19fa0b5e9a1a01c3ef12bcd47c64acc80efedec21f50902b`):
  - `seed.ts` now mirrors the registration transaction: `account_roles` membership per demo user + approved `provider_applications` (back-dated submittedAt/reviewedAt, reviewedBy admin) for Sarah & Mike.
  - Fresh-DB validated: drop/recreate + drizzle push + seed → `test:authorization` 7/7 with zero manual inserts; seed rerun fully idempotent (5 users / 5 memberships / 2 profiles / 2 applications); typecheck clean; regression 8/8, 23/23, 9/9, 11/11.
  - STATUS: awaiting user to apply patch externally, then local `git reset --hard origin/main`.

## Backlog (priority order)
- P0: Phase 2 — post-submission progress presentation (submission-history / progress-timeline on status API + web + mobile). First decision: full ordered submission history vs. latest-submission-only in the API.
- P1: Delete stale branch `origin/conflict_070826_mc2` (user action, external).
- P2: Web test infrastructure (vitest + testing-library).
- Phase 3: Admin verification & trust ops. Phase 4: Stripe Connect payments. Phase 5: Provider SaaS tiers. Phase 6: Growth. Phase 7: Disputes/background checks/insurance. Phase 8: Observability & release polish.

## Hard Guardrails
- Never render `reviewerNotes` in any client; only `rejectionReason` + public `previousSubmissions` snapshot fields.
- Clients render actions strictly from server `canEdit`/`canReset`/`canResubmit`.
- `roleIntent` is onboarding intent, never an authorization claim.
- One focused commit per checkpoint; patch handoff; never push.
