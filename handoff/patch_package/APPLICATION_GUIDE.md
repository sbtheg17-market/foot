# APPLICATION GUIDE — Transport-Only Patch Package
sbtheg17-market/foot · baseline main = 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a · 2026-08-10

## Read this first — what this package IS and IS NOT
- These patches are **TRANSPORT ARTIFACTS ONLY**. They preserve reviewed local
  work for a future account/session. Creating this package changed **NOTHING**
  remotely: **no patch has been applied to the remote repository**, no branch
  was pushed, merged, deleted, or modified, no remote log was touched, no
  publication window was opened, and no bounded write credential exists.
- **A′, C′, B′, Phase 4C prep, and Rule 12 are FIVE SEPARATE candidates.**
  Never combine them into one application. In particular, **Rule 12 must NOT
  be merged into or published as part of A′** — that would change A′'s scope
  and commit identity.
- **No patch may be applied until its own individual publication approval
  exists**, together with the standing evidence prerequisites (detailed main
  branch-protection export; audit coverage 16:35Z→≥21:40Z incl. attribution of
  conflict_100826_1415/_1543/_1738) and a fresh bounded write credential for
  that window only.
- A transport bundle does **not** count as a remote repository change; only a
  later approved application, independently verified, does.

## Exact application order
1. **A′** (`patches/A-prime-session063-traceability.patch`) — first, and only
   after its individual approval + both evidence exports are recorded.
   While main == 3e76114 it applies as-is and `git am` with the recorded
   author+committer identity/date reproduces commit
   f4a5dfeca5af222aeb9dcb1a6da822415397f902 byte-identically.
2. **C′** — **only after A′ lands and is independently verified.** main will
   have moved, so C′ MUST be **re-derived on the new tip as a NEW candidate
   identity** (do not reuse 2c6d0248 in a push). Re-run: frozen install,
   pnpm-lock.yaml byte-identity check, the full 13-suite battery, and the
   publication gate, all captured through capture.py.
3. **B′** — last. Re-derive on the then-current tip (new identity), re-run
   typecheck/build, perform the deferred interactive **browser verification**,
   and obtain a **real reviewed `--approve-web-ui "<approver>: <reason>"`
   rationale** — the DRAFT rationale in evidence/B_prime/ is NOT an approval.
- **Phase 4C prep** and **Rule 12** stay separate with their own approvals and
  are re-derived on whatever tip exists when they are reviewed. They are NOT
  part of the traceability sequence.

## How to apply one approved patch (in the controlled publication channel)
    # 1. verify transport integrity
    sha256sum -c CHECKSUMS.sha256
    # 2. confirm the patch identity against MANIFEST.json
    sha256sum patches/<file>.patch
    # 3. fresh clone of the real repo; confirm base tip; run the repo's
    #    publication gate; only then, inside the approved window:
    git am <patch>   # (A' with recorded committer metadata to reproduce identity)
    bash scripts/verify-publication.sh <flags per MANIFEST>
    git push origin <commit>:main   # bounded credential; revoke after window

## Contents
- patches/ — one patch per candidate (5)
- evidence/<candidate>/ — gate logs, test logs, validation captures
- MANIFEST.json — machine-readable identities, scopes, checksums, status
- CHECKSUMS.sha256 — every file in this package
- PROVENANCE_SUMMARY.md — human summary of the evidence chain
- validate_patch.sh — rerunnable validation (needs the repo mirror/worktree)

## Security statement
This package contains no PATs, SSH keys, DATABASE_URL values, JWTs, passwords,
raw environment files, or private keys. All captured command output was
redacted before persistence and the package was secret-scanned after assembly.
