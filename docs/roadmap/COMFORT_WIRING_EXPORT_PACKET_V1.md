# Comfort-Wiring Export Packet V1 — 2026-08-12 (Session 081)

**Status:** design-only export-conditions packet. This document authorizes NO branch
operation. It defines the verified state of the four Comfort-Wiring (CW) preservation
branches and the conditions that must ALL hold before any future, separately authorized
export or archival task may touch them.
**Baseline:** inventory context in `docs/roadmap/BRANCH_INVENTORY_V8.md`; all data below
gathered read-only (`git ls-tree` / `cat-file` / `rev-list` / `merge-base`) in Session 081.
**Standing rule:** do not merge, delete, archive, rewrite, or modify any CW branch. No
cross-project content transfer without a separately reviewed packet.

## 1. Verified branch ancestry

```text
Root 66e9b96 ──► conflict_110826_0846            (12 commits, tip 39965b0f…, 2026-08-11 12:47)
                 RECOVERY/AUDIT workspace — SEPARATE lineage

Root efbf7ec ─┬─► conflict_110826_1112 (15 commits, tip c687c8f8…, 2026-08-11 15:12)
              │        └── strict git ancestor of ▼
              ├─► conflict_110826_1134 (18 commits = 1112 + 3, tip 0fa8ffc1…, 2026-08-11 15:35)
              └─► conflict_110826_1322 (8 commits, SIBLING chain, tip 93cf393e…, 2026-08-11 17:23)
                  CANONICAL CW STATE — content supersedes 1112/1134
```

- The Eagle View order `1322 → 1134 → 1112 → 0846` is an export PRIORITY order, not git
  ancestry.
- None of the four branches has any merge base with `main`. Nothing here is mergeable.

## 2. `conflict_110826_1322` — canonical Comfort-Wiring state

Tip `93cf393e8ea6cb9549591477128a8554d5aaead1`, 127 files. The single authoritative CW
tree:

- `patches/` — 13 patches plus signed `INDEX.json` (task / evidence / approval verbatim,
  including the ENTRY-012 dev/staging AUTH caveat and its cycle-2 closure via
  `AUTH_bypass-removal.patch`).
- `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` (contract V3 + V3.1).
- CW ledger `.agents/LOG.md` — ENTRY-001..019 complete (19 entries verified).
- Tests incl. `provider-auth` and `consent-history` suites; 27/27 evidence in
  `test_reports/iteration_3.json`.
- CW application (FastAPI/Mongo backend `comfort_profile.py` / `patch_index.py`; React
  comfort-profile components incl. `ConsentHistoryTimeline`).
- Cycle-2 delta over 1134 (12 files): `AUTH_provider-signin.patch`,
  `AUTH_bypass-removal.patch`, `C4_consent-scope-picker.patch`, `C5_consent-history.patch`,
  `C6_patch-approval-filters.patch`, `ConsentHistoryTimeline.jsx`,
  `consent-history.api.test.mjs`, `test_reports/iteration_3.json`, `backend_test.py`,
  and three memory reports.

## 3. `conflict_110826_1134` and `conflict_110826_1112` — ancestry branches

- `1112` (114 files) is a STRICT git ancestor of `1134`: zero unique commits, zero unique
  content. Its only preserved value is as `1134`'s history prefix.
- `1134` (115 files) adds three commits over `1112`; the material one is `30af883`
  “record repo-separation decision (ENTRY-013)”.
- Both are content-superseded by `1322`'s tree but sit on a DIFFERENT commit chain
  (sibling lineage from the shared root `efbf7ec`), so their commit history is not
  contained in `1322` and must be preserved or exported as history, not assumed
  duplicated.

## 4. `conflict_110826_0846` — separate lineage with OnCall Foot custody requirement

Tip `39965b0f5e61a142068417750ca0fbc1d1a02435`, 318 files, root `66e9b96` (distinct
lineage). This branch is NOT purely Comfort-Wiring property:

