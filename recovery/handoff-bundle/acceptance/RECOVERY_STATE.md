# Recovery State — sbtheg17-market/foot handoff reconstruction

Mode: READ-ONLY. No push, no merge, no reset, no branch cleanup, no tests, no credential use.
Working dir: /app/recovery (persistent).

## Baseline (from owner + README.txt, checksum-verified)
- origin: https://github.com/sbtheg17-market/foot (recorded for provenance only; NO remote will be configured)
- origin/main = d2ad54cd8e450fcc3bf8fab28aed257d67e73b42
- local checked-out main at bundle time = d489aaed98764fbb7d4a40d3f03db1ed78ae7f66
- handoff-MANIFEST-80.sha256 originates from repo commit 6a3d370 (80 lines)
- handoff-MANIFEST-149.sha256 originates from repo commit 45d5ba1 (149 lines)

## Supplied-file verification (all against top-level MANIFEST.sha256)
| File | SHA-256 status |
|---|---|
| MANIFEST.sha256 | root of trust; self-hash 2149fba012a749317b6b3561a8963a4d1366958f45da9269253f3b591d14b503 |
| foot-bundle-checksums.sha256 | OK (305e5ef4...) |
| handoff-MANIFEST-80.sha256 | OK (21c066f6...) |
| handoff-MANIFEST-149.sha256 | OK (1b58e7f5...) |
| entry-list-80.txt | OK (361e5959...) |
| entry-list-149.txt | OK (13b478f2...) |
| handoff-downloads-MANIFEST-80.json | OK (ccd9c650...) |
| handoff-downloads-MANIFEST-149.json | OK (ccd9c650...) — byte-identical to the -80 json |
| README.txt | OK (851ceae5...) |

## Still awaited from owner (listed in MANIFEST.sha256, not yet uploaded)
| File | Expected SHA-256 |
|---|---|
| foot-all-refs.bundle (REQUIRED for branch search) | bcaed3a2683902244f755819e0bcd4f62889a83b35e6e6fa81ada715ab706fc1 |
| foot-all-refs.txt | 3fb645e45f13cbb6ddc87f3e105c9a8e46612d1621036dd963a4c931e7cffe72 |
| foot-bundle-verify.txt | 2a4edcbdba7ee178ee66c0026160e21b7b4d23d795ac4c251836430660d7d97f |
| bundle-heads.txt | 997ace00eff42693b32543b852e79a8b0ea5b5fefac09ba88a70d035ea6c4909 |

## Ref inventory (from entry-list-80.txt, checksum-verified)
main d489aaed98764fbb7d4a40d3f03db1ed78ae7f66
origin/conflict_010826_0008 a5638c55c4e182db98413eed4e1319b573776fd6
origin/conflict_010826_0036 0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2
origin/conflict_060826_2025 058cf6ecb01cc6bc02c0f9982115be96851b6006
origin/conflict_070826_mc2 bed2e069107df40312e806536c6fb462e8f402bc
origin/conflict_080826_1307 305fd861353b846a32c6cce5daa9a054631bda1e
origin/conflict_090826_0856 7110dc939810271908b5409b7cbb3c7b09342463
origin/conflict_090826_1405 60979dbfba25095085fe6b04dc32b5ec01896308
origin/conflict_090826_1718 c3589b1941f2f5993477a0b0c6eb9b23823d568d
origin/conflict_090826_1916 81014b03325101c20fe8d2fbc61a8d8f2b6df319
origin/conflict_090826_2136 7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33
origin/conflict_090826_2326 73bdad6ba0c354234d89670ce5bce22e0147e075
origin/conflict_100826_0813 8cc00284ad2dfb654374469e001ba3f39fe322a8
origin/conflict_100826_0906 018e69bff9aca281ceed19f8be34a0e567e71422
origin/conflict_100826_1234 f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00
origin/conflict_100826_1415 27a5ada26367158b9e79b7321e18fa5b4e5019d6
origin/conflict_100826_1543 9e9a3ee9ae0c56d67c6e8ffe527f7ea8c9b0321b
origin/conflict_100826_1738 1eefbfd37b3008e59b55b887d83634e16484fd76   <- PRIORITY 3
origin/conflict_100826_1941 9a752aec36c4abd5bf4bfa9760fdb9267392072e   <- PRIORITY 2
origin/conflict_100826_2113 b9d27229a86d1ecf39b9f289251773eb88386e1a   <- PRIORITY 1
origin/conflict_100826_2258 12c88633121eb7ad137654eabdd1661b4f5cbf56   <- PRIORITY 4
origin/conflict_310726_1942 ffe8515962a6f617b183dab3adb1059905109ee2
origin/conflict_310726_2216 5e852632731b3d14a21544bd087cfbb90e4e644d
origin/main d2ad54cd8e450fcc3bf8fab28aed257d67e73b42
replit-agent 9682040bd5111691ebd73f63d439984a911de800
replit/agent-ledger 9682040bd5111691ebd73f63d439984a911de800
(22 conflict_* refs confirmed, including all four priority refs)

