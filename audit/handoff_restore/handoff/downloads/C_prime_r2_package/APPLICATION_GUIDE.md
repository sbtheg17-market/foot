# APPLICATION GUIDE — C′ r2 lockfile reproducibility (second publication candidate)

Package: C_prime_r2 standalone transport package
Repository: sbtheg17-market/foot
Target ref: refs/heads/main
Declared base: 0938c440c7defafed7fdbeaa3839616e231ec9f4 (the published A′ commit)
Candidate commit: f905a1518803342a4e3bc5c20a92660443fd005b (tree bc28a5c1571af56c25394ac907e440d928a780dc)
Patch SHA-256: ea3eb8ed962753db7b5d6846c9b90bd7d2b5da7cecc397f9be088e49da8d3456
Scope: exactly two files — .agents/SETUP.md, package.json (packageManager pin 9.15.0 → 10.18.3)

APPROVAL STATUS: BLOCKED — STOPPED for separate C′ publication approval.
Requires explicit C′-specific approval plus a NEW bounded repository-scoped write
credential for a NEW window. The A′ window credential must NOT be reused.
Supersedes retired candidate 2c6d0248… (based on old main 3e76114) — never apply the old patch.

## Required procedure (Replit) — every step mandatory, in order

1. **Verify all package checksums.**
   `sha256sum -c CHECKSUMS.sha256` — every line OK or STOP.

2. **Verify the declared base commit.**
   `git fetch origin && git rev-parse origin/main`
   Must print exactly `0938c440c7defafed7fdbeaa3839616e231ec9f4`.

3. **Stop if the base differs or has advanced.**
   Anything other than 0938c440… → STOP and report; C′ must be re-derived again
   by the Emergent workspace. Never rebase or force-apply.

4. **Apply the patch without silently resolving conflicts.**
   On a clean branch at 0938c440:
   `GIT_AUTHOR_NAME="E2 Agent (Emergent)" GIT_AUTHOR_EMAIL="github@emergent.sh" GIT_COMMITTER_NAME="E2 Agent (Emergent)" GIT_COMMITTER_EMAIL="github@emergent.sh" GIT_COMMITTER_DATE="2026-08-11T00:31:07+00:00" git am C-prime-r2-lockfile-reproducibility.patch`
   Any conflict = STOP. Expected: `git rev-parse HEAD` = f905a1518803342a4e3bc5c20a92660443fd005b
   and `git rev-parse HEAD^{tree}` = bc28a5c1571af56c25394ac907e440d928a780dc.

5. **Run the declared validation commands.**
   a. Frozen install (the defect under fix): `corepack prepare pnpm@10.18.3 --activate && pnpm install --frozen-lockfile` → must exit 0.
   b. Lockfile diff: `git diff --exit-code pnpm-lock.yaml` → must be empty.
   c. Battery (requires PostgreSQL + seeded local server, see MANIFEST runtime):
      all 17 `@workspace/api-server` test scripts → expected 229/229 PASS.
   d. Gate: `bash scripts/verify-publication.sh --allow .agents/SETUP.md --allow package.json --expected-tree bc28a5c1571af56c25394ac907e440d928a780dc --patch C-prime-r2-lockfile-reproducibility.patch --sha256 ea3eb8ed962753db7b5d6846c9b90bd7d2b5da7cecc397f9be088e49da8d3456 --base origin/main` → 12/12 PASS.

6. **Review the exact diff.**
   `git show --stat HEAD && git show HEAD` — exactly .agents/SETUP.md and package.json,
   +2/−2 lines, the only functional change being `"packageManager": "pnpm@10.18.3"`.

7. **Obtain the required publication approval.**
   Explicit, per-candidate, recorded C′ approval. Do not proceed on A′'s approval.

8. **Push only the approved candidate.**
   Fast-forward only, exactly one commit: `git push origin HEAD:main`.
   Never bundle B′, Phase 4C, or Rule 12. Never force-push. Never touch conflict_* branches.

9. **Return the exact remote SHA and verification evidence.**
   Report `git ls-remote origin refs/heads/main`, full gate output, diff review, and
   the approval record. Emergent will then perform independent read-only verification
   (tree + scope re-check) and record it before C′ is considered landed.

## After C′ lands
- B′ (provider sign-out) is re-derived on the post-C′ tip; requires browser
  verification plus a REAL reviewed `--approve-web-ui "<approver>: <reason>"` rationale
  (the packaged one is DRAFT-only and not valid for publication).
- Phase 4C prep and Rule 12 remain separate candidates with their own approvals.
