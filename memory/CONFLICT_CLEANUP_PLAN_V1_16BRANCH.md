# Conflict-Branch Cleanup Plan v1 — 16-branch scope (AUTHORIZED PLAN, DELETION NOT AUTHORIZED)

Date: 2026-08-10 (continuation container). Authorization: operator message of this
session — "a fresh 16-branch-scoped read-only classification and cleanup plan
covering exactly the 16 pinned conflict_* branches, including conflict_100826_1234
at f9d0b7e9…. This authorization does not authorize deletion yet."
Supersedes: the Session 058 nine-branch cleanup authorization (STALE — predates
branches #11–#16; formally retired by this plan).

Basis inventory: v4 — evidence/CONFLICT_BRANCH_INVENTORY_V4_2026-08-10.md,
sha256 247055bdc455679a7b033a5a65d38af2c32b83b0d116f2b15f97c81deb08cef8 (retained
per authorization condition 2). Remote ref surface verified read-only this
session: HEAD + refs/heads/main + 16 refs/heads/conflict_* — ZERO tags, ZERO
pull-request refs, ZERO other refs.

## 1. Pinned tips and classification (authorization condition 1)

| # | Branch | Pinned tip (full SHA) | Classification | Disposition class |
|---|--------|----------------------|----------------|-------------------|
| 1 | conflict_310726_1942 | ffe8515962a6f617b183dab3adb1059905109ee2 | Preserved evidence — unrelated Emergent lineage | A (deletion candidate) |
| 2 | conflict_310726_2216 | 5e852632731b3d14a21544bd087cfbb90e4e644d | Preserved evidence — unrelated Emergent lineage | A (deletion candidate) |
| 3 | conflict_010826_0008 | a5638c55c4e182db98413eed4e1319b573776fd6 | Preserved evidence — unrelated Emergent lineage | A (deletion candidate) |
| 4 | conflict_010826_0036 | 0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2 | Preserved evidence — unrelated Emergent lineage | A (deletion candidate) |
| 5 | conflict_060826_2025 | 058cf6ecb01cc6bc02c0f9982115be96851b6006 | Preserved evidence — unrelated Emergent lineage | A (deletion candidate) |
| 6 | conflict_070826_mc2 | bed2e069107df40312e806536c6fb462e8f402bc | Superseded lineage — REAL foot history (merge-base 54534b0; MC2 published as 1f4c018) | C (EXCLUDED — historically substantive) |
| 7 | conflict_080826_1307 | 305fd861353b846a32c6cce5daa9a054631bda1e | Unrelated lineage; carries phase1 MC1–MC4 + hygiene patch copies | A* (deletion candidate after patch byte-verification) |
| 8 | conflict_090826_0856 | 7110dc939810271908b5409b7cbb3c7b09342463 | Unrelated lineage; carries MC9 commit1–3 patch copies | A* (deletion candidate after patch byte-verification) |
| 9 | conflict_090826_1405 | 60979dbfba25095085fe6b04dc32b5ec01896308 | Unrelated lineage; carries web-feed + phase1-events patch copies | A* (deletion candidate after patch byte-verification) |
| 10 | conflict_090826_1718 | c3589b1941f2f5993477a0b0c6eb9b23823d568d | Unrelated lineage; same patch set as #9 | A* (deletion candidate after patch byte-verification) |
| 11 | conflict_090826_1916 | 81014b03325101c20fe8d2fbc61a8d8f2b6df319 | Unrelated lineage; carries publication-gate + session 055/057/058 traceability patch copies | A* (deletion candidate after patch byte-verification) |
| 12 | conflict_090826_2136 | 7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33 | Unrelated Emergent lineage; no patch artifacts | A (deletion candidate) |
| 13 | conflict_090826_2326 | 73bdad6ba0c354234d89670ce5bce22e0147e075 | EVIDENCE-BEARING — memory/PRD.md = Session 061 handoff state | B (EXCLUDED pending durable evidence preservation) |
| 14 | conflict_100826_0813 | 8cc00284ad2dfb654374469e001ba3f39fe322a8 | Unrelated Emergent lineage; no patch artifacts | A (deletion candidate) |
| 15 | conflict_100826_0906 | 018e69bff9aca281ceed19f8be34a0e567e71422 | Unrelated Emergent lineage; no patch artifacts | A (deletion candidate) |
| 16 | conflict_100826_1234 | f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00 | EVIDENCE-BEARING (HIGH VALUE) — recovered governance set in memory/** (ledger, deploy-key deletion evidence, Gate A report, post-containment inventory, audit export; checksums recorded) | B (EXCLUDED pending durable evidence preservation) |

Disposition classes:
- **A — plain deletion candidates (8):** #1–5, #12, #14, #15. Unrelated Emergent
  template lineages, "Auto-generated changes" only, no common ancestor with main,
  no patch artifacts, no unique unrecovered content found.
- **A\* — deletion candidates conditional on patch byte-verification (5):**
  #7–#11. Same lineage class, but each carries `.patch` copies whose NAMES map to
  work published on main (MC1–MC4 → published phase-1 commits; MC9 commits 1–3 →
  0afb3ff/92d001f/917361d line; web feed → a98e1a3; phase1 events → d7a5999;
  publication gate f957caf → 5853768; session 055/057/058 docs → published
  traceability). Session 058's accepted inventory already found "every patch
  artifact corresponds to work already published on main" for the branches that
  existed then; #11 (and re-checks for #7–#10) must be BYTE-verified against the
  published trees during final confirmation.
- **B — evidence-bearing, EXCLUDED from deletion in this plan (2):** #13, #16.
  #16's evidence set has been extracted with verified checksums (this session)
  but the branch remains the authoritative original until the evidence is
  durably preserved (e.g., published in a reviewed traceability/evidence commit
  or an operator-held archive). #13's PRD is corroborated by main but has not
  been separately preserved.
- **C — historically substantive, EXCLUDED (1):** #6 (conflict_070826_mc2).
  The prior tag-then-delete idea is NOT carried into this plan; any future
  handling requires its own authorization. An `archive/conflict_070826_mc2` tag
  at `bed2e06` remains a recommended prerequisite for any future decision.

## 2. Hard exclusions (authorization condition 3)

- `refs/heads/main` — never touched.
- Tags — none exist (verified); any future tag is excluded.
- Pull-request refs — none exist (verified); excluded categorically.
- Class B (#13, #16) and Class C (#6) — excluded as unresolved-value /
  historically substantive.

## 3. Preconditions before ANY deletion (authorization conditions 1–5)

1. Ledger holds each branch's exact tip + classification (section 1 — DONE).
2. v4 inventory report + checksum retained (DONE; see basis above).
3. Exclusions applied (section 2).
4. **Separate final operator confirmation naming the EXACT branches to delete**
   (by full name and pinned tip SHA). Nothing may be deleted on the basis of
   this plan alone. If any branch tip differs from its pinned SHA at execution
   time, STOP and file a discrepancy report — do not delete a moved branch.
5. A\* branches additionally require completed patch byte-verification with the
   results recorded in the ledger.
6. Execution channel: authenticated managed environment only; deletion via
   plain ref deletion (push :refs/heads/<name> or API delete); NO force-push,
   NO rewrite, NO merge, NO modification of preserved branches; `main` and all
   preserved refs re-verified unchanged immediately after each deletion.
7. Post-execution: fresh full ls-remote snapshot recorded in the ledger with
   checksum; inventory version incremented.

## 4. What this plan does NOT do

- It deletes nothing and modifies nothing (this session performed zero write
  operations against the remote).
- It does not authorize touching main, tags, or PR refs.
- It does not revive the stale Session 058 nine-branch list (retired).
