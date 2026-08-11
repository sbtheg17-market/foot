# APPLICATION GUIDE — A′ Session 063 traceability (first publication candidate)

Package: A_prime standalone transport package
Repository: sbtheg17-market/foot
Target ref: refs/heads/main
Declared base: 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
Candidate commit: f4a5dfeca5af222aeb9dcb1a6da822415397f902 (tree 63dcfbe3080dae65a478c55d8e4bdbebb1832838)
Patch SHA-256: dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9
Scope: exactly two files — .agents/LOG.md, .agents/NEXT_TASK.md (docs-only)

APPROVAL STATUS: BLOCKED. Publication is NOT authorized until all four evidence
blockers are resolved (branch-protection export; audit coverage 16:35Z-23:41:50Z
with newest-snapshot attribution; explicit A′ approval; new bounded
repository-scoped write credential). This package is delivered so review and
preparation need not repeat prior work. Do NOT push on receipt.

## Required procedure (Replit) — every step mandatory, in order

1. **Verify all package checksums.**
   `sha256sum -c CHECKSUMS.sha256`
   Every line must be OK. Stop on any mismatch or missing file.

2. **Verify the declared base commit.**
   `git fetch origin && git rev-parse origin/main`
   It must print exactly `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a`.

3. **Stop if the base differs or has advanced.**
   If origin/main is anything other than 3e76114…, STOP. Do not rebase, do not
   force-apply. Report back; A′ must be re-derived on the new tip by the
   Emergent workspace.

4. **Apply the patch without silently resolving conflicts.**
   On a clean branch at 3e76114:
   `GIT_COMMITTER_NAME="E2 Agent (Emergent)" GIT_COMMITTER_EMAIL="github@emergent.sh" GIT_COMMITTER_DATE="Mon, 10 Aug 2026 20:30:57 +0000" git am A-prime-session063-traceability.patch`
   Any conflict = STOP and report. Expected result: HEAD equals
   f4a5dfeca5af222aeb9dcb1a6da822415397f902 byte-identically
   (`git rev-parse HEAD` and `git rev-parse HEAD^{tree}` must match the
   declared commit and tree).

5. **Run the declared validation commands.**
   `bash scripts/verify-publication.sh --expected-tree 63dcfbe3080dae65a478c55d8e4bdbebb1832838 --patch A-prime-session063-traceability.patch --sha256 dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9 --base origin/main`
   All 12 checks must PASS. No unit tests are declared (docs-only candidate);
   the gate covers integrity.

6. **Review the exact diff.**
   `git show --stat HEAD && git show HEAD`
   Confirm: exactly .agents/LOG.md and .agents/NEXT_TASK.md changed,
   +60/−1 lines, no other paths, no binary content.

7. **Obtain the required publication approval.**
   Explicit, per-candidate, recorded approval for A′ specifically, plus
   confirmation that all four evidence blockers are resolved. Emergent commit
   metadata and anonymous repo visibility do NOT substitute.

8. **Push only the approved candidate.**
   Fast-forward only, exactly one commit:
   `git push origin HEAD:main`
   Never include any other candidate, branch, or file in the same push.
   Never force-push. Never delete or rename any conflict_* branch.

9. **Return the exact remote SHA and verification evidence.**
   Report back: `git ls-remote origin refs/heads/main` output (must be
   f4a5dfec…), the full gate output from step 5, the applied-diff review from
   step 6, and the approval record from step 7. The Emergent workspace will
   then perform an independent read-only verification (ls-remote + tree/scope
   re-check) and record it in the provenance ledger before the candidate is
   considered landed. The Replit push response alone is not trusted.

## After A′ lands
- C′ (lockfile reproducibility) must be RE-DERIVED on the new main tip — do not
  apply the old C′ patch.
- B′ (provider sign-out) is re-derived after C′ and additionally requires
  browser verification plus a real reviewed `--approve-web-ui` rationale.
- Phase 4C prep and Rule 12 remain separate candidates with their own approvals.
