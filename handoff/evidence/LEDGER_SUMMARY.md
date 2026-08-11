# Evidence Ledger — Human Summary
Generated 2026-08-11T00:18:01Z from LEDGER.jsonl (append-only; 70 records).

Status totals: BLOCKED=5, FAIL=3, NOT_RUN=1, PASS=61

| # | UTC time | Type | Action | Status | Exit | Tests | Key artifact |
|---|---|---|---|---|---|---|---|
| BF-001 | 2026-08-10T21:47:00Z | inspection | live remote inventory (read-only) | PASS | 0 | — | memory/STATE_REPORT_2026-08-10.md |
| BF-002 | 2026-08-10T21:49:00Z | setup | mirror clone for inspection | PASS | 0 | — | — |
| BF-003 | 2026-08-10T21:51:00Z | inspection | newest conflict branch analysis | PASS | 0 | — | — |
| BF-004 | 2026-08-10T21:53:00Z | verification | candidate patch checksum verification (A'/B'/C') | PASS | 0 | — | repo_audit/handoff_extract/session063-rederived.patch |
| BF-005 | 2026-08-10T21:56:00Z | verification | apply-check + tree reproduction on canonical main | PASS | 0 | — | — |
| BF-006 | 2026-08-10T21:58:30Z | reconstruction | A' commit reconstruction | PASS | 0 | — | — |
| BF-007 | 2026-08-10T21:59:00Z | reconstruction | C' commit reconstruction | PASS | 0 | — | — |
| BF-008 | 2026-08-10T21:59:30Z | reconstruction | B' commit reconstruction | PASS | 0 | — | — |
| BF-009 | 2026-08-10T22:00:00Z | setup | ephemeral scratch PostgreSQL 15 | PASS | 0 | — | — |
| BF-010 | 2026-08-10T22:00:30Z | setup | pnpm 10.18.3 activation via corepack | PASS | 0 | — | — |
| BF-011 | 2026-08-10T22:01:05Z | test | C' frozen-lockfile install | PASS | 0 | — | repo_audit/battery_logs_install.log |
| BF-012 | 2026-08-10T22:01:22Z | setup | drizzle schema push to scratch DB | PASS | 0 | — | repo_audit/db_push.log |
| BF-013 | 2026-08-10T22:01:31Z | test | battery suite 1/13: booking-state-machine (pnpm run test) | PASS | 0 | 63/63 | repo_audit/battery/test.log |
| BF-014 | 2026-08-10T22:01:50Z | test | battery first integration attempt (3 suites) | FAIL | 1 | 0/16 | — |
| BF-015 | 2026-08-10T22:02:16Z | setup | seed demo accounts into scratch DB | PASS | 0 | — | repo_audit/battery/seed.log |
| BF-016 | 2026-08-10T22:02:34Z | build | api-server build + start on PORT=8090 | PASS | 0 | — | repo_audit/battery/server_build.log |
| BF-017 | 2026-08-10T22:04:49Z | test | battery suites 2-13/13 (12 integration suites, rerun) | PASS | 0 | 142/142 | repo_audit/battery/_exits.txt |
| BF-018 | 2026-08-10T22:07:20Z | test | B' typecheck + web build | PASS | 0 | — | repo_audit/battery/bprime_typecheck.log |
| BF-019 | 2026-08-10T22:09:21Z | gate | publish:gate A' (12/12) | PASS | 0 | — | repo_audit/battery/gate_A.log |
| BF-020 | 2026-08-10T22:09:35Z | gate | publish:gate C' | PASS | 0 | — | repo_audit/battery/gate_C.log |
| BF-021 | 2026-08-10T22:09:35Z | gate | publish:gate B' (mechanics check) | PASS | 0 | — | repo_audit/battery/gate_B.log |
| BF-022 | 2026-08-10T22:15:00Z | test | Phase 4C contract tests (initial) | PASS | 0 | 38/38 | — |
| BF-023 | 2026-08-10T22:17:40Z | test | Phase 4C prep workspace typecheck | PASS | 0 | — | repo_audit/battery/phase4c_typecheck.log |
| BF-024 | 2026-08-10T22:19:26Z | commit | Phase 4C non-schema prep commit | PASS | 0 | — | repo_audit/new_candidates/phase4c-nonschema-prep.patch |
| BF-025 | 2026-08-10T22:21:00Z | test | regression suite on prep branch | PASS | 0 | 63/63 | — |
| BF-026 | 2026-08-10T22:31:30Z | test | demo wiring typecheck (first run) | FAIL | 2 | — | — |
| BF-027 | 2026-08-10T22:33:41Z | test | demo wiring typecheck + web build (rerun) | PASS | 0 | — | repo_audit/battery/wire_typecheck.log |
| BF-028 | 2026-08-10T22:34:30Z | test | contract 38/38 + regression 63/63 after wiring | PASS | 0 | 101/101 | — |
| BF-029 | 2026-08-10T22:35:32Z | commit | Phase 4C demo wiring commit | PASS | 0 | — | repo_audit/new_candidates/phase4c-demo-wiring.patch |
| BF-030 | 2026-08-10T22:35:43Z | setup | serve demo for browser verification | PASS | 0 | — | repo_audit/battery/vite_demo.log |
| BF-031 | 2026-08-10T22:42:09Z | test | independent browser verification (testing agent) | PASS | 0 | 12/12 | test_reports/iteration_1.json |
| BF-032 | 2026-08-10T22:43:30Z | inspection | post-work remote re-verification (read-only) | PASS | 0 | — | — |
| BF-033 | 2026-08-10T22:44:00Z | publication | A' publication | BLOCKED | — | — | — |
| BF-034 | 2026-08-10T22:44:00Z | publication | C' re-derivation on new tip | BLOCKED | — | — | — |
| BF-035 | 2026-08-10T22:44:00Z | publication | B' re-derivation + reviewed --approve-web-ui rationale | BLOCKED | — | — | — |
| BF-036 | 2026-08-10T22:44:00Z | verification | managed Gate B (production DB catalog check) | BLOCKED | — | — | — |
| BF-037 | 2026-08-10T22:44:00Z | handoff | owner attribution of three newest snapshot branches | BLOCKED | — | — | — |
| LV-001 | 2026-08-10T22:54:45Z | verification | independent verification of the provenance ledger system (testing agent) | PASS | 0 | 17/17 | test_reports/iteration_2.json |
| LV-002 | 2026-08-10T23:03:46Z | inspection | durability audit of provenance artifacts | PASS | 0 | — | — |
| LV-003 | 2026-08-10T23:03:46Z | test | auto-capture wrapper sandbox test suite (10 behaviors) | PASS | 0 | — | — |
| LV-004 | 2026-08-10T23:03:46Z | commit | provenance-rule docs candidate creation | PASS | 0 | — | repo_audit/new_candidates/provenance-rule-docs.patch |
| LV-005 | 2026-08-10T23:03:46Z | gate | publish:gate provenance-rule candidate | PASS | 0 | — | repo_audit/battery/gate_provenance.log |
| LV-006 | 2026-08-10T23:03:46Z | handoff | durable handoff bundle creation | PASS | 0 | — | handoff/candidates/local-branches-2026-08-10.bundle |
| LV-007 | 2026-08-10T23:04:34Z | verification | correction: BF-030 artifact was a live-appended log | PASS | 0 | — | repo_audit/battery/vite_demo.frozen-20260810T2315Z.log |
| LV-008 | 2026-08-10T23:10:30Z | verification | independent verification round 2 (testing agent): wrapper + supersedes + provenance candidate + handoff bundle | PASS | 0 | 23/23 | test_reports/iteration_3.json |
| AC-001 | 2026-08-10T23:18:05Z | verification | transport validation A_prime | PASS | 0 | 6/6 | memory/evidence/logs/AC-001_transport_validation_a_prime.log |
| AC-002 | 2026-08-10T23:18:05Z | verification | transport validation C_prime | PASS | 0 | 6/6 | memory/evidence/logs/AC-002_transport_validation_c_prime.log |
| AC-003 | 2026-08-10T23:18:05Z | verification | transport validation B_prime | PASS | 0 | 6/6 | memory/evidence/logs/AC-003_transport_validation_b_prime.log |
| AC-004 | 2026-08-10T23:18:05Z | verification | transport validation phase4c_prep | PASS | 0 | 6/6 | memory/evidence/logs/AC-004_transport_validation_phase4c_prep.log |
| AC-005 | 2026-08-10T23:18:06Z | verification | transport validation rule12_provenance | PASS | 0 | 6/6 | memory/evidence/logs/AC-005_transport_validation_rule12_provenance.log |
| AC-006 | 2026-08-10T23:18:40Z | test | B-prime browser verification (this workspace) | NOT_RUN | — | — | — |
| AC-007 | 2026-08-10T23:18:40Z | test | phase4c contract tests (fresh capture for transport evidence) | PASS | 0 | 38/38 | memory/evidence/logs/AC-007_phase4c_contract_tests__fresh_capture_fo.log |
| LV-009 | 2026-08-10T23:21:48Z | handoff | transport-only patch package assembly (5 candidates) | PASS | 0 | — | handoff/patch_package/MANIFEST.json |
| LV-010 | 2026-08-10T23:30:32Z | verification | independent verification round 3 (testing agent): transport patch package | PASS | 0 | 74/74 | test_reports/iteration_4.json |
| NA-001 | 2026-08-11T00:03:53Z | inspection | new-account fetch: live remote inventory (21 heads incl. main) | PASS | 0 | — | memory/evidence/logs/NA-001_new_account_fetch__live_remote_inventory.log |
| NA-002 | 2026-08-11T00:04:05Z | inspection | newest snapshot scope: conflict_100826_1941 tip vs parent (one file) | PASS | 0 | — | memory/evidence/logs/NA-002_newest_snapshot_scope__conflict_100826_1.log |
| NA-003 | 2026-08-11T00:04:05Z | verification | handoff package checksum verification (patch_package 12/12 present OK; AC-00x evidence logs absent from snapshot) | PASS | 0 | — | memory/evidence/logs/NA-003_handoff_package_checksum_verification__p.log |
| NA-004 | 2026-08-11T00:04:05Z | verification | candidate bundle verify + restore-test (5 refs exact tips) | PASS | 0 | — | memory/evidence/logs/NA-004_candidate_bundle_verify___restore_test__.log |
| NA-005 | 2026-08-11T00:05:20Z | handoff | state matrix v4 written (local-only, zero remote writes) | PASS | 0 | — | memory/evidence/logs/NA-005_state_matrix_v4_written__local_only__zer.log |
| RG-001 | 2026-08-11T00:13:31Z | verification | regenerated transport validation A_prime (original AC log lost from durable snapshot) | PASS | 0 | 6/6 | memory/evidence/logs/RG-001_regenerated_transport_validation_a_prime.log |
| RG-002 | 2026-08-11T00:13:31Z | verification | regenerated transport validation C_prime (original AC log lost from durable snapshot) | PASS | 0 | 6/6 | memory/evidence/logs/RG-002_regenerated_transport_validation_c_prime.log |
| RG-003 | 2026-08-11T00:13:32Z | verification | regenerated transport validation B_prime (original AC log lost from durable snapshot) | PASS | 0 | 6/6 | memory/evidence/logs/RG-003_regenerated_transport_validation_b_prime.log |
| RG-004 | 2026-08-11T00:13:32Z | verification | regenerated transport validation phase4c_prep (original AC log lost from durable snapshot) | PASS | 0 | 6/6 | memory/evidence/logs/RG-004_regenerated_transport_validation_phase4c.log |
| RG-005 | 2026-08-11T00:13:32Z | verification | regenerated transport validation rule12_provenance (original AC log lost from durable snapshot) | PASS | 0 | 6/6 | memory/evidence/logs/RG-005_regenerated_transport_validation_rule12_.log |
| RG-006 | 2026-08-11T00:13:57Z | gate | regenerated publish:gate A_prime (gate_A.log lost from durable snapshot; git-only gate, local origin) | PASS | 0 | — | memory/evidence/logs/RG-006_regenerated_publish_gate_a_prime__gate_a.log |
| RG-007 | 2026-08-11T00:15:01Z | handoff | patch_package metadata rebuild (MANIFEST evidence entries + CHECKSUMS over actual contents) | PASS | 0 | — | memory/evidence/logs/RG-007_patch_package_metadata_rebuild__manifest.log |
| RG-008 | 2026-08-11T00:16:25Z | handoff | A_prime standalone package assembly (patch + manifest + evidence + secret scan) | PASS | 0 | — | memory/evidence/logs/RG-008_a_prime_standalone_package_assembly__pat.log |
| RG-009 | 2026-08-11T00:17:27Z | handoff | A_prime export finalization: package CHECKSUMS 7/7, DOWNLOADS.sha256 22/22, handoff MANIFEST.sha256 67/67, archives sha256 recorded | FAIL | 1 | — | memory/evidence/logs/RG-009_a_prime_export_finalization__package_che.log |
| RG-010 | 2026-08-11T00:17:28Z | verification | post-export read-only remote re-check: main unchanged, 20 conflict branches, zero remote writes this session | PASS | 0 | — | memory/evidence/logs/RG-010_post_export_read_only_remote_re_check__m.log |
| RG-011 | 2026-08-11T00:18:01Z | verification | supersedes RG-009: FAIL was ledger-copy staleness from manifest-before-ledger-close ordering, not corruption; A_prime package re-verified 7/7 + archives present; manifests regenerate AFTER this final ledger record | PASS | 0 | — | memory/evidence/logs/RG-011_supersedes_rg_009__fail_was_ledger_copy_.log |

Classification key: PASS = captured and reproducible · FAIL = captured with diagnosis · BLOCKED = external prerequisite missing · UNRECORDED = output lost, must rerun · NOT_RUN = deliberately not executed.

No tokens, passwords, database URLs, private keys, or secrets are recorded; commands are redacted before persistence.
