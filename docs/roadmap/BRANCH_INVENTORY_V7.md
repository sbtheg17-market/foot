# Branch Inventory V7 — 2026-08-11 (Session 068)

**Supersedes:** `docs/conflict-branch-inventory-2026-08-11.md` (v6, 25 branches — stale:
a 26th branch appeared 54 minutes after the v6 commit).
**Baseline:** `origin/main` @ `b20087d13eb77ad3da0b60efc88d4e768f68134d`
(2026-08-11 16:29:48 +0000, “conflict-branch inventory v6…”, author Neo Connector) —
verified by fresh fetch at inventory time.
**Scope:** documentation and reconnaissance only. No merges, no deletions, no history
rewrite, no application changes. **No branch deletion is authorized by this document.**

## Method

- `git fetch origin '+refs/heads/*'` + `git branch -r` → **27 remote refs: `main` + 26
  `conflict_*`**. No `feature/*`, `phase/*`, `patch/*`, or `recovery/*` refs exist on the
  remote at inventory time.
- Per branch: full tip SHA / date / author / subject; `git merge-base origin/main <b>`;
  `git rev-list --count origin/main..<b>`; root commit (`--max-parents=0`); `git ls-tree`
  top level; stack fingerprint (`pnpm-workspace.yaml` vs `backend/requirements.txt`
  FastAPI/Motor); content sampling of READMEs, servers, patches, plans, ledgers.
- `git cherry origin/main conflict_070826_mc2 54534b0b…` re-run for patch-equivalence.

## Re-verification of prior claims (all re-tested this session)

| Prior claim | Verdict |
|---|---|
| 27 remote refs total; main + 26 conflict branches | **CONFIRMED** |
| `conflict_110826_1322` created after Inventory V6 | **CONFIRMED** (tip 17:23:01 vs v6 commit 16:29:48) |
| Inventory V6 stale / not current | **CONFIRMED** — this V7 supersedes it |
| Only `conflict_070826_mc2` shares history with main | **CONFIRMED** (merge base `54534b0b2541d50a7ae1a1b64a18312482ea86dd`; every other branch: NONE) |
| Its useful feature commit already patch-equivalent on main | **CONFIRMED** (`git cherry` marks `5f9992e75f0899ef646294ccc7c41b3bf3bc50af` with `-`) |
| “24 branches are Comfort-Wiring family” (v6 wording) | **CORRECTED** — all 25 no-merge-base branches are FARM-stack Emergent workspace snapshots, but only 4 are Comfort-Wiring proper; 4 are ORIGINAL OnCall Foot FastAPI/Mongo history; 17 are agent work-transfer/audit workspaces (see classes below) |
| Four oldest foreign branches possibly original OnCall Foot FastAPI/Mongo history | **CONFIRMED** (code-level: FastAPI provider portal “foot care” v0 and “Foot-Care Marketplace OS” Phase 2) |

## Root lineages (5 independent histories among the 25 no-merge-base branches)

| Root | Branches | Identity |
|---|---|---|
| `11c2276` (2026-07-25) | 310726_1942, 310726_2216 | **Original OnCall Foot FastAPI/MongoDB Provider Portal v0** — `backend/app/{core,db,models,repositories,routers}`, cookie-JWT auth + lockout, onboarding, services/bookings/earnings/invoices/reviews features, `auth_testing.md` |
| `b720fae` | 010826_0008, 010826_0036 | **OnCall Foot “Foot-Care Marketplace OS” FastAPI Phase 2** — `opportunities.py`, `sms.py`, `storage_client.py`, marketplace pytest suites |
| `d0aeb89` | 060826_2025, 080826_1307 | **Emergent work-transfer workspaces for OnCall Foot patches** — `external/foot` git submodule (gitlink `fa973a8`); root patch artifacts `phase1-mc1..mc4`, `seed-script-hygiene`, `baseline-test-drift` |
| `66e9b96` | 16 branches (090826_0856 → 110826_0846) | **Agent continuation/audit workspaces** — phase-2 patch carriers (mc9, marketplace-events, notification feed), Phase 4B `plan.md`, `handoff/`, `repo_audit/`, `audit/`; ends in the Comfort-Wiring recovery workspace (`recovery/COMFORT_WIRING_PLAN.md`) |
| `efbf7ec` (2026-08-11) | 110826_1112, 110826_1134, 110826_1322 | **Comfort-Wiring implementation workspaces** — FastAPI/Mongo backend, React frontend, `patches/` + INDEX.json, `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md`, CW ledger ENTRY-001..019 |

