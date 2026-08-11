# Neo Entry — Conflict Branch Reconnaissance (No Merge)

**Repository:** github.com/sbtheg17-market/foot (OnCall Foot monorepo — pnpm/Express/PostgreSQL)
**Baseline:** `origin/main` @ `401a9d7` (2026-08-11 15:03 UTC — "Add new index asset file")
**Scope:** Read-only reconnaissance. No merges, no pushes, no file changes performed in the target repo.
**Conflict branches found:** 25 (`origin/conflict_*`)

---

## 1. Executive Summary

- **24 of 25** conflict branches are **Comfort-Wiring** (FastAPI/MongoDB, Emergent-template layout: `backend/`, `frontend/`, `.emergent/`, `memory/`). **None share any merge base with OnCall Foot `main`** — they are foreign project histories pushed into this repo's remote. They are **out of scope** and must NOT be merged.
- **1 of 25** — `conflict_070826_mc2` — is a genuine **OnCall Foot** branch (pnpm monorepo layout, merge base `54534b0b` with main). Its **only production-code commit (`5f9992e` — provider application status API) is ALREADY equivalent on main** (verified via `git cherry`). The 4 remaining commits are documentation/patch-file artifacts only.
- **Net result: zero production code is at risk of loss.** Optional salvage is limited to one handoff doc and two `.agents/LOG.md` entries.

---

## 2. Full Branch Inventory & Classification

| # | Branch | Tip | Date (UTC) | Merge base w/ main | Project | Classification signals |
|---|--------|-----|------------|--------------------|---------|------------------------|
| 1 | conflict_310726_1942 | ffe8515 | 2026-07-31 23:43 | **NONE** | Comfort-Wiring | backend/frontend, design_guidelines, auth_testing.md |
| 2 | conflict_310726_2216 | 5e85263 | 2026-08-01 02:17 | **NONE** | Comfort-Wiring | same layout |
| 3 | conflict_010826_0008 | a5638c5 | 2026-08-01 04:09 | **NONE** | Comfort-Wiring | same layout |
| 4 | conflict_010826_0036 | 0c7bd7b | 2026-08-01 04:36 | **NONE** | Comfort-Wiring | same layout |
| 5 | conflict_060826_2025 | 058cf6e | 2026-08-07 00:26 | **NONE** | Comfort-Wiring | backend/frontend + `external/` |
| 6 | **conflict_070826_mc2** | **bed2e06** | **2026-08-08 13:28** | **54534b0b** | **OnCall Foot** | pnpm-workspace.yaml, artifacts/, lib/, Procfile |
| 7 | conflict_080826_1307 | 305fd86 | 2026-08-08 17:08 | **NONE** | Comfort-Wiring | phase1-mc*.patch files at root |
| 8 | conflict_090826_0856 | 7110dc9 | 2026-08-09 12:56 | **NONE** | Comfort-Wiring | phase2-mc9 reviewer-decision patches |
| 9 | conflict_090826_1405 | 60979db | 2026-08-09 18:05 | **NONE** | Comfort-Wiring | marketplace-events / notification-feed patches |
| 10 | conflict_090826_1718 | c3589b1 | 2026-08-09 21:18 | **NONE** | Comfort-Wiring | same as #9 |
| 11 | conflict_090826_1916 | 81014b0 | 2026-08-09 23:16 | **NONE** | Comfort-Wiring | HANDOFF-README, conflict-branch-inventory.md, SHA256SUMS |
| 12 | conflict_090826_2136 | 7f7cfaa | 2026-08-10 01:36 | **NONE** | Comfort-Wiring | backend/frontend + plan.md |
| 13 | conflict_090826_2326 | 73bdad6 | 2026-08-10 03:26 | **NONE** | Comfort-Wiring | standard layout |
| 14 | conflict_100826_0813 | 8cc0028 | 2026-08-10 12:14 | **NONE** | Comfort-Wiring | standard layout |
| 15 | conflict_100826_0906 | 018e69b | 2026-08-10 13:07 | **NONE** | Comfort-Wiring | standard layout |
| 16 | conflict_100826_1234 | f9d0b7e | 2026-08-10 16:34 | **NONE** | Comfort-Wiring | standard layout |
| 17 | conflict_100826_1415 | 27a5ada | 2026-08-10 18:15 | **NONE** | Comfort-Wiring | standard layout + `.agents/` |
| 18 | conflict_100826_1543 | 9e9a3ee | 2026-08-10 19:44 | **NONE** | Comfort-Wiring | contains nested `foot/` dir + backend_test.py |
| 19 | conflict_100826_1738 | 1eefbfd | 2026-08-10 21:39 | **NONE** | Comfort-Wiring | `handoff/` dir |
| 20 | conflict_100826_1941 | 9a752ae | 2026-08-10 23:41 | **NONE** | Comfort-Wiring | `handoff/`, `repo_audit/`, test_cross_check.py |
| 21 | conflict_100826_2113 | b9d2722 | 2026-08-11 01:14 | **NONE** | Comfort-Wiring | `handoff/`, `repo_audit/` |
| 22 | conflict_100826_2258 | 12c8863 | 2026-08-11 02:58 | **NONE** | Comfort-Wiring | `audit/`, `handoff/` |
| 23 | conflict_110826_0846 | 39965b0 | 2026-08-11 12:47 | **NONE** | Comfort-Wiring | **`recovery/COMFORT_WIRING_PLAN.md`** — definitive |
| 24 | conflict_110826_1112 | c687c8f | 2026-08-11 15:12 | **NONE** | Comfort-Wiring | `docs/`, `patches/`, yarn.lock |
| 25 | conflict_110826_1134 | 0fa8ffc | 2026-08-11 15:35 | **NONE** | Comfort-Wiring | `docs/`, `patches/`, yarn.lock |

