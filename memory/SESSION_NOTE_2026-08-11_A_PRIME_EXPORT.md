# Session note — 2026-08-11: transport route adopted, A′ export built

## What exists now (all local; ZERO remote writes; main verified 3e76114 before/after — RG-010)
- **A′ standalone downloadable package**: `/app/handoff/downloads/A_prime_package/`
  plus archives `A_prime_package.tar.gz`
  (sha256 5b7c244e015c3a014e90d0efdd70e7cc5cb56dda08a0535f1971efc4901d108c) and
  `A_prime_package.zip`
  (sha256 73ec9d99ec13ac8b98678c74970baf368fc525f80cb0028ef7e23b655e4f1d91).
  Contents: patch (sha256 dbb5abd6…, byte-identity re-verified via
  `git format-patch -1 --binary --stdout`), candidate MANIFEST.json (all transport
  fields incl. secret-scan CLEAN, expected remote effect, BLOCKED approval status),
  APPLICATION_GUIDE.md (the 9 mandatory Replit steps), PROVENANCE_SUMMARY.md,
  evidence (RG-001 6/6, RG-006 gate 12/12, ledger extract), CHECKSUMS.sha256 (7/7).
- **Evidence regeneration**: RG-001..RG-006 re-ran all 5 transport validations
  (6/6 PASS each) + A′ publish:gate (12/12 PASS) because original AC-00x logs were
  pod-local only. Heavier logs (C′ battery/frozen install, B′ typecheck/webbuild,
  4C typecheck/contract raw logs, rule12 gate) NOT regenerated here (no PostgreSQL;
  out of authorized scope) — original PASS classifications stand in the ledger only;
  MANIFEST.json now lists them under lost_original_artifacts.
- **patch_package rebuilt**: MANIFEST.json (metadata_rebuilt_utc, evidence_regeneration,
  20-branch baseline) + CHECKSUMS.sha256 over actual 18 files (18/18 OK).
- **Persistent validation infra** (survives pod restarts): `/app/repo_audit/foot-mirror`
  (read-only mirror), `/app/repo_audit/validate_worktree` (origin → local mirror),
  `/app/repo_audit/rebuild_package_metadata.py`, `/app/repo_audit/assemble_a_prime_package.py`.
  /tmp scratch clones are ephemeral — do not rely on them.
- **Ledger**: 70 records through RG-011. RG-009 is a recorded FAIL superseded by RG-011
  (cause: manifests computed before ledger close; ordering rule below).

## Ordering rule learned (RG-009 → RG-011)
Always: final capture record → sync ledger copies → regenerate DOWNLOADS.sha256 →
regenerate MANIFEST.sha256 → silent verify (no further ledger appends).

## Still blocked (unchanged, all four required before ANY push)
1. branch-protection export; 2. audit 16:35Z→23:41:50Z incl. newest snapshot attribution;
3. explicit per-candidate approval; 4. bounded repo-scoped write credential.

## Next
- User downloads A′ package → Replit review (guide steps 1–7 possible pre-approval).
- After A′ lands: re-derive C′ on new tip; then B′ (browser verify + real
  --approve-web-ui rationale). 4C prep + Rule 12 stay separate.
- Approved local work remaining: Phase 4C OpenAPI draft/fixtures/UI-shell prep via capture.py.
