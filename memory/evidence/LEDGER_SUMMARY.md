# Evidence Ledger — Human Summary
Generated 2026-08-11T01:31:28Z from LEDGER.jsonl (append-only; 96 records).

Status totals: BLOCKED=7, FAIL=6, NOT_RUN=1, PASS=82

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
| PB-001 | 2026-08-11T00:30:37Z | verification | A_prime publication verified read-only: local candidate f4a5dfec -> published 0938c440 (committer sbtheg17-market 2026-08-11T00:27:32Z); commit objects NOT byte-identical; published TREE 63dcfbe3 and 2-file patch scope MATCH; fast-forward 1 commit from 3e76114; 20 conflict branches intact | PASS | 0 | — | memory/evidence/logs/PB-001_a_prime_publication_verified_read_only__.log |
| PB-002 | 2026-08-11T00:30:47Z | publication | bounded write credential revocation for A_prime window | BLOCKED | — | — | — |
| CD-001 | 2026-08-11T00:31:26Z | reconstruction | C_prime re-derived on new tip: old 2c6d0248 (base 3e76114) -> new f905a1518803342a4e3bc5c20a92660443fd005b (parent 0938c440, tree bc28a5c1571af56c25394ac907e440d928a780dc); scope .agents/SETUP.md + package.json; patch exported | PASS | 0 | — | memory/evidence/logs/CD-001_c_prime_re_derived_on_new_tip__old_2c6d0.log |
| CD-002 | 2026-08-11T00:32:28Z | test | C_prime r2 frozen install: pnpm install --frozen-lockfile with pinned pnpm@10.18.3 on tree bc28a5c1 (the fix under test) | PASS | 0 | — | memory/evidence/logs/CD-002_c_prime_r2_frozen_install__pnpm_install_.log |
| CD-003 | 2026-08-11T00:32:45Z | test | C_prime r2 lockfile diff: pnpm-lock.yaml byte-identical after frozen install (git diff empty) | PASS | 0 | — | memory/evidence/logs/CD-003_c_prime_r2_lockfile_diff__pnpm_lock_yaml.log |
| CD-004 | 2026-08-11T00:33:49Z | test | C_prime r2 full battery: all 17 api-server suites on tree bc28a5c1, postgres 15.18 local | FAIL | 1 | 65/102 | memory/evidence/logs/CD-004_c_prime_r2_full_battery__all_17_api_serv.log |
| CD-005 | 2026-08-11T00:38:30Z | test | supersedes CD-004 (env bootstrap missing, not code failure): C_prime r2 full battery with build+seed+server on :8899, postgres 15.18 | PASS | 0 | 229/229 | memory/evidence/logs/CD-005_supersedes_cd_004__env_bootstrap_missing.log |
| CD-006 | 2026-08-11T00:40:31Z | gate | C_prime r2 publication gate: verify-publication.sh on candidate f905a151 vs origin/main 0938c440 (local mirror origin) | PASS | 0 | — | memory/evidence/logs/CD-006_c_prime_r2_publication_gate__verify_publ.log |
| CD-007 | 2026-08-11T00:41:29Z | handoff | C_prime r2 package assembly (patch + manifest + evidence + secret scan) | PASS | 0 | — | memory/evidence/logs/CD-007_c_prime_r2_package_assembly__patch___man.log |
| CD-008 | 2026-08-11T00:42:33Z | handoff | C_prime r2 export finalized + session close: package checksums self-verified; archives created; STOPPED for separate C_prime approval; manifests regenerate after this record | PASS | 0 | — | memory/evidence/logs/CD-008_c_prime_r2_export_finalized___session_cl.log |
| CP-001 | 2026-08-11T00:58:26Z | verification | C_prime pre-push step 1: transport package checksums re-verified (9/9) + secret scan re-run clean | PASS | 0 | — | memory/evidence/logs/CP-001_c_prime_pre_push_step_1__transport_packa.log |
| CP-002 | 2026-08-11T00:58:26Z | verification | C_prime pre-push step 2: live main equals required base 0938c440 (fresh ls-remote); 20 conflict branches; no unexpected refs | PASS | 0 | — | memory/evidence/logs/CP-002_c_prime_pre_push_step_2__live_main_equal.log |
| CP-003 | 2026-08-11T00:58:42Z | verification | C_prime pre-push step 3: candidate parent==0938c440, tree==bc28a5c1, patch sha256==ea3eb8ed, scope exactly package.json+.agents/SETUP.md, pnpm-lock.yaml NOT in scope | PASS | 0 | — | memory/evidence/logs/CP-003_c_prime_pre_push_step_3__candidate_paren.log |
| CP-004 | 2026-08-11T00:58:42Z | gate | C_prime pre-push step 4: publication gate re-run fresh (12/12) + ledger search confirms 17-suite battery evidence CD-005 (229/229) already captured (no rerun needed) | FAIL | 1 | — | memory/evidence/logs/CP-004_c_prime_pre_push_step_4__publication_gat.log |
| CP-005 | 2026-08-11T00:59:00Z | gate | supersedes CP-004: FAIL was a grep spacing mismatch in the ledger-search step, not a gate failure (gate printed 12/12 RESULT PASS inside CP-004 log); re-run: gate 12/12 PASS + ledger confirms CD-005 battery 229/229 captured | PASS | 0 | — | memory/evidence/logs/CP-005_supersedes_cp_004__fail_was_a_grep_spaci.log |
| CP-006 | 2026-08-11T01:03:16Z | verification | independent testing-agent verification of C_prime pre-push state: 8/8 checks PASS 100% zero findings (report /app/test_reports/iteration_1.json) - package 9/9, archives, patch sha, anatomy, live remote 0938c440 + 21 heads, clean apply reproduces tree, ledger consistent, secrets clean | PASS | 0 | — | memory/evidence/logs/CP-006_independent_testing_agent_verification_o.log |
| CP-007 | 2026-08-11T01:03:16Z | publication | C_prime publication window: push execution | BLOCKED | — | — | — |
| TO-001 | 2026-08-11T01:27:48Z | inspection | takeover fetch: live remote inventory (22 heads: main + 21 conflict_*) | PASS | 0 | — | memory/evidence/logs/TO-001_takeover_fetch__live_remote_inventory__2.log |
| TO-002 | 2026-08-11T01:27:59Z | verification | A-prime + C-prime publication verification: ancestry 3e76114->0938c440->e2406942, C-prime scope 2 files, tree bc28a5c1 matches ledger CD-001, lockfile blob 8a5e0392 byte-identical across C-prime | PASS | 0 | — | memory/evidence/logs/TO-002_a_prime___c_prime_publication_verificati.log |
| TO-003 | 2026-08-11T01:28:12Z | inspection | 21st conflict branch classification: conflict_100826_2113 tip b9d27229 scope .emergent/emergent.yml only; platform auto-snapshot of prior takeover pod; lineage carries durable handoff package; other 20 tips match STATE_MATRIX_v4 inventory exactly | PASS | 0 | — | memory/evidence/logs/TO-003_21st_conflict_branch_classification__con.log |
| TO-004 | 2026-08-11T01:28:12Z | verification | handoff package restored read-only from b9d27229 lineage: MANIFEST.sha256 64/64 present files verify OK; 33 entries absent (known pod-local AC/RG/CD evidence logs + tar.gz/zip archives - recorded durability gap, not corruption); C-prime-r2 patch checksum ea3eb8ed verified in both copies | PASS | 0 | — | memory/evidence/logs/TO-004_handoff_package_restored_read_only_from_.log |
| TO-005 | 2026-08-11T01:28:26Z | verification | candidate bundle verify + restore test: 5 refs exact tips incl. old B-prime e6380bf7 (absent from remote, recovered locally); bundle complete history OK | PASS | 0 | — | memory/evidence/logs/TO-005_candidate_bundle_verify___restore_test__.log |
| TO-006 | 2026-08-11T01:28:26Z | verification | B-prime status: old patch (base 3e76114, one file provider-layout.tsx) apply-checks cleanly onto published tip e2406942; re-derivation onto e2406942 NOT yet performed; browser verification remains NOT_RUN (AC-006); real --approve-web-ui rationale still DRAFT-only | PASS | 0 | — | memory/evidence/logs/TO-006_b_prime_status__old_patch__base_3e76114_.log |
| TO-007 | 2026-08-11T01:28:48Z | verification | ledger continuity + duplicate-guard search: 87 prior records restored intact; full 17-suite battery CD-005 (229/229 PASS) captured on tree bc28a5c1 which IS the current main tree - no battery rerun required; Gate B remains BLOCKED (no runtime DATABASE_URL in this pod); no GitHub write credential present | FAIL | 1 | — | memory/evidence/logs/TO-007_ledger_continuity___duplicate_guard_sear.log |
| TO-008 | 2026-08-11T01:29:50Z | verification | supersedes TO-007: FAIL was the same grep spacing mismatch class as CP-004 (ledger JSON has no space after colon), not a continuity failure; re-run confirms 93 ledger records (87 restored + TO-001..006), CD-005 battery 229/229 present once, DATABASE_URL absent, remote anonymous (no credential) | PASS | 0 | — | memory/evidence/logs/TO-008_supersedes_to_007__fail_was_the_same_gre.log |
| TO-009 | 2026-08-11T01:31:28Z | handoff | state matrix v5 written (first-response report; local-only; zero remote writes this session); ledger summary regenerated | PASS | 0 | — | memory/evidence/logs/TO-009_state_matrix_v5_written__first_response_.log |

Classification key: PASS = captured and reproducible · FAIL = captured with diagnosis · BLOCKED = external prerequisite missing · UNRECORDED = output lost, must rerun · NOT_RUN = deliberately not executed.

No tokens, passwords, database URLs, private keys, or secrets are recorded; commands are redacted before persistence.
