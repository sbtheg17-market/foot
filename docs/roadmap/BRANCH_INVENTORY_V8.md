# Branch Inventory V8 — 2026-08-12 (Session 081)

**Supersedes:** `docs/roadmap/BRANCH_INVENTORY_V7.md` (26 conflict branches, 27 refs) as the
current inventory of record. V7 remains the authoritative deep-dive reference for the 26
legacy conflict branches it classified (root lineages, per-branch trees, cherry evidence);
V8 incorporates those classifications by reference, unchanged.
**Baseline:** `origin/main` @ `21b282b4db59c504ddd7c8347cdd9677f2c91391`
(2026-08-12, merge of PR #9 “Analytics Design V1”) — verified by fresh SSH clone and
`git ls-remote` at inventory time.
**Scope:** documentation and reconnaissance only. Read-only throughout. No merges, no
deletions, no archival, no history rewrite, no branch modification of any kind.
**No branch deletion, archival, or cleanup is authorized by this document.**

## Method

- Fresh SSH clone of `sbtheg17-market/foot`; `git ls-remote --heads` → **44 refs at
  investigation time**: `main` + 12 work branches + 31 `conflict_*` snapshots. During the
  same session, the operator-approved ledger branch `docs/session-081-loss-investigation`
  was pushed, bringing the remote to **45 refs**; it is included below for completeness.
- Per branch: full tip SHA / tip date (UTC); `git merge-base --is-ancestor <b> origin/main`
  (MERGED vs unmerged); `git merge-base` existence; `git rev-list --count origin/main..<b>`
  (U = unique commits); `git cherry origin/main <b>` for squash-merge-era work branches;
  root commit (`--max-parents=0`); `git ls-tree` top level; gitlink (mode `160000`)
  detection across the full tree of each new snapshot.
- Loss-evidence search (Session 081): `git ls-tree -r` of **every** head for the four
  uniquely-named approved Analytics Step 2 Part 1 files
  (`prevented-booking-records.ts`, `prevented-booking-events.ts`,
  `marketplace-defaults.ts`, `prevented-booking-events.integration.test.ts`) —
  **zero matches on all branches**.

## Summary (45 refs)

| Class | Count | Disposition |
|---|---|---|
| `main` | 1 | KEEP MAIN — only canonical source of truth |
| Merged work branches (strict ancestors of `main`) | 8 | MERGED — future-archival candidates; **no action authorized** |
| Unmerged work branches (squash-merge era) | 4 | CONTENT VERIFICATION REQUIRED before any disposition |
| Session 081 ledger branch (this session, PR pending) | 1 | ACTIVE — open PR, do not touch |
| `conflict_*` snapshots | 31 | HISTORICAL ONLY; 3 explicit HOLDS below; **no cleanup authorized** |

## A. Merged work branches (8) — strict ancestors of `main`

Every commit on these branches is reachable from `main` (true merge commits preserved).
They are candidates for a FUTURE, separately authorized archival task — nothing more.

| # | Branch | Tip SHA (full) | Tip date (UTC) | Landed as |
|---|---|---|---|---|
| 1 | session-072-073-replay-current-main | `6834af77fab0855bb8180ddf3455cd4bbb0e614c` | 2026-08-12 02:01 | pre-PR replay of current main |
| 2 | publish/session-074-index-mirror | `173f0a9fed64abb450d0b7cd8ba7b8a3f24c9f09` | 2026-08-12 05:38 | PR #3 (`11117bf…` reviewed mirror commit `f12bd05…`) |
| 3 | publish/session-077-race-409 | `97016996bd087d0e57b0b661210bb5d115b6223e` | 2026-08-12 06:31 | PR #4 (API commit `3ab6cb7…`, merge `f655427…`) |
| 4 | docs/session-078-ledger-cleanup | `7bf04aaec2258ee025765db0bad9ac1765d192f2` | 2026-08-12 08:23 | PR #5 (merge `d3499e2…`) |
| 5 | feat/session-079-race-notice-ui | `91d448046a3c16a915cf6acd96e4786affc5a0da` | 2026-08-12 14:53 | PR #6 (merge `805cc68…`) |
| 6 | docs/session-079-ledger | `21056a00af52d0f75e231f6bdc716a706876324a` | 2026-08-12 15:32 | PR #7 (merge `cf5ec3e…`) |
| 7 | docs/extensibility-blueprint-v1 | `1a13092c6f01008c87651d97bfe99aa1a6772055` | 2026-08-12 15:32 | PR #8 (merge `f904389…`) |
| 8 | docs/analytics-prevented-bookings-v1 | `7a1cbfab46f3f49fbec399f7f1dd50c8072d91d5` | 2026-08-12 16:02 | PR #9 (merge `21b282b…` = current main) |

## B. Unmerged work branches (4) — squash-merge era, CONTENT VERIFICATION REQUIRED

These predate the true-merge-commit policy. `git merge-base --is-ancestor` reports them
unmerged because Sessions 068–070 landed on `main` via **squash merges** (e.g. PR #1 →
`36b5880…`), which `git cherry` cannot recognize as patch-equivalent when the squash
combined multiple commits. Their content is BELIEVED to be on `main`, but blob-level
verification is required before any disposition. **Do not delete or archive without that
verification and fresh named authorization.**

| # | Branch | Tip SHA (full) | Tip date (UTC) | U | `git cherry` | Note |
|---|---|---|---|---|---|---|
| 1 | docs/eagle-view-inventory-v7 | `69447b09915713f7d13b9539a18cba8690c25512` | 2026-08-11 18:25 | 4 | 1−/3+ | PR #1 source branch (Session 068 docs); “+” = squashed docs commit `0717cb5`, merge-state, `.replit` update |
| 2 | docs/session-069-publication-record | `e2dfb7439b21319d8c0d87a01655e20f0183a91d` | 2026-08-11 18:47 | 1 | 0−/1+ | Session 069 publication-verification docs commit |
| 3 | publish/session-069-070 | `76af462a5766dd11386af40ff23b99acb6725434` | 2026-08-11 20:40 | 5 | 1−/4+ | Session 069 docs + Session 070 forensic report + booking-lifecycle slice `8b988ac` + “update” tip |
| 4 | publish/session-069-070-clean | `9f802c9aab76acf90a60b54824a6739c99670653` | 2026-08-11 20:42 | 5 | 1−/4+ | Near-twin of #3 (same three work commits, different “update” tip) |

## C. Active branch (1)

| Branch | Tip SHA (full) | Status |
|---|---|---|
| docs/session-081-loss-investigation | `fc6a41c61727c97fd6429a79a7310f21d0ef7668` | Pushed this session on operator approval (base = current `main`; 2 ledger files, +45/−0). PR pending operator review/merge. Excluded from all archival discussion. |

## D. `conflict_*` snapshots (31) — HISTORICAL ONLY

### D.1 The 26 V7-inventoried branches — classifications unchanged, incorporated by reference

See `BRANCH_INVENTORY_V7.md` for the full per-branch detail. Standing V7 classes:

- **SEPARATE COMFORT-WIRING PROJECT (4):** `conflict_110826_1322` (canonical CW state),
  `conflict_110826_1134`, `conflict_110826_1112`, `conflict_110826_0846`.
- **HISTORICAL ONLY (17):** agent continuation / audit / patch-carrier workspaces
  (`conflict_090826_*`, `conflict_100826_*`, `conflict_080826_1307`,
  `conflict_060826_2025`).
- **PATCH-EQUIVALENT ON MAIN (1):** `conflict_070826_mc2` (optional docs-only salvage
  `docs/phase1-mc2-handoff.md` remains unactioned).
- **ORIGINAL ONCALL FOOT HISTORY (4):** `conflict_010826_*`, `conflict_310726_*`
  (pre-rebuild FastAPI/Mongo implementations; preserve as reference; never merge).

### D.2 New since V7 (5) — all root `efbf7ec` (the same long-lived Emergent job lineage),
all merge-base NONE, all tips “Auto-generated changes”

| # | Branch | Tip SHA (full) | Tip date (UTC) | U | Identity |
|---|---|---|---|---|---|
| 27 | conflict_110826_1528 | `f3406b3d4f6e80358b8c07d9957396a495f15f82` | 2026-08-11 19:28 | 6 | Session 069/070-era recon workspace: `recon/foot` **gitlink → `36b5880…`** (post-PR-#1 main), `recon/SESSION_068_eagle-view-inventory-v7.patch`, prior-Neo report |
| 28 | conflict_110826_1858 | `242500be3cdd046065257a618a5392891e906c13` | 2026-08-11 22:59 | 10 | Gate B verification workspace: `work/repo` **gitlink → `6516db0…`**, `work/gateb_*` scripts, pinned table/enum catalog dumps, `drizzle-plan`, `s069.patch` |
| 29 | conflict_110826_1957 | `c462d9e089ff52c0bda3fa7f55ec3b7adeaf7566` | 2026-08-11 23:57 | 14 | Same Gate B workspace, later snapshot (same `work/` layout and gitlink) |
| 30 | conflict_120826_0317 | `d76a9ab756e45730c6df97a302085be3417dd451` | 2026-08-12 07:18 | 10 | Session 074 bundle-recovery workspace (`SESSION_074_index_mirror.bundle`); already documented in the V7 addendum (Session 078): no unpublished OnCall Foot working-tree content |
| 31 | conflict_120826_1319 | `94e619865e963e5f601bc04261a870e4cb62d296` | 2026-08-12 17:19 | 13 | **The original Sessions 076–080 workspace snapshot chain** (takeover → Race Notice UI → ledgers → Blueprint V1 → Analytics Design V1 → Step 2 report). See hold below |

**Gitlink forensics (key negative proof):** in every new snapshot the nested OnCall Foot
repository appears only as a **gitlink (mode `160000`)** — a pointer to a commit SHA, never
the nested repo’s file content. At the `conflict_120826_1319` tip the `foot` gitlink points
to `21b282b4…` (clean canonical `main`). A gitlink is structurally incapable of carrying
uncommitted working-tree changes, which is why the approved-but-uncommitted Analytics
Step 2 Part 1 implementation could never have reached GitHub through these snapshots.

## E. Explicit HOLDS (3) — must not be touched by any future cleanup

1. **`conflict_110826_1322` — COMFORT-WIRING CANON HOLD.** Canonical preserved
   Comfort-Wiring state (contract V3 + V3.1, 11 patches + signed INDEX, CW ledger
   ENTRY-001..019, 27/27). Per Eagle View §4 and V7 conclusion 3: CW branches must be
   exported to their own repository/archive (order `1322 → 1134 → 1112 → 0846`) BEFORE
   any cleanup is even considered. No deletion is authorized.
2. **`conflict_120826_1319` — ANALYTICS LOSS-EVIDENCE HOLD.** Sole surviving evidence of
   the Analytics Step 2 Part 1 loss (Session 081 ledger): report commit `1e2edf9`
   (`foot-validation-prevented-ddl.sql`, `foot-validation-schema-v2.sql`,
   `test_reports/iteration_3.json`) plus workspace-metadata commits. It contains
   report/validation artifacts, NOT the implementation. Never merge it, never PR it,
   never use it as a code source, never apply its SQL. Hold untouched at least until
   Path A recovery (re-opening the original Emergent session) is resolved.
3. **`conflict_120826_0317` — DOCUMENTED HISTORICAL-SNAPSHOT HOLD.** Session 074
   bundle-recovery snapshot, already recorded in the V7 addendum (Session 078) as
   containing no unpublished OnCall Foot working-tree changes. Preserved as audit history.

## Standing conclusions

1. **Nothing on any `conflict_*` branch is mergeable into `main`** (30 of 31 have no merge
   base; `conflict_070826_mc2` is cherry-verified superseded).
2. **No unpublished OnCall Foot application code exists on any currently accessible
   branch.** The Session 081 four-filename search across all heads returned zero matches;
   gitlink forensics show nested-repo working trees were never captured.
3. **The approved Analytics Step 2 Part 1 implementation is LOST from GitHub and from all
   currently accessible containers.** Recovery is possible only via Path A (the original
   Emergent session’s container). Fresh reimplementation remains UNAPPROVED while Path A
   is pending (Session 081 ledger).
4. **Cleanup remains UNAUTHORIZED.** Any future archival/cleanup must be re-authorized
   against THIS inventory by name, must respect the three HOLDS above, and must export
   the Comfort-Wiring branches first. This document authorizes no branch operation.
