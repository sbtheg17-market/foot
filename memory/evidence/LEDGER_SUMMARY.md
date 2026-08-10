# Evidence Ledger — Human Summary
Generated 2026-08-10T22:54:45Z from LEDGER.jsonl (append-only; 38 records).

Status totals: BLOCKED=5, FAIL=2, PASS=31

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

Classification key: PASS = captured and reproducible · FAIL = captured with diagnosis · BLOCKED = external prerequisite missing · UNRECORDED = output lost, must rerun · NOT_RUN = deliberately not executed.

No tokens, passwords, database URLs, private keys, or secrets are recorded; commands are redacted before persistence.
