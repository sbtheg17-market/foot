# 2. Full branch inventory — 18 `conflict_*` branches + `main`

Verified 2026-08-10T19:55:14Z. **DISCREPANCY: the handoff statement says 16 conflict branches; the remote has 18.** See reconciliation below. All are archival snapshots only — never a development base, never merged.

Classification method (reproducible): `git merge-base origin/main origin/<branch>` — `NONE` means the branch shares no history with `main` (unrelated Emergent workspace lineage). Only `conflict_070826_mc2` shares real foot ancestry.

| # | Branch | Tip SHA | Tip commit date (UTC) | Classification |
|---|--------|---------|----------------------|----------------|
| 1 | conflict_310726_1942 | `ffe8515962a6f617b183dab3adb1059905109ee2` | 2026-07-31T23:43:13Z | Unrelated Emergent lineage (no merge-base) |
| 2 | conflict_310726_2216 | `5e852632731b3d14a21544bd087cfbb90e4e644d` | 2026-08-01T02:17:06Z | Unrelated Emergent lineage |
| 3 | conflict_010826_0008 | `a5638c55c4e182db98413eed4e1319b573776fd6` | 2026-08-01T04:09:14Z | Unrelated Emergent lineage |
| 4 | conflict_010826_0036 | `0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2` | 2026-08-01T04:36:12Z | Unrelated Emergent lineage |
| 5 | conflict_060826_2025 | `058cf6ecb01cc6bc02c0f9982115be96851b6006` | 2026-08-07T00:26:30Z | Unrelated Emergent lineage |
| 6 | conflict_070826_mc2 | `bed2e069107df40312e806536c6fb462e8f402bc` | 2026-08-08T13:28:46Z | **Real foot history, superseded** (merge-base `54534b0b2541d50a7ae1a1b64a18312482ea86dd`); pinned archive-tag target per Session 058/062 |
| 7 | conflict_080826_1307 | `305fd861353b846a32c6cce5daa9a054631bda1e` | 2026-08-08T17:08:10Z | Unrelated Emergent lineage |
| 8 | conflict_090826_0856 | `7110dc939810271908b5409b7cbb3c7b09342463` | 2026-08-09T12:56:59Z | Unrelated Emergent lineage |
| 9 | conflict_090826_1405 | `60979dbfba25095085fe6b04dc32b5ec01896308` | 2026-08-09T18:05:37Z | Unrelated Emergent lineage |
| 10 | conflict_090826_1718 | `c3589b1941f2f5993477a0b0c6eb9b23823d568d` | 2026-08-09T21:18:51Z | Unrelated Emergent lineage |
| 11 | conflict_090826_1916 | `81014b03325101c20fe8d2fbc61a8d8f2b6df319` | 2026-08-09T23:16:35Z | Unrelated Emergent lineage |
| 12 | conflict_090826_2136 | `7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33` | 2026-08-10T01:36:52Z | Unrelated Emergent lineage |
| 13 | conflict_090826_2326 | `73bdad6ba0c354234d89670ce5bce22e0147e075` | 2026-08-10T03:26:34Z | Unrelated Emergent lineage — post-Session-062 (not in the 12-branch Gate A inventory) |
| 14 | conflict_100826_0813 | `8cc00284ad2dfb654374469e001ba3f39fe322a8` | 2026-08-10T12:14:04Z | Unrelated Emergent lineage — post-Session-062 |
| 15 | conflict_100826_0906 | `018e69bff9aca281ceed19f8be34a0e567e71422` | 2026-08-10T13:07:01Z | Unrelated Emergent lineage — post-Session-062 |
| 16 | conflict_100826_1234 | `f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00` | 2026-08-10T16:34:59Z | Unrelated Emergent lineage — post-Session-062; **last branch inside the handoff's count of 16** |
| 17 | conflict_100826_1415 | `27a5ada26367158b9e79b7321e18fa5b4e5019d6` | 2026-08-10T18:15:29Z | Unrelated Emergent lineage — **NEW, post-handoff; unexplained pending audit export** |
| 18 | conflict_100826_1543 | `9e9a3ee9ae0c56d67c6e8ffe527f7ea8c9b0321b` | 2026-08-10T19:44:06Z | Unrelated Emergent lineage — **NEW, post-handoff; unexplained pending audit export** |

`main` = `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (untouched by any of the above; verified).

## Count reconciliation
- **12** — Session 062 Gate A read-only inventory (recorded in `.agents/LOG.md` at the main tip): rows 1–12 above.
- **16** — the handoff statement's count: rows 1–16; matches the remote state as of ~16:35Z 2026-08-10 (row 16 pushed 16:34:59Z), which aligns exactly with the requested "post-16:35Z audit-log export".
- **18** — current remote state: rows 17–18 were pushed AFTER the handoff statement (18:15:29Z, 19:44:06Z). Attribution requires the audit-log export.

## Preserved exclusions (verbatim policy, still in force)
- Conflict branches are **archival snapshots only**; never merge, never rebase onto, never use as a development base.
- `conflict_070826_mc2` (`bed2e06`) is excluded from any deletion list — it must first be tagged `archive/conflict_070826_mc2` and the tag verified.
- The previously authorized cleanup list named ONLY nine branches (rows 1,2,3,4,5,7,8,9,10). It is now **stale** — it predates rows 11–18 — and cleanup remains **BLOCKED** regardless (pinned inventory/cleanup script unrecovered; no authenticated cleanup channel; explicitly listed under blocked work).
- Never delete `main`, never rewrite history, never edit remote refs from this packet's scope.
