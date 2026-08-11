# Publication Draft — C′ (lockfile reproducibility) — SECOND IN SEQUENCE
Prepared 2026-08-10 (new workspace). LOCAL ONLY — NOT PUSHED.

## Identity (reconstructed and verified byte-identical to the recorded candidate)
- commit  2c6d0248569b9c3f99213a19a40eaade81e69a4a
- parent  3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
- tree    093a2c22856ba93e31a002e79486bdb9751fbdd4
- patch   /app/repo_audit/handoff_extract/lockfile-repro-rederived.patch
- sha256  1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31
- scope   exactly package.json + .agents/SETUP.md; pnpm-lock.yaml byte-identical
- local branch: candidate/C-prime-lockfile

## Gate + test evidence (re-run in this workspace, node v20.20.2 / pnpm 10.18.3)
- pnpm install --frozen-lockfile: PASS, lockfile sha256 unchanged
  (c526b2bb… before == after; git status clean)
- Full battery on ephemeral scratch PostgreSQL 15 (runtime-injected DATABASE_URL,
  throwaway JWT_SECRET): 13/13 suites, 205 pass / 0 fail — EXACT ledger match
  (logs: /app/repo_audit/battery/*.log; meta: _meta.txt)
  NOTE: prior battery ran on node v24.4.1; this environment is v20.20.2 — results
  reproduced identically despite the runtime difference (engines allow >=20).
- publish:gate: PASS with --allow package.json --allow .agents/SETUP.md
  (log: /app/repo_audit/battery/gate_C.log)

## SEQUENCING RULE (mandatory)
All three candidates share parent 3e76114. C′ publishes SECOND: after A′ lands,
C′ MUST be re-derived onto the new main tip (f4a5dfec…). The rebase creates a NEW
candidate identity — record new commit/tree/patch/sha256, re-run frozen install +
battery + gate, and DO NOT reuse 2c6d0248 in the push.

## BLOCKED ON
A′ publication first; then re-derivation + fresh gate run; then the same four
evidence/approval/credential requirements as DRAFT_A_prime.md.
