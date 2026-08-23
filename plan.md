# plan.md — Foot continuation (Roadmap #9 + #10)

## 1) Objectives
- Complete roadmap **#9** (provider reschedule requires client consent + durable rescheduling history) on branch `feat/rescheduling-consent-workflow`.
- Complete roadmap **#10** (web/mobile test architecture + GitHub Actions CI matrix) on branch `test/web-mobile-ci-matrix`.
- Preserve prior docs/history; **no prod deploy**, **no managed DB access**, **no payments/service-area/notification-persistence/email/SMS** changes.
- PR workflow is **manual by operator**: we push branches via SSH + provide PR title/body + compare links. **No GitHub tokens**, no API-created PRs, no local merges, no push to `main`.

---

## 2) Implementation Steps

### Phase 1 — Core workflow POC (isolation) ✅ COMPLETED
**Goal:** prove the hardest part works end-to-end before broad UI/CI changes.

**User stories (POC):**
1. As a provider, I can create a reschedule proposal without changing the confirmed booking time.
2. As a client, I can view a pending proposal with a clear deadline while still seeing the original confirmed time.
3. As a client, I can accept a proposal and the booking time updates atomically with a history record.
4. As a client, I can decline a proposal and the original time remains authoritative.
5. As the system, I reject accepting an expired proposal with a safe conflict.

**Steps (POC):**
1. **Sync + baseline check:** `main` == `origin/main` at **fd3c6b6**; clean tree.
2. **Recover patch safely:** recovered full staged diff from prior session (base `a80b031`) and audited for scope/secrets.
3. **Create fresh branch:** `feat/rescheduling-consent-workflow` from `origin/main`.
4. **Apply patch selectively:** applied recovered patch; explicitly rejected the stray `.env.example` deletion.
5. **POC runtime validation using disposable local PostgreSQL 15:**
   - provisioned local PG15 scratch DB; set `DATABASE_URL`/`JWT_SECRET`
   - ran `pnpm run db:push` and `pnpm run seed` twice (idempotency)
   - built and started server locally on **PORT=18080** (ports 8001/8010 occupied in this pod)
   - ran relevant suites first (policy + proposal flow + rescheduling + authorization + concurrency).
6. **Fix until POC passes:** no POC regressions required.

**Deliverable:** core consent workflow validated locally with exact commands and green results.

---