Stack verification (sample `conflict_110826_1134`): `backend/requirements.txt` = fastapi 0.110.1, uvicorn, pymongo 4.6.3 → FastAPI/MongoDB confirmed. `conflict_110826_0846` carries `recovery/COMFORT_WIRING_PLAN.md`, `GATE_B_RUNBOOK.md`, `RECOVERY_STATE.md` → definitively Comfort-Wiring recovery lineage.

All 24 Comfort-Wiring tips carry the commit subject "Auto-generated changes" — consistent with automated snapshot pushes, not curated work.

---

## 3. OnCall Foot Branch Analysis — `conflict_070826_mc2`

- Merge base with main: `54534b0b`. Branch is **5 commits ahead / 46 commits behind** main.
- Commit-by-commit disposition (`git cherry origin/main` verified):

| Commit | Subject | On main? | Content | Disposition |
|--------|---------|----------|---------|-------------|
| 27654e3 | Add phase 1 patch file for milestone 1 | No | `attached_assets/phase1-mc1_*.patch` (1,598 lines, artifact) | **Skip** — patch artifact, feature already landed |
| 5f9992e | onboarding: expose provider application status via dedicated API | **YES (equivalent)** | providers.ts route, integration test, openapi.yaml, generated clients | **Already integrated** — no action |
| f6df78e | push | No | `.agents/LOG.md` +25 lines, `docs/phase1-mc2-handoff.md` (47 lines) | **Optional salvage** (doc only) |
| bce9735 | handoff: document canonical MC2 transfer branch | No | `.agents/LOG.md` +16 lines | **Optional salvage** (log only) |
| bed2e06 | update to patch | No | `attached_assets/phase1-mc2_*.patch` (1,135 lines, artifact) | **Skip** — patch artifact |

- Main's `artifacts/api-server/src/routes/providers.ts` has since evolved ~790 lines beyond the branch version; main **supersedes** the branch for all production code.

### Safe integration path (ONLY if you want the docs salvaged)

Do **not** merge or cherry-pick onto main history directly. Recommended:

```bash
git switch -c salvage/mc2-handoff-docs origin/main
git checkout origin/conflict_070826_mc2 -- docs/phase1-mc2-handoff.md
# Optionally append the two LOG.md entries manually (do NOT checkout .agents/LOG.md wholesale —
# main's copy has diverged; hand-copy the 2 entries from commits f6df78e and bce9735)
git commit -m "docs: salvage phase1-mc2 handoff notes from conflict_070826_mc2"
# open PR into main — no code paths touched
```

Cherry-picking `f6df78e`/`bce9735` directly is NOT recommended: both touch `.agents/LOG.md`, which has diverged on main (89-line delta) and would conflict; a fresh doc-only patch on top of `origin/main` is cleaner.

### Tests required before integrating anything from this branch
1. `pnpm install` (workspace root)
2. `pnpm -r typecheck` (or `tsc -b` per tsconfig.base.json)
3. `pnpm -r test` — must include `artifacts/api-server/src/__tests__/provider-application*.integration.test.ts` (Postgres-backed integration tests)
4. `pnpm -r lint`
5. OpenAPI codegen drift check: regenerate `lib/api-client-react` / `lib/api-zod` from `lib/api-spec/openapi.yaml` and confirm zero diff
(For the docs-only salvage above, tests 1–2 suffice as a sanity gate; no runtime code changes.)

---

## 4. Comfort-Wiring Branches — Out of Scope (24 branches)

- **Confirmed: no merge base with OnCall Foot main.** `git merge-base` returns empty for all 24 — these are entirely unrelated histories. Any merge attempt would require `--allow-unrelated-histories` and would graft a full FastAPI/MongoDB application (backend/, frontend/, recovery/, patches/) into the pnpm/Postgres monorepo root — an unequivocal project-mixing error.
- **Recommendation:**
  1. Mark all 24 branches out-of-scope for OnCall Foot. Never merge into `main`.
  2. Migrate them to a dedicated repository (e.g. `sbtheg17-market/comfort-wiring`):
     ```bash
     # non-destructive export — run from a clone, does NOT touch OnCall Foot main
     git push <comfort-wiring-remote> origin/conflict_110826_0846:refs/heads/recovery-r3   # (repeat per branch worth keeping)
     ```
  3. The newest branches (`conflict_110826_*`) appear to be the most recent Comfort-Wiring state (recovery/ plans, patches/, docs/); older ones are likely superseded snapshots — triage inside the Comfort-Wiring repo, not here.
  4. After export + verification, the `conflict_*` refs can be deleted from this repo's remote **in a separate, explicitly-approved task** (not this one — no destructive ops performed).

---

## 5. Compliance Statement

- ✅ No merges into main
- ✅ No force-push or history rewrite
- ✅ No file changes in the target repo (read-only clone in /tmp; this report lives outside the repo)
- ✅ No FastAPI/Mongo code mixed into the pnpm/Postgres repo

**Bottom line:** Only `conflict_070826_mc2` belongs to OnCall Foot, and its feature work is already on main. Everything else is Comfort-Wiring and must be relocated, not merged. Main is safe and self-contained as-is.
