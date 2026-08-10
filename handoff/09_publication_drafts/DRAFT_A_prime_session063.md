# Publication Draft A′ — Session 063 traceability (re-derived)

**STATUS: PREPARED, NOT EXECUTED. PUBLICATION NOT APPROVED.**
Supersedes `DRAFT_A_session063_traceability.md` (which referenced the retired identity `eec0147…`; that identity is recorded as retired — recovered patch kept as evidence at `recovered_evidence/patches/session-063-traceability.patch`, SHA-256 `290fa509…e550dcbe`). No continuity or byte identity is claimed.

| Field | Value |
|---|---|
| Target repository | `sbtheg17-market/foot` |
| Target ref | `refs/heads/main` (fast-forward only, fixed refspec `<full-sha>:refs/heads/main`) |
| Commit | `f4a5dfeca5af222aeb9dcb1a6da822415397f902` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (verified = live `origin/main`) |
| Tree | `63dcfbe3080dae65a478c55d8e4bdbebb1832838` |
| Patch artifact | `new_candidates/session063-rederived.patch` |
| Patch SHA-256 | `dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9` |
| Changed files | exactly `.agents/LOG.md` (+34/−1) and `.agents/NEXT_TASK.md` (+27) — docs-only |
| Content summary | Session 063 ledger entry: takeover verification (baseline independently green), 18-branch inventory v5 (cleanup paused, 16-branch plan invalidated), evidence recovery with exact checksums (identities retired), lockfile defect recorded, Gate B unchanged UNVERIFIED |
| Tests / checks | `publish:gate` **12/12 PASS** (parent, fast-forward, single non-merge commit, allow-list scope, forbidden paths, wording, session numbering unique+ordered after 062, tree identity, patch checksum) |
| Web-UI flag | not applicable (no web files) |

## Sequencing constraint
A′, B′ (`e6380bf7…`) and C′ (`2c6d0248…`) are ALL parented on `3e76114`. Exactly ONE may publish as-is; the other two must be re-derived on the new tip as new identities with fresh gate runs and fresh drafts. Recommended order (owner may override): **A′ → C′ → B′**.

## Execution steps (approved operator only)
1. Fresh fetch; ABORT unless `origin/main` = `3e76114…`.
2. Verify commit/parent/tree/patch-checksum against this draft; re-run `publish:gate`; require 12/12.
3. Obtain explicit approval naming Draft A′; record the approved publication window.
4. Mint a NEW bounded repo-scoped write credential (contents:write, this repo only, shortest lifetime; never an audit/read credential; never stored anywhere in the repo or packet).
5. Push exactly `f4a5dfeca5af222aeb9dcb1a6da822415397f902:refs/heads/main`.
6. Independently verify post-push (anonymous HTTPS): remote SHA, tree `63dcfbe…`, parent ancestry, two-file scope.
7. **Revoke the credential immediately**; verify it no longer authenticates.
