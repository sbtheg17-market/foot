# Evidence Ledger — Human Summary
Generated 2026-08-11T05:41:57Z from LEDGER.jsonl (append-only; 15 records).

Status totals: FAIL=2, PASS=13

| # | UTC time | Type | Action | Status | Exit | Tests | Key artifact |
|---|---|---|---|---|---|---|---|
| AC-001 | 2026-08-11T04:59:41Z | verification | rule12 r3 candidate identity verification | PASS | 0 | — | recovery/ledger/logs/AC-001_rule12_r3_candidate_identity_verificatio.log |
| AC-002 | 2026-08-11T04:59:53Z | gate | rule12 r3 publication review gate (pre-approval safety check) | PASS | 0 | — | recovery/ledger/logs/AC-002_rule12_r3_publication_review_gate__pre_a.log |
| AC-003 | 2026-08-11T05:00:08Z | verification | rule12 r3 patch secret scan | FAIL | 1 | — | recovery/ledger/logs/AC-003_rule12_r3_patch_secret_scan.log |
| AC-004 | 2026-08-11T05:00:08Z | test | phase4c r3 comfort-profile contract tests (ledger capture) | PASS | 0 | 38/38 | recovery/ledger/logs/AC-004_phase4c_r3_comfort_profile_contract_test.log |
| AC-005 | 2026-08-11T05:00:47Z | verification | supersedes AC-003 (fail was policy-text false positive) — rule12 r3 secret value scan via pattern file | PASS | 0 | — | recovery/ledger/logs/AC-005_supersedes_ac_003__fail_was_policy_text_.log |
| AC-006 | 2026-08-11T05:01:27Z | handoff | rule12 r3 package assembled (local-only, unpublished) | PASS | 0 | — | recovery/ledger/logs/AC-006_rule12_r3_package_assembled__local_only_.log |
| AC-007 | 2026-08-11T05:02:36Z | handoff | phase4c r3 package export + endpoint round-trip checksum verification | PASS | 0 | — | recovery/ledger/logs/AC-007_phase4c_r3_package_export___endpoint_rou.log |
| AC-008 | 2026-08-11T05:03:50Z | handoff | gate B managed runbook written (owner-facing, secret-safe) | PASS | 0 | — | recovery/ledger/logs/AC-008_gate_b_managed_runbook_written__owner_fa.log |
| AC-009 | 2026-08-11T05:03:50Z | handoff | phase4c r3 publication-readiness checklist prepared (stops before window/credential) | PASS | 0 | — | recovery/ledger/logs/AC-009_phase4c_r3_publication_readiness_checkli.log |
| AC-010 | 2026-08-11T05:36:15Z | handoff | rule12 r3 package export + endpoint round-trip checksum verification | PASS | 0 | — | recovery/ledger/logs/AC-010_rule12_r3_package_export___endpoint_roun.log |
| AC-011 | 2026-08-11T05:39:35Z | verification | publication checklist items 1-8 DRY RUN (preparation only — NOT publication readiness; items 9-15 not executed) | FAIL | 1 | — | recovery/ledger/logs/AC-011_publication_checklist_items_1_8_dry_run_.log |
| AC-012 | 2026-08-11T05:40:19Z | verification | supersedes AC-011 (fail was script cwd defect, not a gate result) — publication checklist items 1-8 DRY RUN, preparation only, items 9-15 not executed | PASS | 0 | — | recovery/ledger/logs/AC-012_supersedes_ac_011__fail_was_script_cwd_d.log |
| AC-013 | 2026-08-11T05:40:33Z | handoff | phase4c comfort-wiring plan drafted for review (plan only; nothing wired; openapi remains draft) | PASS | 0 | — | recovery/ledger/logs/AC-013_phase4c_comfort_wiring_plan_drafted_for_.log |
| AC-014 | 2026-08-11T05:41:57Z | verification | supersedes AC-006 — rule12 r3 CHECKSUMS.sha256 legitimately regenerated during export packaging (MANIFEST.json + STATUS.txt added per owner instruction); package re-verified 8/8 OK | PASS | 0 | — | recovery/candidates-r3/rule12_r3/CHECKSUMS.sha256 |
| AC-015 | 2026-08-11T05:41:57Z | verification | supersedes AC-011 (structured) — dry-run script cwd defect fixed; corrected session recorded as AC-012 with items 1-8 ALL PASS | PASS | 0 | — | recovery/work/dryrun-items-1-8.sh |

Classification key: PASS = captured and reproducible · FAIL = captured with diagnosis · BLOCKED = external prerequisite missing · UNRECORDED = output lost, must rerun · NOT_RUN = deliberately not executed.

No tokens, passwords, database URLs, private keys, or secrets are recorded; commands are redacted before persistence.
