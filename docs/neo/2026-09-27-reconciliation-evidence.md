# Read-only reconciliation + Phase 1 proposal packet — 2026-09-27 (04:13Z)

**Written by:** E2 Agent (Emergent), first session in a rebuilt workspace.
**Nature:** the "first safe task" prescribed by
`docs/neo/2026-09-27-session-completion-handoff.md` §6. Read-only towards every
remote system: **no push, no merge, no deploy, no Railway/Supabase change, no
SQL against any managed database, no Phase 4 artifact executed anywhere (not
even on scratch).** The only writes are (a) this file, (b) an appended
`.agents/LOG.md` entry, (c) gitignored workspace files (`/app/.env`,
`/app/memory/*`) and (d) a disposable local PostgreSQL used solely to boot the
preview.

Owner's standing instruction still governs: **the three Phase 4 SQL hashes are
NOT approved; do not apply; do not purge or modify any data.**

---

## 1. Discrepancies between the handoff and this workspace (resolved)

| Handoff said | Found here | Resolution |
|---|---|---|
| Local branch `conflict_260926_1408`, HEAD `ea93d21` | Workspace was on stale `chore/add-graphify-continuity-workflow` @ `1ff28e9` (2026-08-27; 37 behind / 2 ahead of `origin/main`) | Restored `conflict_260926_1408` from `origin` (tip `f488d90`, see §2). No commit was moved, rebased or rewritten. |
| "No git remote configured" | `origin` present (`sbtheg17-market/foot`), **URL carries an embedded GitHub token** | Left untouched (the platform's Save-to-GitHub depends on it). **Flagged for rotation** — §6. Token never echoed after discovery. |
| Four local commits `7b2bb2c…ea93d21` "NOT on GitHub" | They **are** on GitHub, on `origin/conflict_260926_1408`, together with the handoff commit `f488d90` (03:36Z, platform checkpoint) | Handoff statement superseded; publication to `main` still pending (owner's PR click) — §7. |
| `/app/.env`, `/app/memory/` must be carried over | **Neither exists** here; managed `DATABASE_URL`, `JWT_SECRET`, `EMERGENT_EMAIL_KEY` etc. are NOT in this workspace | Recreated both with **local-scratch-only** values (§4). Managed credentials remain solely in Railway. |
| Preview served local HEAD via shims | Both supervisor programs `FATAL` (no `pnpm`, no dist, no `.env`) | Toolchain rebuilt; preview up on a disposable local PostgreSQL 15 (§4). |

---

## 2. Git state (verified, full SHAs)

| Ref | SHA | Date (UTC) | Note |
|---|---|---|---|
| `origin/main` | `ee0d1805d611e9517d6aa02909c34d30bc7f6501` | 2026-09-27 03:22:09 | "Conflict 260926 2310 (#93)" — squash of `conflict_260926_2310` (= `92331da`, Phase 2 code) |
| `origin/main~1` | `837e029ec3bf521244bdad204594d3040655487b` | 2026-09-27 02:55:05 | "Conflict 260926 1408 (#92)" — earlier squash of this same branch |
| `origin/main~2` | `5177fd4512c8b7d416ece539a1792ec43d722494` | 2026-09-27 01:46:57 | "Conflict 260926 1408 (#91)" — **the commit Railway is still serving** |
| `origin/conflict_260926_1408` = local `HEAD` | `f488d906467fd93b207af426d6a17ad9de0637bf` | 2026-09-27 03:36:15 | handoff commit; parent `ea93d2169164d4df637c7493349dafbea6216eca` |
| `git merge-base origin/main HEAD` | `5177fd4512c8b7d416ece539a1792ec43d722494` | — | merge base **exists** → per `AGENTS.md` step 7 this branch is a linear continuation, not a historical snapshot |
| `git rev-list --left-right --count origin/main...HEAD` | `2  28` | — | main has only the two squash merges #92/#93; HEAD has 28 unsquashed commits |
| **Content diff** `git diff --stat origin/main HEAD` | 40 files, +2522 / −37 | — | equals exactly the four handoff commits: scorecard (`lib/provider-scorecard.ts`, `routes/providers.ts`, `scorecard-card.tsx`, earnings relabel, OpenAPI + generated clients), tests (2 api, 4 web, 2 pytest), Phase 4 **proposal docs/SQL**, `metrics-definitions.md`, plan Appendix G/H, Ground Game design, handoff, `scripts/railway-set-email-vars.py`. **No schema (`lib/db`) change, no migration applied.** |
| `git diff --check` | clean | — | |

`AGENTS.md` is byte-identical between `HEAD` and `origin/main`.

**Rule vs. practice note.** `AGENTS.md` says "never merge, cherry-pick from, or
base work on any `conflict_*` branch"; that rule was written for the 26
no-merge-base historical branches in `BRANCH_INVENTORY_V7.md`. Since 2026-09-26
the platform's Save-to-GitHub publishes every checkpoint to a
`conflict_YYMMDD_HHMM` branch, and PRs #91–#93 on `main` were all created from
such branches. The rule text and the actual publication path now disagree; a
one-paragraph clarification is proposed in §7 (docs-only, not written).

---

## 3. Phase 4 artifacts — hashes re-verified (files read only, never executed)

| Path | `sha256sum` 2026-09-27 04:0xZ | Matches handoff | Status |
|---|---|---|---|
| `docs/migrations/USERS_IS_DEMO_V1.sql` | `0c4c6097d982dc24e833426a34ad164f9ed41b74a3d24f0c25b47f3549818f28` | yes | PROPOSED · NOT APPROVED · NOT APPLIED |
| `docs/migrations/USERS_IS_DEMO_BACKFILL_V1.sql` | `e4e840ce1182c6386ea467825982d173870a2af86883cf75b5ccc06516f714a9` | yes | PROPOSED · NOT APPROVED · NOT APPLIED |
| `docs/migrations/ADMIN_AUDIT_LOG_V1.sql` | `6d015f1daa858d1a72bf88f459d21e3dc1019185d5d6c62749e000d8161c43a9` | yes | PROPOSED · NOT APPROVED · NOT APPLIED |

Scratch-DB rehearsal remains **not done** (deliberately — the handoff's
"do not apply" was read strictly). `users.is_demo` is absent from the scratch
schema, confirming the Drizzle mirror carries no Phase 4 change.

---

## 4. Workspace / preview state

| Item | Value |
|---|---|
| Toolchain | Node `v20.20.2` (repo canon is 24; `engines` allows ≥20), corepack `pnpm@10.18.3`, `pnpm install --frozen-lockfile` OK |
| Database behind the preview | **Disposable local PostgreSQL 15** (`127.0.0.1:5433`, db `oncallfoot_scratch`, data dir `/root/pg-scratch`). Schema via `pnpm run db:push` (Drizzle mirror → 28 tables); data via `pnpm run seed` (5 demo accounts, 2 providers, 4 bookings). **Not** the managed Supabase database; no managed credential exists in this workspace. Same practice as the 2026-08-29 pilot validation. |
| `/app/.env` (gitignored) | recreated: local `DATABASE_URL`, fresh random `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `LOG_LEVEL`, `PILOT_*`, `PUBLIC_APP_URL` (preview origin). **No** `EMERGENT_EMAIL_KEY` → decision e-mails are inert on the preview (by design). |
| `/app/memory/` (gitignored) | recreated: `PRD.md`, `test_credentials.md`, `test_credentials.env` (`TEST_BASE_URL`, seed demo password only; QA/Orbite passwords unknown → those pytests skip). |
| Build | `pnpm run build:deploy` PASS |
| Preview | `https://phase-4-preview.preview.emergentagent.com` — shims `backend/server.py` (uvicorn 8001 → node 8011) and `frontend/package.json` (`yarn start` → node dist on 3000) both `RUNNING`; `/api/healthz` 200; `/api/providers/me/scorecard` unauthenticated → **401** (scorecard build present); admin `system-status`: `overall healthy`, `connected: true`, **10/10 frozen artifacts applied** on scratch; login + `/provider/dashboard` (incl. "Your performance" scorecard card) rendered in Chromium. |
| Untracked | `backend/__pycache__/`, `backend/tests/__pycache__/` (pytest by-products; removed after the run). `frontend/yarn.lock` not regenerated this time (corepack yarn). |

---

## 5. Test evidence (this workspace, 04:04–04:12Z)

| Suite | Command | Result |
|---|---|---|
| Typecheck | `pnpm run typecheck` | **PASS** (libs, api-server, web, mobile, scripts) |
| API unit | `pnpm --filter @workspace/api-server run test` | **143 / 143 pass**, 0 fail |
| Web | `pnpm --filter @workspace/web run test` | **267 / 267 pass** (24 files) |
| Read-only preview pytests | `cd backend/tests && python3 -m pytest -q -rs` against the preview | **36 passed, 25 skipped, 1 failed** |

Pytest detail:
- 25 skips are by design: `TEST_QA_PASSWORD` / `TEST_ORBITE_PASSWORD` are not in
  this workspace (they belong to accounts that exist only on the managed DB).
- The single failure, `backend_test.py::test_providers_list`, asserts
  `total >= 8` — a **managed-data assumption** (production has ≥ 8 public
  providers); the scratch seed has 2. Not a code defect; the test was **not**
  edited. It will pass again against a managed-DB preview.

---

## 6. Railway (public probes only — no token used)

| Probe | Result (04:0xZ) | Meaning |
|---|---|---|
| `GET /api/healthz` | 200 | service up |
| web bundle | `index-DsoWasjk.js` | **identical to the 03:34Z observation** → no redeploy has happened |
| `GET /api/providers/me/scorecard` unauth | 404 | route absent → pre-`a058f64` build (note: the scorecard is not on `main` either, so this probe cannot distinguish `5177fd4` from `ee0d180`; the bundle hash can, and it is unchanged) |
| `GET /api/admin/verification/events` unauth | 401 | router-wide gate, not feature evidence |

**Conclusion:** Railway is still serving the `5177fd4` build. The 03:22Z merge
of #93 has **not** deployed ≥ 50 minutes later → the GitHub source trigger is
very likely disconnected/paused. **Owner action:** Railway → service `foot` →
Settings → Source; also revoke the 2026-09-27 project token and delete the stale
`JWT` variable (both still outstanding from the handoff).

**Secrets hygiene flag (new):** this workspace's `origin` remote URL embeds a
GitHub user token. It is not in any tracked file (`.gitconfig`/repo are clean),
but it is platform-managed and should be **rotated** at the owner's convenience.

---

## 7. Phase 1 proposal packet — PUBLISH `conflict_260926_1408` → `main` (review-only)

Chosen per handoff §6 option **(a)**; option (b) (Ground Game model freeze)
still needs the owner's answers to the eight §8 decisions in
`docs/neo/2026-09-27-ground-game-design.md`.

**What:** one PR, `conflict_260926_1408` → `main`, squash-merged exactly like
#91–#93 (the established publication path). After it lands, Railway (once its
trigger is fixed) deploys the provider scorecard, the corrected earnings view
and the Phase 2 test/pytest suites.

**Scope (verified):** the 40-file content diff in §2 plus this reconciliation
(docs) once checkpointed. Contains **no** schema change, **no** migration to
apply, **no** dependency change other than one `package.json` test list line.

**Pre-merge checklist (agent has verified 1–5; owner does 6–8):**
1. `git diff --stat origin/main origin/conflict_260926_1408` shows only the
   files listed in §2 — ✔
2. typecheck / api 143 / web 267 green on the branch tip — ✔
3. `git diff --check` clean — ✔
4. Phase 4 SQL present as **docs only**; nothing in `lib/db` references
   `is_demo` or `admin_audit_log` — ✔
5. Handoff + this evidence file present on the branch — ✔ (this file after the
   next checkpoint)
6. Owner opens the PR from GitHub UI (Save to GitHub → PR) and merges.
7. Owner re-enables/inspects the Railway source trigger; expected result after
   deploy: bundle hash ≠ `index-DsoWasjk.js`, `GET /api/providers/me/scorecard`
   unauth → 401.
8. Owner revokes the Railway project token, deletes stale `JWT`, rotates the
   GitHub token embedded in this workspace's remote.

**Optional docs-only follow-up (not written, needs a yes):** a short
`AGENTS.md` paragraph distinguishing (i) the 26 historical no-merge-base
`conflict_*` branches (never merge) from (ii) platform checkpoint branches
`conflict_YYMMDD_HHMM` **with** a merge base on `origin/main` (publication
candidates via PR). One reviewed commit; no other file.

**Stop point:** nothing further will be coded or applied until the owner
answers: (A) publish now via PR? (B) write the AGENTS.md clarification?
(C) which of Phase 4 scratch rehearsal / Ground Game §8 decisions comes next?

---

## 8. Do-not list (unchanged, carried forward)

No SQL against any managed database · do not apply or re-hash the Phase 4
artifacts · no purge · no push/merge/deploy/Railway change without a fresh,
explicit, named authorisation · never render `reviewerNotes` to clients ·
never base OnCall Foot work on a no-merge-base `conflict_*` branch.