## Manifest reconciliation (149 vs 80)
- 64 common paths, ZERO checksum conflicts
- 85 paths only in 149-list; 16 paths only in 80-list
- handoff-downloads-MANIFEST-80.json == -149.json (identical sha ccd9c650...)

## Historical package context (handoff-downloads JSON)
- Transport-only patch package, generated 2026-08-10T23:20:09Z
- Historical baseline main at package time: 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
- Candidates: A_prime (commit f4a5dfec, parent 3e76114c), C_prime (re-derive), B_prime (re-derive),
  phase4c_prep + rule12_provenance (separate approvals)
- applied_remotely=false, publication_window_opened=false

## FINAL RESULT (2026-08-11) — OUTCOME: INCOMPLETE

Bundle verification: SHA-256 match (bcaed3a2...), `git bundle verify` okay/complete history,
29 refs exactly match foot-all-refs.txt / bundle-heads.txt / owner verify record. fsck clean.
Mirror at /app/recovery/foot.git (origin remote removed; refs restored exactly from verified
foot-all-refs.txt after removal side-effect; re-diffed: identical).

Search executed: full history of all 22 conflict_* branches + origin/main + local main
= 311 commits, 305 unique trees, 2294 blobs (owner entry-list-149 inventory: 4206 objects — consistent).

### Matrix summary
- handoff-MANIFEST-149: 90 VERIFIED_PRESENT / 59 NOT_FOUND / 0 mismatch
- handoff-MANIFEST-80: 64 VERIFIED_PRESENT / 16 NOT_FOUND / 0 mismatch
- CHECKSUM_MISMATCH: none (earlier tip-level ledger mismatches resolved byte-identically in history)
- Unique missing files: 55 (75 manifest entries incl. duplicates)
- Recovery sources: conflict_100826_1941 (primary), conflict_100826_2113, conflict_100826_2258
  under handoff/ and audit/handoff_restore/handoff/ trees; conflict_100826_1738 holds only the
  takeover docs handoff/00..04 (predates package assembly), contributed no package artifacts.

### Missing set (55 unique) by category
- BD-* B′ r2 validation evidence: 19; P4-* Phase 4C r2: 8; RD-* Rule 12 r2: 2
- CD-* C′ r2: 4; TO-* takeover session: 9; PB-* publication verification: 3
- RG-* regenerated transport logs: 6
- Archives: A_prime_package.tar.gz/.zip, C_prime_r2_package.tar.gz/.zip (4)
Full list: /app/recovery/report/RECOVERY_MATRIX.md

### Nested bundle recovery (evidence)
candidates/local-branches-2026-08-10.bundle recovered byte-identical (sha 99760835...),
verify okay, 5 refs; commit/parent/tree verified against handoff-downloads JSON:
- A′ f4a5dfec (parent 3e76114, tree 63dcfbe3) EXACT
- B′ e6380bf7 (tree c6e8c1f2) EXACT
- C′ 2c6d0248 (tree 093a2c22) EXACT
- rule12 b85f71f3 (tree a4091ce2) EXACT
- phase4c_prep 2dc23539 (tree 56d34d2b) EXACT (bundle tip 7009ce66 is one commit ahead)
r2 commit objects 9e0bbd45 (B′ r2), 396040ea (P4C r2), e5919bd4 (Rule12 r2): ABSENT from both
ODBs — r2 patches retained as evidence only; NOT publication-ready; NOT re-derived.

### Acceptance layer (2026-08-11, post-recovery)
- Evidence ceiling declared in acceptance/ACCEPTANCE_RECORD.md (90/149 + 64/80; 55 missing;
  no 149/149 or 80/80 claim; no rebuild; no regeneration; r2 candidates blocked).
- Layered handoff set at /app/recovery/handoff-bundle/: original 13 supply files byte-identical
  (re-verified against owner MANIFEST.sha256) + acceptance/ subdirectory + ACCEPTANCE-LAYER-README.txt
  + roll-up ACCEPTANCE-MANIFEST.sha256. Import procedure for later-supplied files documented
  (verify SHA-256 per MISSING_FILES_55.txt, no overwrites, provenance log, matrix rerun,
  rebuild only at full verification).
- Standing constraints: new work from canonical main d2ad54cd only, with review;
  Gate B / schema / migrations / storage / economics / publication BLOCKED pending
  separate approval.

### Claims discipline
149/149 and 80/80 NOT claimed. Verified counts: 90/149 and 64/80.
Handoff bundle NOT rebuilt (missing files). No push/merge/test/cleanup/credentials/Gate B.
Owner action required: supply the 55 missing files (or the original evidence exports /
package archives) from the source workstation; alternatively accept the r1-candidate
evidence chain as the maximum recoverable set.