### Phase 2 — V1 app development (complete #9 on branch) ✅ COMPLETED / PUSHED
**User stories (#9 V1):**
1. As a provider, I can propose a new time with a reason and see that it is “pending client confirmation”.
2. As a client, I can accept/decline from web and mobile with clear loading/error/unauthorized states.
3. As a client, I can request another time only if it does not create competing active proposals.
4. As both parties, I can see a rescheduling history timeline that is append-only and privacy-safe.
5. As the system, repeated submits are idempotent and concurrent accepts/declines resolve safely.

**Steps (#9):**
1. **Audit recovered changes file-by-file** (applied + extended):
   - confirmed no scope violations (payments/service-area/notification persistence)
   - confirmed no secrets/Replit artifacts/accidental deletions
   - confirmed provider direct `confirmed → rescheduled` is blocked (proposal workflow required)
2. **Data model + migration review (additive only):**
   - added `booking_reschedule_proposals` + `booking_reschedule_history`
   - indexes/uniqueness: single pending proposal per booking (partial unique index), requester+idempotency unique index
   - FKs, enums, and rollback/forward-recovery documented (restore-based rollback per managed-db gate)
   - verified seed compatibility + idempotent seeding
3. **API routes (minimum):**
   - implemented create/list proposals; accept/decline; history read
   - **counter route intentionally omitted**: “request another time” reuses existing client direct-reschedule flow and cancels pending proposals atomically
   - ensured authn/authz/ownership and safe non-leaky errors
4. **Notification behavior:** best-effort push after commit; failure does not roll back; coarse outcome recorded
5. **Web/mobile UX:** proposal card + history timeline; deadline display; accept/decline actions; error/empty states; timezone-safe display
6. **Docs/continuity updates (append-only):** updated
   - `docs/rescheduling-policy.md`
   - `docs/rescheduling-history-design.md`
   - `docs/test-coverage-matrix.md`
   - `docs/neo/2026-08-21-client-retention-handoff.md`
7. **Validation (required):**
   - `pnpm run typecheck` ✅
   - `pnpm run build:deploy` ✅
   - `pnpm test` ✅ (now includes policy test; 70/70)
   - `git diff --check` ✅
   - ran all 22 scripted `test:*` suites ✅
   - ran additional unscripted suites; one known non-regression failure explained below
   - secret scan (repo-local heuristics) ✅
8. **Commit + push:**
   - excluded a test artifact directory (`var/`) before commit
   - commit: **99104829e197ec311e41cb022085101177785009**
   - pushed via SSH; verified remote SHA matches local
9. **STOP for manual PR:** branch is ready; operator will open and squash-merge PR.

**Known non-regression note:**
- `prevented-bookings-daily-rebuild.test.ts` contains a Session-080 **changed-file scope** guard that diffs against `main` and fails by design on later feature branches when files outside its historic allowlist change (e.g. `artifacts/api-server/package.json`). This is not a runtime regression in rescheduling; it is a stale policy test for that earlier milestone.

**Current #9 state:** complete and pushed; awaiting manual PR creation + squash-merge.

---

### Phase 3 — CI + test matrix (complete #10 on separate branch) ⏳ NOT STARTED
**User stories (#10):**
1. As a maintainer, I get fast static checks (typecheck/build/diff-check/secret scan) on every PR.
2. As a maintainer, I get repeatable API tests on disposable Postgres with migration+seed idempotency.
3. As a maintainer, I get web tests for the reschedule consent UI states.
4. As a maintainer, I get deterministic mobile checks (**typecheck + Expo static exports iOS + Android**) without claiming native validation.
5. As a release operator, I can see a clear matrix doc mapping commands → CI jobs → limitations.

**Steps (#10):**
1. **Branch point rule (operator-controlled):**
   - Preferred: wait until #9 is squash-merged, then branch from updated `origin/main`.
   - If operator instructs to proceed before merge: branch from then-current `origin/main` and keep #10 isolated.
2. Create branch: `test/web-mobile-ci-matrix` from the selected `origin/main`.
3. Inventory existing scripts/tests before adding frameworks.
4. Add `.github/workflows/ci.yml` (no secrets, no prod access) with jobs:
   - **static**: `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build`, `pnpm run build:deploy`, `git diff --check`, lightweight secret scan (denylist)
   - **api**: Postgres service container, `pnpm run db:push`, `pnpm run seed` twice, start server, `/api/healthz` smoke, run all `pnpm --filter @workspace/api-server run test:*`
   - **web**: smallest maintainable test framework if absent (likely Vitest + RTL + jsdom); include a11y checks and timezone/DST rendering tests
   - **mobile**: `pnpm --filter @workspace/mobile run typecheck` + deterministic Expo static exports for iOS and Android (no Jest/RNTL)
5. Web tests scope (minimum): booking + rescheduling + pending proposal UI + accept/decline + loading/empty/error/unauthorized + a11y + timezone/DST.
6. Mobile CI scope (minimum): typecheck + deterministic iOS/Android exports; document manual native verification checklist (sim/emulator/device, alerts, notification behavior foreground/background/cold-start, permissions, device timezone differences, deep links).
7. Update `docs/test-coverage-matrix.md`:
   - only mark rows as implemented if CI actually runs them
   - record commands, job names, env dependencies, limitations, release-blocking flags
8. Validate each job locally where possible (and/or by running the workflow on push).
9. Commit + push:
   - commit message: `test: establish web mobile and CI coverage`
   - push via SSH; verify remote SHA
10. STOP and report for manual PR: SHAs, files, checks, PR title/body, compare URL.

---

## 3) Next Actions
1. **Operator action (required):** open GitHub PR for `feat/rescheduling-consent-workflow` and squash-merge manually.
2. Once operator confirms merge (or instructs otherwise), create `test/web-mobile-ci-matrix` from the correct `origin/main`.
3. Implement CI + web/mobile checks per Phase 3 and push; stop for operator PR review/merge.

---

## 4) Success Criteria
- **#9:** provider proposals do not overwrite confirmed time; client accept/decline/expiry safe; idempotency + concurrency protections; append-only history written atomically; web+mobile flows implemented; tests green; branch pushed with clean scope; PR prepared for manual squash-merge.
- **#10:** GitHub Actions workflow runs deterministic checks; API tests run on disposable Postgres with migration+seed; web tests exist and run; mobile checks are typecheck + deterministic Expo exports; matrix docs only claim what runs; branch pushed with clean scope; PR prepared for manual squash-merge.
