# ACCEPTANCE RECORD — Evidence Ceiling Declaration
# Repository: sbtheg17-market/foot
# Recorded: 2026-08-11 (read-only recovery session)
# Artifact class: ACCEPTANCE ARTIFACT (clearly labeled; not historical evidence)

## 1. Declaration

The recovered artifact set enumerated in `EVIDENCE_CEILING_VERIFIED.txt` is hereby
recorded as the EXPLICIT EVIDENCE CEILING for the handoff of this repository.

- 149/149 is NOT claimed. Verified: 90/149 entries of handoff-MANIFEST-149.sha256.
- 80/80 is NOT claimed. Verified: 64/80 entries of handoff-MANIFEST-80.sha256.
- 55 unique files (75 manifest entries) are NOT_FOUND in any preserved snapshot
  branch and are enumerated exhaustively in `MISSING_FILES_55.txt`.
- No historical evidence log has been regenerated, re-derived, approximated,
  or fabricated to fill any missing entry.
- No "complete" handoff bundle has been rebuilt from these incomplete inputs.

## 2. Verification basis (all read-only)

- Supply set: foot-all-refs.bundle + 11 companion files; every file checksum-verified
  against the owner's MANIFEST.sha256 (root of trust, self-hash
  2149fba012a749317b6b3561a8963a4d1366958f45da9269253f3b591d14b503).
- Bundle: SHA-256 bcaed3a2683902244f755819e0bcd4f62889a83b35e6e6fa81ada715ab706fc1;
  `git bundle verify` = okay / complete history; `git fsck --full` clean.
- Refs: 29 refs byte-identical to foot-all-refs.txt, bundle-heads.txt, and the
  owner's foot-bundle-verify.txt; origin/main = d2ad54cd8e450fcc3bf8fab28aed257d67e73b42;
  all 22 conflict_* snapshot refs present, including the four priority refs
  (conflict_100826_2113, _1941, _1738, _2258).
- Search: full commit history of all 22 conflict_* branches plus origin/main and
  local main — 311 commits, 305 unique trees, 2,294 blobs; every blob SHA-256-hashed
  and matched content-addressed against both handoff manifests.
- Identity criterion: byte-identical SHA-256 content match only.
- Zero CHECKSUM_MISMATCH entries remain (historical byte-identical copies located
  for the ledger files that mismatched at branch tips).

## 3. Candidate status (unchanged, blocked)

- Rule 12 r2 patch, Phase 4C r2 patch, B' r2 patch, and the reviewed web rationale
  are retained AS EVIDENCE ONLY.
- Their commit objects (9e0bbd451e9341729052db9c74d5e2ad526cf41b,
  396040ea3e6921eaee7555609269dae3dd201412, e5919bd4f0e94feb77d711d8f789ff5aa8755931)
  are confirmed ABSENT from every available object database.
- They are NOT publication-ready and MUST NOT be re-derived until the owner
  supplies the missing evidence or separately approves re-derivation.
- The nested candidate bundle (candidates/local-branches-2026-08-10.bundle,
  SHA-256 997608350901f1e5ad7c6a86dc4a3a68bf623c93074854d892fd0f7b94a8296f,
  recovered byte-identical) preserves the r1 candidate
  commits, each verified against the recovered package JSON (commit/parent/tree
  exact): A' f4a5dfec..., B' e6380bf7..., C' 2c6d0248..., rule12 b85f71f3...,
  phase4c_prep 2dc23539....

## 4. Missing-file import procedure (documented; NOT executed)

If the owner later supplies any of the 55 missing files:
1. Import into a NEW directory (acceptance/imports/<date>/); never overwrite any
   existing evidence or supply file.
2. Verify each file's SHA-256 against the expected hash in MISSING_FILES_55.txt.
   Reject and report any mismatch; do not rename or "fix" content to force a match.
3. Record source and provenance per file (who supplied it, from which machine or
   medium, when, and any chain-of-custody notes) in an import log alongside the files.
4. Rerun the full recovery matrix from scratch over supply + imports.
5. Rebuild the handoff bundle ONLY if every entry of both manifests verifies
   (149/149 and 80/80 byte-identical). Otherwise this evidence ceiling stands.

## 5. Standing constraints

- Continue new work only from canonical main d2ad54cd8e450fcc3bf8fab28aed257d67e73b42,
  with fresh review; no conflict_* branch may be used as a development base.
- Gate B: BLOCKED. Schema changes: BLOCKED. Migrations: BLOCKED. Storage wiring:
  BLOCKED. Economics: BLOCKED. Publication: BLOCKED. Each requires separate,
  explicit owner approval.
- No push, merge, reset, rebase, branch cleanup, remote ledger edit, or credential
  use occurred during recovery, and none is authorized by this record.

## 6. Attached acceptance artifacts (checksummed in ACCEPTANCE.sha256)

- ACCEPTANCE_RECORD.md            (this file)
- RECOVERY_MATRIX.md              (full per-file matrix, human-readable)
- recovery-matrix-full.json       (full per-file matrix, machine-readable)
- recovery-matrix.tsv             (flat matrix export)
- EVIDENCE_CEILING_VERIFIED.txt   (154 verified entries with source branch/path/blob/commit)
- MISSING_FILES_55.txt            (exact missing set, 55 unique files / 75 entries)
- RECOVERY_STATE.md               (session state log)
