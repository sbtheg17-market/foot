# Publication Draft A — Session 063 traceability (`eec0147`)

**SUPERSEDED 2026-08-10 by `DRAFT_A_prime_session063.md`. The identity `eec0147…` is retired (artifact recovered as evidence). Do not execute this draft.**

**STATUS: PREPARED, NOT EXECUTED. NOT APPROVED. CONTINGENT ON ARTIFACT RECOVERY.**
This draft authorizes nothing. Execution requires: recovered artifact → re-verification → explicit human approval naming this draft → operator-approved publication window → fresh bounded write credential.

| Field | Value |
|---|---|
| Target repository | `sbtheg17-market/foot` |
| Target ref | `refs/heads/main` (fast-forward only, fixed refspec `<full-sha>:refs/heads/main`) |
| Commit | `eec0147` — FULL 40-hex REQUIRED-FROM-RECOVERY |
| Parent (must equal freshly fetched `origin/main` at push time) | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` |
| Tree | REQUIRED-FROM-RECOVERY |
| Patch SHA-256 | `290fa509…` — FULL 64-hex REQUIRED-FROM-RECOVERY; recompute from the artifact and require exact match |
| Changed files (expected) | `.agents/LOG.md`, `.agents/NEXT_TASK.md` ONLY — confirm from artifact; any other path fails the draft |
| Tests / gate | `pnpm run publish:gate` (scripts/verify-publication.sh) full PASS in an ephemeral worktree: parent identity, fast-forward-only, single non-merge commit, allow-list scope, forbidden paths, draft-status wording, unique+ordered session numbers (Session 063 exactly once), tree identity, patch checksum |
| Web-UI flag | NOT applicable (docs-only); if the artifact touches anything outside `.agents/`, ABORT this draft |

## Execution steps (for the approved operator only — NOT executed here)
1. Fresh clone; verify `origin/main` = `3e76114…` (if main moved, ABORT and re-draft).
2. Recover artifact; `git apply --check`; recompute patch SHA-256; verify full value matches the recovered record.
3. Recreate/verify commit; confirm commit SHA, parent, tree against this draft.
4. Run `publish:gate`; require full PASS; archive gate output with this packet.
5. Obtain the explicit approval naming Draft A and record the approved publication window.
6. Mint a **new bounded repository-scoped write credential** (deploy key or fine-grained token, `sbtheg17-market/foot` only, contents:write only, shortest lifetime; NEVER an audit/read credential; never stored in the repo or this packet).
7. Push exactly `<full-sha>:refs/heads/main` (fast-forward). One candidate only.
8. Independently verify post-push (anonymous HTTPS): remote SHA, tree, ancestry (`3e76114` is parent), changed-file scope.
9. **Revoke/delete the write credential immediately.** Verify it no longer authenticates.
10. Append the traceability record of this publication as the next local candidate (do not push it in the same window).

## Effect on Draft B
After A lands, `origin/main` ≠ `3e76114`; Draft B's candidate can no longer fast-forward and MUST be re-derived on the new tip as a new identity (new commit hash, new patch checksum, fresh gate run, fresh approval).
