# Session-completion handoff for the next Neo — 2026-09-27 (read-only)

**Written by:** E1 Agent (Emergent), end of the 2026-09-27 sessions.
**Nature:** read-only handoff. Writing this file is the only change made after
the owner's stop instruction. No SQL was run, nothing was pushed, merged,
deployed, purged, or changed on Railway or Supabase.

Owner's standing instruction (verbatim intent): **do not apply the demo-flag
migrations; the three SQL hashes are NOT approved; do not purge or modify any
data.**

---

## 1. Proposed migrations — PROPOSED / NOT APPROVED / NOT APPLIED

| # | Path | SHA-256 (frozen bytes, re-computed 2026-09-27T03:34Z) | Status |
|---|---|---|---|
| 1 | `docs/migrations/USERS_IS_DEMO_V1.sql` | `0c4c6097d982dc24e833426a34ad164f9ed41b74a3d24f0c25b47f3549818f28` | PROPOSED · NOT APPROVED · NOT APPLIED |
| 2 | `docs/migrations/USERS_IS_DEMO_BACKFILL_V1.sql` | `e4e840ce1182c6386ea467825982d173870a2af86883cf75b5ccc06516f714a9` | PROPOSED · NOT APPROVED · NOT APPLIED |
| 3 | `docs/migrations/ADMIN_AUDIT_LOG_V1.sql` | `6d015f1daa858d1a72bf88f459d21e3dc1019185d5d6c62749e000d8161c43a9` | PROPOSED · NOT APPROVED · NOT APPLIED |

Companion record: `docs/migrations/PROPOSED_2026-09-27_DEMO_FLAG_AUDIT_LOG.md`
(design notes, sequencing). `docs/managed-db-release-gate.md` lists them as
proposed. `docs/metrics-definitions.md` was written alongside (docs only).

### What each would change

| Artifact | Statements | Effect on existing rows |
|---|---|---|
| `USERS_IS_DEMO_V1.sql` | `ALTER TABLE users ADD COLUMN is_demo boolean DEFAULT false NOT NULL`; `CREATE INDEX users_is_demo_idx ON users (is_demo) WHERE is_demo = true` | Adds one column to every existing `users` row, value `false` (constant default → catalog-stored on PostgreSQL ≥ 11, no rewrite). **No row is otherwise modified.** Adds one partial index. DDL. |
| `USERS_IS_DEMO_BACKFILL_V1.sql` | single transaction: `UPDATE users SET is_demo = true WHERE email IN (6 fixed seed addresses: admin@, sarah@, mike@, jane@, tom@ oncallfoot.com; qa.provider@oncallfoot.test) AND is_demo = false`; verification `SELECT` | **Modifies up to 6 existing rows** (the seed accounts only; fixed list, never a pattern). Requires #1 first. Idempotent. DML. |
| `ADMIN_AUDIT_LOG_V1.sql` | `CREATE TABLE admin_audit_log (...)` (actor FK → users, action, target_type, target_id (no FK by design), before/after jsonb, created_at, two CHECKs); two indexes | New empty table. **Touches no existing row or table.** DDL. |

None includes a DOWN migration (policy: restore-based rollback). Any `DROP`,
rename or type change is out of scope and a hard stop.

