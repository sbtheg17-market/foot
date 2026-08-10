# 8. Exact next actions, in priority order

Every step is read-only or local-only unless it names a specific approval. Nothing here authorizes a push.

1. **Recover or declare lost the two candidate artifacts** (`eec0147` Session 063 traceability; `0c216d6` provider sign-out) from the previous account's workspace/artifact store: patch files, FULL 64-hex SHA-256 values, trees, changed-file lists, gate/test outputs.
   - If recovered → verify `git apply --check` against a clean `3e76114` worktree, recompute patch SHA-256, confirm parent/tree; fill the `REQUIRED-FROM-RECOVERY` fields in `06_candidate_inventory.md` and the drafts.
   - If lost → re-derive from `3e76114` as NEW candidates (new identities; ledger must record the re-derivation explicitly; no byte-identity claims).
2. **Owner: export detailed `main` branch protection** (authenticated read; see `05_missing_evidence.md` §5.1). Store the export + checksum with this packet.
3. **Owner: export the audit log for 2026-08-10 16:35Z → present** (§5.2), explicitly attributing the two post-handoff branches `conflict_100826_1415` (18:15:29Z) and `conflict_100826_1543` (19:44:06Z).
4. **Re-run the read-only conflict-branch inventory at 18 branches** and record it in the next traceability entry (supersedes the stale 12-branch Session 062 pass and the stale 9-name cleanup list). No cleanup action.
5. **Gate B managed verification** (owner-scheduled, managed environment, runtime-injected `DATABASE_URL`, read-only catalog check). Record pass/fail in the ledger. Gate B remains failed-closed until this happens.
6. **Review publication Draft A** (`09_publication_drafts/DRAFT_A_session063_traceability.md`) once its fields are filled from recovery → obtain the specific approval → execute per the publication procedure (fresh bounded repo-scoped write credential; push exactly one approved candidate; independent post-push verification of SHA/tree/ancestry/scope; revoke credential immediately).
7. **Re-derive and review Draft B on the new tip** (it cannot fast-forward once A lands) → separate approval → separate bounded publication window → revoke.
8. **Phase 4C non-schema preparation** (only after the contract document is recovered and checksum-verified against `1fa0eec…bb14`): OpenAPI draft, UI shells, fixtures, contract tests, non-persistent boundary prep — as its own local candidate(s), one at a time.
9. **Provider economics**: contract review only (checksum `5a7a202…2bcc`); zero implementation until Phase 4C sequencing and Gate B pass.
10. Small UX fixes / E2E hardening: separate proposed local candidates, one reviewed commit at a time; economics UI shells excluded.
11. Toolchain hygiene (separate proposed candidate, needs its own approval): resolve the frozen-lockfile mismatch (`04_environment_and_baseline_tests.md`) so `pnpm install --frozen-lockfile` passes at the canonical tip — either regenerate the lockfile with the pinned pnpm or re-pin `packageManager` to the pnpm major actually used. Do NOT bundle with any other candidate.

**Never** (restated): schema/migrations/storage wiring, production event writes, economics implementation, marketplace expansion, conflict cleanup, remote ledger edits, any push/merge, any credential transfer.
