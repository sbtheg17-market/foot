# Conflict-Branch Inventory v6 — 2026-08-11

**Status:** Accepted read-only inventory. Supersedes the Session 058/063 inventories (18 branches) — **25 `conflict_*` branches** now exist on the remote.
**Baseline:** `origin/main` @ `401a9d7` (verified via authenticated deploy-key channel; anonymous HTTPS cross-check performed at clone time).
**Scope:** Reconnaissance only. No merges, no deletions, no history rewrite, no file changes to application code.

---

## Why this document exists

`.agents/NEXT_TASK.md` and Session 058/063 reference an 18-branch inventory and a 9-branch cleanup authorization. Seven additional `conflict_*` snapshots have appeared since. This inventory re-verifies every branch against the current baseline so that:

1. No future agent merges or bases work on a foreign lineage (permanent policy).
2. Any future cleanup authorization is issued against the complete, current branch list — the prior 9-branch cleanup list is **stale and must be re-authorized** against this inventory before use.

---

## Method

- `git branch -r --list "origin/conflict_*"` — enumeration (25 branches).
- `git merge-base origin/main <branch>` — ancestry test per branch.
- `git ls-tree` root-layout inspection + stack fingerprints (`pnpm-workspace.yaml` vs `backend/requirements.txt` FastAPI/pymongo).
- `git cherry origin/main <branch> <merge-base>` — patch-equivalence for the one related branch.

## Findings summary

- **24 of 25 branches share ZERO history with foot `main`** (`git merge-base` returns empty). They are Emergent-workspace FARM lineages (FastAPI/MongoDB, `backend/` + `frontend/` layout) — the Comfort-Wiring project family. Merging any of them would require `--allow-unrelated-histories` and would graft a foreign application into this monorepo. **Reference only, never merge** (consistent with `docs/neo-handoff-scope.md`).
- **1 of 25 — `conflict_070826_mc2` — is real foot history** (merge base `54534b0b`), and remains **superseded**: its only production commit `5f9992e` ("onboarding: expose provider application status via dedicated API") is patch-equivalent on `main` (`git cherry` = `-`), and `main`'s `providers.ts` has since evolved ~790 lines beyond the branch. The 4 non-equivalent commits contain only patch artifacts (`attached_assets/*.patch`) and handoff notes (`.agents/LOG.md` entries, `docs/phase1-mc2-handoff.md`).
- **No unique unrecovered application code exists on any conflict branch.** Optional docs-only salvage candidate: `docs/phase1-mc2-handoff.md` (47 lines, absent from `main`).

---

## Full inventory (25 branches)