## Full inventory (26 branches, newest tip first)

Columns: merge base w/ main (NONE = no merge base exists) · U = unique commits vs main ·
Action (vocabulary: KEEP MAIN / SAFE TO REVIEW / PATCH-EQUIVALENT ON MAIN / HISTORICAL
ONLY / SEPARATE COMFORT-WIRING PROJECT / ORIGINAL ONCALL FOOT HISTORY / UNRELATED /
UNKNOWN). All 25 no-merge-base tips carry subject “Auto-generated changes” by
`emergent-agent-e1` (automated workspace snapshots).

| # | Branch | Tip SHA (full) | Tip date (UTC) | Merge base | U | Action |
|---|---|---|---|---|---|---|
| 1 | conflict_110826_1322 | `93cf393e8ea6cb9549591477128a8554d5aaead1` | 2026-08-11 17:23 | NONE | 8 | SEPARATE COMFORT-WIRING PROJECT (canonical/newest CW state) |
| 2 | conflict_110826_1134 | `0fa8ffc10c2ea009d734617108937feed796980e` | 2026-08-11 15:35 | NONE | 18 | SEPARATE COMFORT-WIRING PROJECT |
| 3 | conflict_110826_1112 | `c687c8f8a23211173a549acd9a181ab446eac23e` | 2026-08-11 15:12 | NONE | 15 | SEPARATE COMFORT-WIRING PROJECT |
| 4 | conflict_110826_0846 | `39965b0f5e61a142068417750ca0fbc1d1a02435` | 2026-08-11 12:47 | NONE | 12 | SEPARATE COMFORT-WIRING PROJECT (recovery plan lineage) |
| 5 | conflict_100826_2258 | `12c88633121eb7ad137654eabdd1661b4f5cbf56` | 2026-08-11 02:58 | NONE | 8 | HISTORICAL ONLY (agent audit workspace) |
| 6 | conflict_100826_2113 | `b9d27229a86d1ecf39b9f289251773eb88386e1a` | 2026-08-11 01:14 | NONE | 7 | HISTORICAL ONLY (agent workspace) |
| 7 | conflict_100826_1941 | `9a752aec36c4abd5bf4bfa9760fdb9267392072e` | 2026-08-10 23:41 | NONE | 8 | HISTORICAL ONLY (agent workspace) |
| 8 | conflict_100826_1738 | `1eefbfd37b3008e59b55b887d83634e16484fd76` | 2026-08-10 21:39 | NONE | 6 | HISTORICAL ONLY (agent workspace) |
| 9 | conflict_100826_1543 | `9e9a3ee9ae0c56d67c6e8ffe527f7ea8c9b0321b` | 2026-08-10 19:44 | NONE | 3 | HISTORICAL ONLY (Session-063 recovery source; nested `foot/` dir) |
| 10 | conflict_100826_1415 | `27a5ada26367158b9e79b7321e18fa5b4e5019d6` | 2026-08-10 18:15 | NONE | 8 | HISTORICAL ONLY (agent workspace) |
| 11 | conflict_100826_1234 | `f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00` | 2026-08-10 16:34 | NONE | 21 | HISTORICAL ONLY (agent workspace) |
| 12 | conflict_100826_0906 | `018e69bff9aca281ceed19f8be34a0e567e71422` | 2026-08-10 13:07 | NONE | 8 | HISTORICAL ONLY (agent workspace) |
| 13 | conflict_100826_0813 | `8cc00284ad2dfb654374469e001ba3f39fe322a8` | 2026-08-10 12:14 | NONE | 5 | HISTORICAL ONLY (agent workspace) |
| 14 | conflict_090826_2326 | `73bdad6ba0c354234d89670ce5bce22e0147e075` | 2026-08-10 03:26 | NONE | 9 | HISTORICAL ONLY (agent workspace) |
| 15 | conflict_090826_2136 | `7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33` | 2026-08-10 01:36 | NONE | 5 | HISTORICAL ONLY (Phase-4B local-slice workspace; that work landed on main as `b3937a7`) |
| 16 | conflict_090826_1916 | `81014b03325101c20fe8d2fbc61a8d8f2b6df319` | 2026-08-09 23:16 | NONE | 13 | HISTORICAL ONLY (handoff bundle: HANDOFF-README, SHA256SUMS) |
| 17 | conflict_090826_1718 | `c3589b1941f2f5993477a0b0c6eb9b23823d568d` | 2026-08-09 21:18 | NONE | 14 | HISTORICAL ONLY (OCF patch carrier: marketplace-events / notification-feed) |
| 18 | conflict_090826_1405 | `60979dbfba25095085fe6b04dc32b5ec01896308` | 2026-08-09 18:05 | NONE | 12 | HISTORICAL ONLY (OCF patch carrier, same series) |
| 19 | conflict_090826_0856 | `7110dc939810271908b5409b7cbb3c7b09342463` | 2026-08-09 12:56 | NONE | 10 | HISTORICAL ONLY (OCF patch carrier: `phase2-mc9-commit1..3`) |
| 20 | conflict_080826_1307 | `305fd861353b846a32c6cce5daa9a054631bda1e` | 2026-08-08 17:08 | NONE | 21 | HISTORICAL ONLY (OCF patch carrier: `phase1-mc1..4` + hygiene patches; `external/foot` submodule) |
| 21 | conflict_070826_mc2 | `bed2e069107df40312e806536c6fb462e8f402bc` | 2026-08-08 13:28 (author sbtheg17-market, “update to patch”) | `54534b0b2541d50a7ae1a1b64a18312482ea86dd` | 5 | PATCH-EQUIVALENT ON MAIN (superseded; optional docs-only salvage `docs/phase1-mc2-handoff.md`) |
| 22 | conflict_060826_2025 | `058cf6ecb01cc6bc02c0f9982115be96851b6006` | 2026-08-07 00:26 | NONE | 6 | HISTORICAL ONLY (OCF work-transfer workspace; `external/foot` submodule) |
| 23 | conflict_010826_0036 | `0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2` | 2026-08-01 04:36 | NONE | 11 | ORIGINAL ONCALL FOOT HISTORY (FastAPI “Marketplace OS” Phase 2) |
| 24 | conflict_010826_0008 | `a5638c55c4e182db98413eed4e1319b573776fd6` | 2026-08-01 04:09 | NONE | 9 | ORIGINAL ONCALL FOOT HISTORY (FastAPI Phase 2) |
| 25 | conflict_310726_2216 | `5e852632731b3d14a21544bd087cfbb90e4e644d` | 2026-08-01 02:17 | NONE | 14 | ORIGINAL ONCALL FOOT HISTORY (FastAPI Provider Portal v0) |
| 26 | conflict_310726_1942 | `ffe8515962a6f617b183dab3adb1059905109ee2` | 2026-07-31 23:43 | NONE | 12 | ORIGINAL ONCALL FOOT HISTORY (FastAPI Provider Portal v0) |
| — | main | `b20087d13eb77ad3da0b60efc88d4e768f68134d` | 2026-08-11 16:29 | — | — | KEEP MAIN (only canonical source of truth) |

