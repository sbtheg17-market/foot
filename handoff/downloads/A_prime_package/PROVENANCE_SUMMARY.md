# PROVENANCE SUMMARY — A′ Session 063 traceability package

Generated: 2026-08-11 (new-account continuation workspace, Emergent pod)
Route stage: Emergent local build → user download (stages 3–6 pending)

## Chain of custody
1. **Origin**: A′ commit `f4a5dfeca5af222aeb9dcb1a6da822415397f902` was created in the
   2026-08-10 workspace on branch `candidate/A-prime-session063`, parented directly on
   canonical main `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (tree
   `63dcfbe3080dae65a478c55d8e4bdbebb1832838`). It has never been pushed: verified absent
   from every remote ref by object-absence check in a full clone (ledger NA-001/NA-004 context).
2. **Durability**: the commit survives in the transport bundle
   `local-branches-2026-08-10.bundle` (bundle verify OK; restore-tested to exact tips), which
   reached the remote inside snapshot branch `conflict_100826_1941` (read-only inventory).
3. **Patch identity**: `git format-patch -1 --binary --stdout f4a5dfec…` re-executed
   2026-08-11 in this workspace; output byte-identical to the packaged patch,
   SHA-256 `dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9`.
4. **Validation evidence**:
   - AC-001 (2026-08-10, original PASS ledger record; raw log lost pod-local).
   - RG-001 (2026-08-11, regenerated): transport validation 6/6 PASS — patch sha256,
     clean apply on 3e76114, byte-identical tree, exact 2-file scope, pnpm-lock untouched,
     commit-identity reproduction.
   - RG-006 (2026-08-11, regenerated): `scripts/verify-publication.sh` 12/12 PASS
     (git-only gate against a local mirror origin; zero remote contact beyond read-only clone).
5. **Ledger**: all records in `/app/memory/evidence/LEDGER.jsonl` (append-only,
   redacted, checksummed); package carries an extract
   (`evidence/LEDGER_EXTRACT_A_prime.jsonl`).
6. **Secret scan**: CLEAN (11 pattern families; result frozen into MANIFEST.json).

## Honest limitations
- The original AC-001 and gate_A raw logs were pod-local only and were lost when the
  prior pod recycled; the PASS classifications remain in the append-only ledger, and both
  validations were freshly re-executed (RG-001, RG-006) rather than asserted from memory.
- No candidate commit exists on any remote ref; nothing in this package has been pushed.
- Publication remains BLOCKED on the four evidence items; this export is preparation only.

## Remote-state effect of this package's creation
NONE. main verified at `3e76114…` before and after every operation. Zero pushes,
zero ref changes, zero remote writes.