| # | Branch | Tip | Tip date (UTC) | Merge base w/ main | Lineage | Fingerprint |
|---|--------|-----|----------------|--------------------|---------|-------------|
| 1 | conflict_310726_1942 | ffe8515 | 2026-07-31 23:43 | none | Emergent FARM | backend/frontend, design_guidelines, auth_testing.md |
| 2 | conflict_310726_2216 | 5e85263 | 2026-08-01 02:17 | none | Emergent FARM | same layout as #1 |
| 3 | conflict_010826_0008 | a5638c5 | 2026-08-01 04:09 | none | Emergent FARM | same layout as #1 |
| 4 | conflict_010826_0036 | 0c7bd7b | 2026-08-01 04:36 | none | Emergent FARM | same layout as #1 |
| 5 | conflict_060826_2025 | 058cf6e | 2026-08-07 00:26 | none | Emergent FARM | backend/frontend + `external/` |
| 6 | **conflict_070826_mc2** | **bed2e06** | **2026-08-08 13:28** | **54534b0b** | **foot (superseded)** | pnpm-workspace.yaml, artifacts/, lib/ |
| 7 | conflict_080826_1307 | 305fd86 | 2026-08-08 17:08 | none | Emergent FARM | phase1-mc* patch artifacts at root |
| 8 | conflict_090826_0856 | 7110dc9 | 2026-08-09 12:56 | none | Emergent FARM | phase2-mc9 reviewer-decision patch artifacts |
| 9 | conflict_090826_1405 | 60979db | 2026-08-09 18:05 | none | Emergent FARM | marketplace-events / notification-feed patch artifacts |
| 10 | conflict_090826_1718 | c3589b1 | 2026-08-09 21:18 | none | Emergent FARM | same as #9 |
| 11 | conflict_090826_1916 | 81014b0 | 2026-08-09 23:16 | none | Emergent FARM | HANDOFF-README, conflict-branch-inventory.md, SHA256SUMS |
| 12 | conflict_090826_2136 | 7f7cfaa | 2026-08-10 01:36 | none | Emergent FARM | backend/frontend + plan.md |
| 13 | conflict_090826_2326 | 73bdad6 | 2026-08-10 03:26 | none | Emergent FARM | standard FARM layout |
| 14 | conflict_100826_0813 | 8cc0028 | 2026-08-10 12:14 | none | Emergent FARM | standard FARM layout |
| 15 | conflict_100826_0906 | 018e69b | 2026-08-10 13:07 | none | Emergent FARM | standard FARM layout |
| 16 | conflict_100826_1234 | f9d0b7e | 2026-08-10 16:34 | none | Emergent FARM | standard FARM layout |
| 17 | conflict_100826_1415 | 27a5ada | 2026-08-10 18:15 | none | Emergent FARM | standard FARM layout + `.agents/` |
| 18 | conflict_100826_1543 | 9e9a3ee | 2026-08-10 19:44 | none | Emergent FARM | nested `foot/` dir; prior lost-candidate recovery source (Session 063) |
| 19 | conflict_100826_1738 | 1eefbfd | 2026-08-10 21:39 | none | Emergent FARM | `handoff/` dir |
| 20 | conflict_100826_1941 | 9a752ae | 2026-08-10 23:41 | none | Emergent FARM | `handoff/`, `repo_audit/` |
| 21 | conflict_100826_2113 | b9d2722 | 2026-08-11 01:14 | none | Emergent FARM | `handoff/`, `repo_audit/` |
| 22 | conflict_100826_2258 | 12c8863 | 2026-08-11 02:58 | none | Emergent FARM | `audit/`, `handoff/` |
| 23 | conflict_110826_0846 | 39965b0 | 2026-08-11 12:47 | none | Emergent FARM | `recovery/COMFORT_WIRING_PLAN.md` — definitive Comfort-Wiring recovery lineage |
| 24 | conflict_110826_1112 | c687c8f | 2026-08-11 15:12 | none | Emergent FARM | `docs/`, `patches/`, yarn.lock |
| 25 | conflict_110826_1134 | 0fa8ffc | 2026-08-11 15:35 | none | Emergent FARM | `docs/`, `patches/`, yarn.lock |

All 24 foreign tips carry the commit subject "Auto-generated changes" — automated workspace snapshots, not curated work.

## `conflict_070826_mc2` — commit-level disposition

Branch is 5 commits ahead of merge-base `54534b0b` and 46 behind `main`.

| Commit | Subject | Patch-equivalent on main? | Content | Disposition |
|--------|---------|---------------------------|---------|-------------|
| 27654e3 | Add phase 1 patch file for milestone 1 | no | `attached_assets/` patch artifact (1,598 lines) | skip — feature already landed |
| 5f9992e | onboarding: expose provider application status via dedicated API | **yes** (`git cherry` `-`) | providers.ts route, integration test, openapi.yaml, generated clients | already integrated |
| f6df78e | push | no | `.agents/LOG.md` +25, `docs/phase1-mc2-handoff.md` (47 lines) | optional docs-only salvage |
| bce9735 | handoff: document canonical MC2 transfer branch | no | `.agents/LOG.md` +16 | optional docs-only salvage |
| bed2e06 | update to patch | no | `attached_assets/` patch artifact (1,135 lines) | skip |

If salvage is approved, the safe path is a fresh docs-only commit on top of `origin/main` that checks out `docs/phase1-mc2-handoff.md` from the branch — never a cherry-pick of `f6df78e`/`bce9735` (both touch `.agents/LOG.md`, which has diverged and would conflict).

## Comfort-Wiring lineages — handling

Consistent with `docs/neo-handoff-scope.md`: these 24 branches are not recovery sources for this repository and must be handled in a separate repository or workspace. Non-destructive export path (if approved):

```bash
git push <comfort-wiring-remote> origin/conflict_110826_0846:refs/heads/recovery-r3
# repeat per branch worth keeping; newest (conflict_110826_*) carry the latest recovery state
```

Deletion of any `conflict_*` ref remains a **separate, explicitly approved managed-channel operation** and must be re-authorized against this 25-branch inventory (the prior 9-branch list from the 18-branch era omits the 7 newer snapshots).

## Compliance record

- No merges into `main`; no force-push; no history rewrite; no `conflict_*` ref modified or deleted.
- Channel verification: a repo-scoped deploy key was installed by the owner; write access was verified by pushing and immediately deleting a temporary ref (`neo-connector-write-test`) pointing at the existing `main` tip — zero content change, `main` untouched.
- This document and the matching `.agents/LOG.md` Session 067 entry are the only repository changes from this reconnaissance.