## Per-branch detail (tree · stack · identity · portal relevance · uniqueness · on-main?)

**#1 conflict_110826_1322** — top level: `.agents/ backend/ frontend/ docs/ patches/ memory/ tests/ test_reports/ backend_test.py yarn.lock`; stack FastAPI+Motor/Mongo + React (yarn); identity: Comfort-Wiring cycle-2 workspace. Portal relevance: reference for future client comfort/consent (Phase 4C port). **Unique content not on main:** `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` (the artifact Sessions 065/066 recorded as absent), 11 patches + signed `patches/INDEX.json` (5 pending operator review: AUTH_provider-signin, AUTH_bypass-removal, C4, C5, C6), CW ledger ENTRY-001..019 (27/27 tests), prior Neo marketplace report (`memory/`). Already on main: NO (and must never be merged). Action: SEPARATE COMFORT-WIRING PROJECT — export/preserve; port stack-natively under approval.

**#2 conflict_110826_1134 / #3 conflict_110826_1112** — same layout minus the newest work (1134 = cycle-2 start with provider auth; 1112 = cycle 1). Strict ancestors-in-content of #1; everything of value is superseded by #1. Action: SEPARATE COMFORT-WIRING PROJECT (export with #1; #1 is canonical).

**#4 conflict_110826_0846** — `recovery/` bundle: `COMFORT_WIRING_PLAN.md` v1.1 + review, `GATE_B_RUNBOOK.md`, decision protocol, acceptance records, phase4c_r3 candidate manifests + checksums; minimal FastAPI template backend. Identity: definitive Comfort-Wiring recovery/planning workspace. Unique: recovery/acceptance records not present elsewhere. On main: NO. Action: SEPARATE COMFORT-WIRING PROJECT (export).

