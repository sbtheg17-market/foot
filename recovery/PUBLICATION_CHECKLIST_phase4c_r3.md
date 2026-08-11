# PUBLICATION-READINESS CHECKLIST — phase4c-nonschema-prep-r3
# Candidate: d9195dfab83a211dd2d79e7836348693a9748bc8 (parent d2ad54cd, tree 2b1a3f7d)
# Status at checklist creation: LOCAL-ONLY / UNPUBLISHED — NO publication window,
# NO credential exists. This checklist STOPS before both.

Every item must be checked in order, in the managed publication environment,
immediately before any window. Items 1-8 are pre-verified locally (evidence cited);
they MUST be re-verified fresh in the managed environment. Items 9-15 can only be
satisfied inside an approved window and are NOT satisfied today.

## A. Re-verify base and candidate (managed environment, fresh)
 1. [ ] Fresh main verification — `git fetch origin --prune` from the real remote;
        origin/main must still equal d2ad54cd8e450fcc3bf8fab28aed257d67e73b42.
        If main moved: STOP — the candidate must be re-derived onto the new tip.
 2. [ ] Candidate identity — commit d9195dfa..., parent == origin/main (d2ad54cd),
        tree == 2b1a3f7d7141b3afdfc8e016fbf6083dd47b8a93; patch file re-checksums to
        the value in the package CHECKSUMS.sha256. (Local pre-check: ledger AC-001/AC-007.)
 3. [ ] Package + manifest checksum verification — `sha256sum -c CHECKSUMS.sha256`
        inside the package = all OK; archive sha256
        2a981539f79ca4448d4fdea39d80dd7b4e36c0ba0b1cb7af2a52a14aceb5e803.
 4. [ ] Contract tests — `pnpm run test:comfort-contract` = 38/38 PASS, 0 fail/skip.
        (Local pre-check: ledger AC-004.)
 5. [ ] Typecheck + web build — workspace typecheck PASS; artifacts/web production
        build PASS. (Local pre-check: P4R3 evidence logs.)
 6. [ ] Lockfile unchanged — `git diff origin/main..HEAD -- pnpm-lock.yaml` is empty;
        frozen install succeeds.
 7. [ ] Exact changed-file scope — `git diff --name-only origin/main..HEAD` equals
        EXACTLY the 9 files in MANIFEST.json scope; nothing more, nothing less.
 8. [ ] Secret scan — value-oriented pattern scan of the patch is clean.
        (Local pre-check: pattern-file scan, ledger method AC-005.)

## B. Human authorization (cannot be self-granted)
 9. [ ] Real reviewed --approve-web-ui rationale — this candidate intentionally adds
        two UNWIRED files under artifacts/web/**; the gate requires
        --approve-web-ui "<approver>: <reason>" from a named human reviewer who has
        actually reviewed the two shell files. A placeholder or self-approval is void.
10. [ ] Named publication approval — explicit written approval naming THIS commit
        (d9195dfa...) from the repository owner, recorded in the ledger as type
        publication / approval_required=true.

## C. Window mechanics (only after A and B are all checked)
11. [ ] New bounded repository-scoped credential — freshly minted for this window,
        repo-scoped (never account-wide), least-privilege push to main only.
        Runtime-injected; never printed, logged, or persisted.
12. [ ] One candidate per window — this window publishes ONLY d9195dfa...;
        Rule 12 r3 (fc6251a4...) is a SEPARATE candidate and MUST NOT ride along.
13. [ ] Gate run inside the window — scripts/verify-publication.sh with
        --allow for the 9 scoped files, --expected-tree 2b1a3f7d...,
        --patch + --sha256, --approve-web-ui "<approver>: <reason>" = RESULT: PASS.
14. [ ] Post-push verification — remote main SHA == the new commit; remote tree ==
        2b1a3f7d...; `git diff --name-only d2ad54cd..origin/main` equals the exact
        9-file scope; fast-forward confirmed (d2ad54cd is an ancestor).
15. [ ] Branch preservation + credential revocation — all 22 conflict_* branches
        still present with unchanged SHAs (compare against the verified snapshot
        foot-all-refs.txt); the bounded credential is revoked immediately after
        verification and its revocation is recorded in the ledger.

## STOP LINE
Nothing below item 8 is authorized as of 2026-08-11. No window is open, no
credential exists, no approval has been given. Items 9-15 remain UNSATISFIED
by design until the owner explicitly opens a publication window.