### Intended target (not used)
The managed production PostgreSQL behind the app (Supabase, reached in earlier
sessions via the documented tenant session pooler; `DATABASE_URL` lives only in
the gitignored `/app/.env` in this workspace and in Railway's variables).
No connection string, hostname beyond the documented pooler class, or secret is
recorded here. **No connection was opened for these artifacts.**

### Rehearsed vs. planned
- **Actually done:** PostgreSQL grammar parse of every statement with
  `pglast` (libpg_query) — syntax only; SHA-256 computed.
- **Planned, NOT done:** disposable local PostgreSQL rehearsal (no scratch
  PostgreSQL exists in this workspace), managed apply, ledger entry, Drizzle
  mirror, seed change, switching `DEMO_EMAILS` consumers to the flag,
  `system-status` probes, audit write path.
- The apply-confirmation question asked earlier was **superseded** by the
  owner's Ground Game request and then explicitly **refused**. Treat the three
  artifacts as review material only.

---

## 2. Uncommitted / untracked files (verified `git status --short` at 03:34Z)

| Path | Status | Meaning |
|---|---|---|
| `frontend/yarn.lock` | untracked (`??`) | Preview-only shim artefact created by the Emergent supervisor's `yarn start`; not part of the product; safe to leave untracked or add to `.gitignore` in a future reviewed commit. |
| `docs/neo/2026-09-27-session-completion-handoff.md` (this file) | new, untracked at time of writing | Handoff; the platform auto-commits at session checkpoints. |

Everything else is committed. `git diff --check` was clean at the last check.
Gitignored, workspace-only, must be carried over if the workspace changes:
`/app/.env` (DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV, LOG_LEVEL,
PILOT_*, EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME, PUBLIC_APP_URL — names only) and
`/app/memory/` (`PRD.md`, `test_credentials.md`, `test_credentials.env`).

---

## 3. Git / deploy state — verified facts vs. earlier reports

| Item | Value | How verified |
|---|---|---|
| **Local branch (VERIFIED)** | `conflict_260926_1408` — **not `main`**. Earlier session notes that said "local `main`" were imprecise: this workspace was rebuilt from `origin/conflict_260926_1408` and the branch name was kept. | `git rev-parse --abbrev-ref HEAD` |
| **Local HEAD (VERIFIED)** | `ea93d2169164d4df637c7493349dafbea6216eca` (03:3xZ, "Design delivered…" auto-checkpoint). Ancestry: `92331da` → `7b2bb2c` (Phase 2 tests/pytests) → `a058f64` (scorecard + earnings fix + Railway var script) → `933d165` (Phase 4 proposals, metrics definitions) → `ea93d21` (Ground Game design). | `git log --oneline -6` |
| **Local remotes (VERIFIED)** | none configured (`git remote -v` empty). Save-to-GitHub drops `origin`; re-add read-only with `git remote add origin https://github.com/sbtheg17-market/foot.git` before any merge-base check. | `git remote -v` |
| **GitHub `main` (VERIFIED via public REST at 03:34Z)** | `ee0d1805d611e9517d6aa02909c34d30bc7f6501`, committed 2026-09-27T03:22:09Z, message "Conflict 260926 2310 (#93)". PR #93 came from branch `conflict_260926_2310` = `92331da3f` (verified via `/branches`). Therefore **Phase 2 code (admin dialogs, credential/support feeds, decision e-mail) is on GitHub `main`; the four later local commits are NOT.** | `GET api.github.com/repos/sbtheg17-market/foot/commits/main`, `/branches` |
| **GitHub branches (VERIFIED)** | `conflict_260926_1108` = `b2e4ffb3d`; `conflict_260926_1408` = `a058f646b`; `conflict_260926_2310` = `92331da3f`. Per `AGENTS.md`, `conflict_*` branches are never merge sources. | `/branches` |
| **Railway deployed commit (VERIFIED via project-token GraphQL read at 03:34Z)** | latest deployment `SUCCESS`, created 2026-09-27T02:52:41Z, commit `5177fd451` (= squash of #91), reason `deploy` (triggered by the variable upsert). **No deployment followed the 03:22Z merge in the ≥12 minutes observed.** Unknown whether the GitHub trigger is delayed or disabled — owner to inspect Railway → Service → Settings → Source. No setting was changed. | Railway GraphQL `deployments(first:3)` |
| **Railway live behaviour (VERIFIED)** | `/api/healthz` 200; bundle `index-DsoWasjk.js`; `/api/providers/me/scorecard` unauthenticated → 404 (route absent — consistent with `5177fd4`); `/api/admin/*` unauthenticated → 401 (router-wide gate; not feature evidence). | curl |
| **Railway variables (VERIFIED, names only)** | `DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV, JWT` (stale, unused), `EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME, PUBLIC_APP_URL` (the last three upserted this day with owner-supplied token, values read from `.env`, never printed) + `RAILWAY_*`. | Railway GraphQL `variables` |
| **Railway project token** | Owner-supplied on 2026-09-27; still accepted at 03:34Z. **Owner should revoke it now.** Not stored in the repo. | last successful read |
| **Supabase catalog (EARLIER REPORT, same day)** | via preview `GET /api/admin/system-status`: connected, 10/10 frozen artifacts applied, overall healthy (pytest 14/14). Not re-queried after the stop instruction. Phase 4 artifacts absent by construction (never applied). | `backend/tests/test_admin_phase2_feeds.py` run earlier |
| **Preview (this workspace)** | `https://8f3f5a3f-d59c-4ffd-8b8a-8c0d683fb9e8.preview.emergentagent.com` serving local HEAD through shims `backend/server.py` (8001 → node 8011) and `frontend/package.json` (`yarn start` → node dist on 3000). Toolchain: corepack pnpm@10.18.3, `pnpm install --frozen-lockfile && pnpm run build:deploy`. | this session |

**JWT_SECRET / deployment contradiction — resolved (VERIFIED):** `JWT_SECRET`
is set on Railway, the deploy is `SUCCESS`, `/api/healthz` is 200 and logins
were live-verified in an earlier session. The stale `JWT` variable is harmless
but should be deleted by the owner.

---

## 4. Work completed this day (all committed locally; tests green at each step)

| Commit | Content | Evidence |
|---|---|---|
| `92331da` (also on GitHub via #93) | Phase 2 slices 2–3 implementation: credential decision dialog, support-escalation dialog, `GET /admin/verification/events`, `GET /admin/support/escalations`, `lib/decision-emails.ts`, OpenAPI + codegen | Appendix F of the plan |
| `7b2bb2c` | Component tests (7 + 5), `decision-emails.test.ts`, `backend/tests/test_admin_phase2_feeds.py` (14 read-only); live QA/demo run (credential #5 approved with profile flip unticked; demo tickets #1 → in progress, #2 → resolved) | web 263, api 137 |
| `a058f64` | `GET /providers/me/scorecard` + `lib/provider-scorecard.ts` + `ScorecardCard` on `/provider/dashboard`; `GET /providers/me/earnings` corrected (invoiced vs paid vs pending, real completed count) + `/provider/earnings` relabel; `scripts/railway-set-email-vars.py` (one-off; no secrets inside); `backend/tests/test_provider_scorecard.py` (7) | web 267, api 143; Appendix G |
| `933d165` | Phase 4 **proposals** (three SQL artifacts above), `PROPOSED_…md`, `docs/metrics-definitions.md`, gate doc note | Appendix H |
| `ea93d21` | `docs/neo/2026-09-27-ground-game-design.md` (Phase 0 evidence + Phase 1 design), LOG/PRD entries | — |

Data written to the managed DB this day, all via the application's own admin
UI on QA/demo records only: verification doc #5 (QA Provider) approved (profile
unchanged); support tickets #1 (Jane, demo) → `in_progress` with note, #2 (Tom,
demo) → `resolved` with note. No real account was decided or modified.

---

## 5. Future, separately reviewed phases (nothing authorised)

**Admin/vendor command-center plan** — `docs/neo/2026-09-26-admin-vendor-command-center-plan.md`
(Appendices C–H record Phases 0–3 as delivered and Phase 4 as proposed).
Remaining, each gated by a fresh owner go-ahead:
- Phase 4 apply (the three artifacts above) → then Drizzle mirror → seed
  `is_demo` → switch `DEMO_EMAILS` consumers → `system-status` probes → audit
  write path + `GET /admin/audit-log` + "Recent admin actions" on `/admin`.
- Backlog items: credential-decision e-mails; resolved-ticket notice to
  requesters; scorecard "vs previous 30 days"; bulk decisions.

**Source-to-lead "Daily Ground Game"** — `docs/neo/2026-09-27-ground-game-design.md`.
Design only. Proposes four additive tables (`sources`, `leads`, `lead_messages`,
`lead_events`) in one future artifact `GROUND_GAME_LEADS_V1.sql` (not written),
a 14-file Phase 1, provider `/provider/leads` and admin `/admin/ground-game`
views with server-side scoping, vertical adapter config (foot_care /
tire_sourcing), acceptance-test map, and eight unresolved decisions (§8 of that
document) that the owner must answer before any file is created. Phase 1 is
operator-assisted and channel-neutral: no scraping, no platform-sent messages,
no SMS/voice/AI.

---

## 6. First safe task for the next Neo

1. **Read-only reconciliation (no writes):** follow `AGENTS.md` read order;
   `git remote add origin https://github.com/sbtheg17-market/foot.git` (read
   only), `git fetch origin`, record full SHAs of `origin/main`, local HEAD and
   `git merge-base origin/main HEAD`; confirm whether Railway has since deployed
   `ee0d180` (or later) by comparing the live bundle hash / `GET /api/providers/me/scorecard`
   unauthenticated status (404 = pre-scorecard build, 401 = scorecard build);
   confirm `.env` and `memory/` are present; run `pnpm run typecheck`,
   `pnpm --filter @workspace/api-server run test`, `pnpm --filter @workspace/web run test`,
   and the read-only preview pytests. Produce an evidence table like §3.
2. **Then a small Phase 1 proposal**, not implementation: pick ONE of
   (a) publishing `7b2bb2c..ea93d21` via Save to GitHub → PR → fast-forward
   merge (owner action; agent only verifies), or (b) Ground Game Phase 1 model
   freeze — draft `GROUND_GAME_LEADS_V1.sql` and the OpenAPI paths **as a
   review packet** once the owner has answered the eight §8 decisions. Stop for
   review before coding.

Do not: run SQL against any managed database, apply or re-hash the Phase 4
artifacts, purge demo data (the `/admin/system` purge button is
typed-confirmation and owner-only by decision), push, merge, deploy, or change
Railway settings without a fresh, explicit, named authorisation.