**#5–#16 (66e9b96 lineage, non-CW)** — standard Emergent FARM template (`backend/ frontend/ memory/ tests/`) plus variously: `audit/`, `handoff/`, `repo_audit/`, `plan.md` (Phase 4B, #15), HANDOFF-README + SHA256SUMS (#16), nested `foot/` (#9). Identity: agent continuation/audit workspaces operating ON OnCall Foot remotely. Portal relevance: none directly; forensic provenance of published main work. Unique functionality: none proven — patch artifacts correspond to work already published on main (Phase 4B slice → `b3937a7`; audits → Session ledger). On main: the underlying OCF work IS on main; the workspace wrappers are not needed. Action: HISTORICAL ONLY.

**#17–#19 (phase-2 patch carriers)** — FARM template + root `.patch` artifacts (`phase2-mc9-commit1..3`, marketplace-events, notification-feed). The corresponding OCF features are published on main (MC9 14/14; events Phases 1–3; MC10 feed). Action: HISTORICAL ONLY.

**#20 / #22 (d0aeb89 lineage)** — FARM template + `external/foot` **git submodule** (gitlink `fa973a85e81af856d870026f15e13602d04bf07b`) + root patch artifacts `phase1-mc1..mc4`, `seed-script-hygiene`, `baseline-test-drift` (#20). The MC1–MC4 application lifecycle is published on main (8/8, 11/11, 9/9, 23/23 suites). Action: HISTORICAL ONLY.

**#21 conflict_070826_mc2** — the ONLY real foot lineage (pnpm/artifacts/lib layout; 114 total commits; merge base `54534b0b…`; 46 behind main). `git cherry` (re-run this session): `5f9992e` (provider application status API) = **patch-equivalent on main**; `27654e3`, `f6df78e`, `bce9735`, `bed2e06` = patch artifacts (`attached_assets/*.patch`) + handoff notes only. Unique salvageable: `docs/phase1-mc2-handoff.md` (47 lines, docs-only — recover via fresh commit, never cherry-pick). Action: PATCH-EQUIVALENT ON MAIN.

**#23–#26 (FastAPI-era OnCall Foot)** — #25/#26: `backend/app/` modular FastAPI (core/db/models/repositories/routers), Mongo via Motor, cookie-JWT + brute-force lockout, provider onboarding/services/bookings/earnings/invoices/reviews React features, `auth_testing.md`, design_guidelines. #23/#24: `server.py` “Foot-Care Marketplace OS” + `opportunities.py`, `sms.py`, `storage_client.py`, marketplace/phase-2 pytest suites. Identity: the pre-rebuild OnCall Foot implementation the PRD stack-note describes. Portal relevance: provider portal v0 concepts — all re-implemented (better) on main’s TS stack. Unique functionality on main: none required; concepts superseded. Action: ORIGINAL ONCALL FOOT HISTORY (preserve as reference; never merge — different stack, no shared history).

## Standing conclusions

1. **Nothing on any conflict branch is mergeable into `main`.** 25 branches: no merge
   base. 1 branch: superseded, cherry-verified.
2. **No unique unrecovered OnCall Foot application code exists on any conflict branch.**
   The only unique artifacts are documentation/reference: the CW project state (#1–#4,
   canonical #1) and `docs/phase1-mc2-handoff.md` (#21).
3. **Cleanup remains unauthorized.** Any future cleanup must be re-authorized against
   THIS 26-branch inventory, and Comfort-Wiring branches must be exported to their own
   repository/archive first (newest-richest order: #1, #2, #3, #4).
4. Comfort-Wiring functionality reaches OnCall Foot ONLY via a stack-native port
   (see `docs/roadmap/NEO_EAGLE_VIEW.md` §4, §7 Priority 3).
