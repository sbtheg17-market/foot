# PROVENANCE SUMMARY — Transport-Only Patch Package — 2026-08-10

Baseline: main = 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a (verified live before and
after all work). 19 conflict_* branches preserved as evidence. Remote writes: ZERO.

## Candidate table
| # | Candidate | Commit (full) | Parent | Tree | Patch SHA-256 | Scope | Validation | Gate | Approval status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | A′ Session 063 traceability | f4a5dfeca5af222aeb9dcb1a6da822415397f902 | 3e76114 | 63dcfbe3080dae65a478c55d8e4bdbebb1832838 | dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9 | .agents/LOG.md + .agents/NEXT_TASK.md | AC-001: 6/6 (incl. byte-identical commit reproduction) | 12/12 PASS | INTENDED FIRST — BLOCKED on evidence exports + approval + credential |
| 2 | C′ lockfile reproducibility | 2c6d0248569b9c3f99213a19a40eaade81e69a4a | 3e76114 | 093a2c22856ba93e31a002e79486bdb9751fbdd4 | 1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31 | package.json + .agents/SETUP.md (pnpm-lock.yaml byte-identical) | AC-002: 6/6 | PASS | BLOCKED — re-derive on new tip after A′ |
| 3 | B′ provider sign-out | e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae | 3e76114 | c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321 | dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093 | exactly artifacts/web/src/components/layout/provider-layout.tsx | AC-003: 6/6; browser verification NOT_RUN here (AC-006) | PASS (DRAFT rationale — not an approval) | BLOCKED — re-derive after A′+C′; real --approve-web-ui rationale required |
| — | Phase 4C non-schema prep | 2dc23539b21eb688526fe438b7fb9eaac0cc324b | 3e76114 | 56d34d2b5062bcb770008c1d62c109563b45dd53 | 528b9bac839473859a0c91ac874bfc3c6346a959023d65f147a6ce317530ad1d | 9 files: OpenAPI draft (x-status: draft), dependency-free contract module, fixtures, contract tests, UNWIRED shells, docs | AC-004: 6/6; contract tests 38/38 fresh (AC-007) | typecheck EXIT=0 (not queued for publication) | SEPARATE candidate — own review; demo-wiring commit 7009ce66 intentionally EXCLUDED |
| — | Rule 12 provenance docs | b85f71f32202c293c1d7c240ec4af151b22c2c41 | 3e76114 | a4091ce232f5521a7407a95f4eb63a902d6ab582 | fca9c42183636ffa9d3d02057f998a31cead3ed37b838a058f1cdadce4a3b120 | exactly .agents/AGENT-RULES.md (+32) | AC-005: 6/6 | PASS (--allow .agents/AGENT-RULES.md) | SEPARATE candidate — do NOT merge into A′ |

All five patches: applicable cleanly to 3e76114 = YES · application reproduces the
expected tree = YES · remote-state effect = NONE.

## Evidence chain
- Every validation ran through capture.py (auto-classified, redacted, checksummed):
  ledger records AC-001..AC-007 in /app/memory/evidence/LEDGER.jsonl (copy in
  ../evidence/). Ledger integrity: `record_action.py verify` = PASS.
- C′ test evidence: frozen install PASS + battery 13/13 suites, 205/0 (node
  v20.20.2 / pnpm 10.18.3; prior session numbers reproduced exactly).
- B′: typecheck+build EXIT=0; browser verification honestly NOT_RUN in this
  workspace (deferred to publication window).
- Phase 4C: contract tests 38/38 (fresh capture), workspace typecheck EXIT=0;
  contains no schema/migrations/storage/codegen/production events/economics.
- No secrets recorded anywhere; package secret-scanned after assembly.

## Standing blockers (unchanged, external)
1. Detailed main branch-protection export.  2. Audit export 16:35Z→≥21:40Z with
owner attribution of conflict_100826_1415/_1543/_1738.  3. Per-candidate
approvals + one bounded write credential per window.  4. Managed Gate B before
any Phase 4C schema step.  5. Pinned Gate A script before any branch cleanup.
