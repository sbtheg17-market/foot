# PROVENANCE SUMMARY — C′ r2 lockfile reproducibility package

Generated: 2026-08-11 (new-account continuation workspace, Emergent pod)
Route stage: Emergent local build → user download (stages 3–6 pending)

## Chain of custody
1. **Defect origin**: frozen-install reproducibility failure (pnpm-workspace.yaml uses
   settings read only since pnpm 10.5; stale `packageManager: pnpm@9.15.0` pin made
   `pnpm install --frozen-lockfile` fail with a lockfile-config mismatch). First recorded
   2026-08-10; original candidate 2c6d0248… based on then-main 3e76114.
2. **Identity retirement**: A′ landed as published commit 0938c440… (verified read-only,
   ledger PB-001: published tree 63dcfbe3… and 2-file scope MATCH the candidate; commit
   objects intentionally NOT claimed byte-identical — committer differs). Old C′ identity
   2c6d0248 is retired and must never be applied.
3. **Re-derivation (CD-001)**: same 2-file content applied via `git am` onto 0938c440 in a
   clean local worktree → new commit f905a1518803342a4e3bc5c20a92660443fd005b
   (tree bc28a5c1…). Author identity/date preserved from the reviewed original; fresh
   committer timestamp 2026-08-11T00:31:07Z. Patch regenerated with
   `git format-patch -1 --binary --stdout`, SHA-256 ea3eb8ed….
4. **Validation evidence (all fresh, on the r2 identity, via capture.py)**:
   - CD-002 frozen install with pinned pnpm@10.18.3: exit 0, 20.6s (defect fixed).
   - CD-003 lockfile diff: pnpm-lock.yaml byte-identical (git diff empty).
   - CD-004 battery attempt: FAIL — environment bootstrap missing (no seeded server);
     kept on record, superseded by CD-005. Honest failure, not hidden.
   - CD-005 full battery: build + seed + server on :8899 + postgres 15.18 →
     **229/229 PASS, 0 fail, 17/17 suites green**, 144.4s.
   - CD-006 publication gate: 12/12 PASS against origin/main = 0938c440 (local mirror).
5. **Ledger**: append-only, redacted; extract shipped in evidence/.
6. **Secret scan**: CLEAN. The only credential-shaped string anywhere is the local
   throwaway test-DB URL (foot:foot@127.0.0.1) inside captured battery logs — documented
   and allowlisted; it exists only inside this disposable container.

## Honest limitations
- Battery count is 229 (current suite total), not the historical 205 — suites grew;
  both counts are real, no tests were skipped.
- The r2 commit exists ONLY in the local derive worktree and this package; it is on no
  remote ref and has not been pushed.
- Publication remains BLOCKED pending explicit C′ approval + new bounded credential.

## Remote-state effect of this package's creation
NONE. Zero pushes, zero ref changes. main verified 0938c440 read-only; all 20
conflict_* branches untouched.