- **`recovery/handoff-bundle/foot-all-refs.bundle` (12,051,181 bytes, git blob
  `7a18f6bf…`) is committed in-tree** — the complete pre-rebuild OnCall Foot repository
  as a self-contained all-refs git bundle (29 refs, 312 commits, 2026-07-25 → 2026-08-11;
  heads incl. `main` = `d489aae…` 111 commits, `replit-agent` = `9682040…`,
  old-remote `origin/main` = `d2ad54c…` 151 commits, 22 legacy conflict refs, and
  `refs/replit/agent-ledger`).
- Embedded bare repo `recovery/foot.git/` (tracked as files; refs `main` = `d489aae…`,
  `replit-agent`; origin = the bundle above; 29 loose candidate-era objects).
- Append-only capture ledger `recovery/ledger/LEDGER.jsonl` (23 records) with
  `capture.py` / `record_action.py` / `secret-patterns.grep`.
- Governance and acceptance artifacts: `DECISION_PROTOCOL.md`, `GATE_B_RUNBOOK.md`,
  `COMFORT_WIRING_PLAN.md` + `_REVIEW.md`, `PLAN_V1.1_ACCEPTANCE.md`,
  `PUBLICATION_CHECKLIST_phase4c_r3.md`, `RECOVERY_MATRIX.md`,
  `recovery-matrix-full.json`, sealed-export checksums, `HANDOFF-R3-MANIFEST.sha256`.
- Two gitlinks are NOT captured (`recovery/checkout → d9195df`,
  `recovery/checkout-rule12 → fc6251a`): those worktree contents are known-unrecoverable
  from this branch; the candidate patches themselves are present as files.

## 5. Bundle custody prerequisites

Session 081 custody verification (read-only) recorded:

```text
SHA-256: bcaed3a2683902244f755819e0bcd4f62889a83b35e6e6fa81ada715ab706fc1
```

- Streamed-from-git, extracted-copy, and the branch's own sealed
  `foot-bundle-checksums.sha256` all match (byte-identical, triple match).
- `git bundle verify`: OKAY — records a COMPLETE history, zero prerequisites
  (self-contained), sha1 hash algorithm.
- The verified copy resides only in a session-bound workspace. **Durable off-workspace
  custody (operator-held storage or a dedicated archive repository) with a re-verified
  SHA-256 is a PREREQUISITE for any future cleanup discussion involving `0846`.**
- The bundle must never be pushed to GitHub or committed into this repository.

## 6. Export conditions (ALL must hold; each step separately authorized)

1. **No branch deletion before custody verification.** No CW branch may be deleted,
   archived, or modified until the `foot-all-refs.bundle` custody copy is confirmed in
   durable operator-held storage with a matching SHA-256, and the export of each branch
   below is verified.
2. **Export order:** `1322 → 1134 → 1112 → 0846`, each to a dedicated CW archive
   repository — never into `foot`'s history.
3. **Per-export verification:** full-tree checkout of the exact tip SHA; SHA-256 manifest
   of every file; re-verify `patches/INDEX.json` approvals, CW ledger ENTRY-001..019
   completeness, and 27/27 test-report presence; for `0846`, re-run `git bundle verify`
   against the sealed checksums and verify the 23-record `LEDGER.jsonl`.
4. **History, not just trees:** `1134`/`1112` carry commit history absent from `1322`;
   exports must preserve commit chains (mirror/bundle), not flattened file copies.
5. **Ledger first:** a docs-only ledger entry (source SHA, destination, manifest hash)
   merges to `main` before any ref is touched.
6. **No cross-project content transfer without review:** nothing from the CW branches
   enters OnCall Foot (and vice versa) without its own reviewed packet; the pre-rebuild
   foot bundle in `0846` is OnCall Foot property held inside a CW-era branch and follows
   OnCall Foot custody, not CW custody.
7. **Hard stops:** no squash/rewrite of exported history; `1112` may only be archived
   together with (never before) `1134`; operator must sign off each export verification
   by name against this packet; none of this touches Supabase, migrations, or the
   Race-Proof booking invariant in any way.
