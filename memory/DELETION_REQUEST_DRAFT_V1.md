# DELETION REQUEST — DRAFT v1 (NOT APPROVED — awaiting separate final confirmation)

Date: 2026-08-10. Prepared per the operator's 16-branch cleanup authorization
("First byte-verify the five conditional branches. Then draft a deletion request
naming every exact branch and full pinned tip."). THIS DRAFT AUTHORIZES NOTHING.

## Draft-before-action record

- Repository: https://github.com/sbtheg17-market/foot
- Action: delete exactly 13 remote branch refs (plain ref deletion; no other operation)
- Credential identity and scope: NOT YET PROVISIONED — requires a new bounded
  write credential scoped to this repository for one approved window; no audit
  key may be reused; no write credential currently exists in this workspace
- Validation basis: inventory v4 (sha 247055bd…), cleanup plan v1 (sha 89b67d0d…),
  byte-verification results below
- Ancestry check: none of the 13 targets shares any ancestor with main
  (merge-base = none, verified); deleting them cannot affect main's history
- Changed-file scope: none — ref deletion only; zero commits, zero file changes

## Byte-verification results (five conditional branches — COMPLETED 2026-08-10)

Method: every `.patch` artifact's post-image blob IDs (from its `index` lines)
checked for byte-identical presence in `main` history via `git log main
--find-object=<blob>`. Result: **102 of 103 post-image blobs are byte-present
in published main history** across all 17 patch artifacts on the five branches.
The single exception is NOT code: `conflict_080826_1307:phase1-mc1.patch`
carries an intermediate full-file image of `.agents/LOG.md` (blob `e943a05`,
absent everywhere); the LINE it adds ("Provider application resubmission …
`test:provider-resubmission` … 11 focused integration tests") is verbatim
present in main's current `.agents/LOG.md`. Classification: benign intermediate
traceability-doc state; consistent with the recorded managed-channel behavior
(verify content/tree, not byte-level doc images). All FIVE conditional branches
are therefore confirmed to hold no unique unrecovered work.

## Exact deletion targets (13) — names + full pinned tips

| # | Branch (refs/heads/…) | Pinned tip (must match at execution or STOP) |
|---|----------------------|----------------------------------------------|
| 1 | conflict_310726_1942 | ffe8515962a6f617b183dab3adb1059905109ee2 |
| 2 | conflict_310726_2216 | 5e852632731b3d14a21544bd087cfbb90e4e644d |
| 3 | conflict_010826_0008 | a5638c55c4e182db98413eed4e1319b573776fd6 |
| 4 | conflict_010826_0036 | 0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2 |
| 5 | conflict_060826_2025 | 058cf6ecb01cc6bc02c0f9982115be96851b6006 |
| 6 | conflict_080826_1307 | 305fd861353b846a32c6cce5daa9a054631bda1e |
| 7 | conflict_090826_0856 | 7110dc939810271908b5409b7cbb3c7b09342463 |
| 8 | conflict_090826_1405 | 60979dbfba25095085fe6b04dc32b5ec01896308 |
| 9 | conflict_090826_1718 | c3589b1941f2f5993477a0b0c6eb9b23823d568d |
| 10 | conflict_090826_1916 | 81014b03325101c20fe8d2fbc61a8d8f2b6df319 |
| 11 | conflict_090826_2136 | 7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33 |
| 12 | conflict_100826_0813 | 8cc00284ad2dfb654374469e001ba3f39fe322a8 |
| 13 | conflict_100826_0906 | 018e69bff9aca281ceed19f8be34a0e567e71422 |

## Explicit NON-targets (never deleted under this draft)

- refs/heads/main (3e76114ce8ff8908a955d4beac38d6b3cde5dd6a)
- conflict_070826_mc2 @ bed2e069107df40312e806536c6fb462e8f402bc (historically substantive)
- conflict_090826_2326 @ 73bdad6ba0c354234d89670ce5bce22e0147e075 (evidence-bearing)
- conflict_100826_1234 @ f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00 (evidence-bearing, HIGH VALUE)
- All tags and pull-request refs (none currently exist — verified 0/0)

## Execution procedure (managed environment only, after final approval)

1. Verify final approval names exactly the 13 branches + tips above.
2. Fresh `git ls-remote` snapshot; EVERY target tip must equal its pinned SHA;
   any drift → STOP, discrepancy report, no deletion.
3. Provision the bounded write credential; confirm it cannot touch main
   (protection evidence should exist by then).
4. Delete the 13 refs one at a time; after each: re-verify main and the three
   preserved conflict branches unchanged.
5. Final full ls-remote snapshot + checksum recorded in the ledger (expected
   result: main + conflict_070826_mc2 + conflict_090826_2326 +
   conflict_100826_1234 = 4 heads + HEAD).
6. Close window; revoke/delete the credential; record inventory v5.

## Rollback/stop conditions

- Any tip drift, any unexpected ref, any credential broader than repo-scoped,
  any failure to re-verify main after a deletion → STOP immediately, report,
  delete nothing further. (Note: branch deletion is recoverable only while
  GitHub retains the unreferenced objects; treat every deletion as effectively
  irreversible and gate accordingly.)

STATUS: **APPROVED by operator final confirmation (2026-08-10, ledger entry 15)**
naming all 13 targets explicitly. EXECUTION PENDING: managed environment + new
bounded repo-scoped write credential (none exists in this workspace). Fail-closed
executor: /root/foot-cleanup-window.sh (sha256 5bff775e…), token via
FOOT_CLEANUP_TOKEN env at runtime only.
