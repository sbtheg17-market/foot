# 6. Candidate inventory

**Honesty note:** this environment is a fresh container. The candidates below are LOCAL-ONLY claims from the handoff statement. Their commit objects, patch files, and full checksums are **not present here and not recorded anywhere in the canonical repository** (verified: `git cat-file` fails on the remote clone; repo-wide grep for the hashes/checksums returns nothing). Every field marked `REQUIRED-FROM-RECOVERY` must be filled from recovered artifacts before any publication review.

## Candidate A — Session 063 traceability
| Field | Value | Status |
|---|---|---|
| Claimed commit | `eec0147` (full 40-hex unknown) | UNVERIFIED — REQUIRED-FROM-RECOVERY |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (canonical main) | Parent itself verified on remote |
| Tree | unknown | REQUIRED-FROM-RECOVERY |
| Patch SHA-256 | `290fa509…` (truncated; full 64-hex unknown) | REQUIRED-FROM-RECOVERY |
| Expected scope | `.agents/LOG.md` + `.agents/NEXT_TASK.md` only (docs-only traceability, per every prior Session-N candidate) | Expectation only — must be confirmed from the artifact |
| Tests | Docs-only candidates historically run `publish:gate` (scope/wording/tree/checksum checks); app suites not required | REQUIRED-FROM-RECOVERY (gate output) |
| Location | previous account's workspace — NOT here, NOT on remote | — |

## Candidate B — Provider sign-out
| Field | Value | Status |
|---|---|---|
| Claimed commit | `0c216d6` (full 40-hex unknown) | UNVERIFIED — REQUIRED-FROM-RECOVERY |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` | Parent verified on remote |
| Tree | unknown | REQUIRED-FROM-RECOVERY |
| Patch SHA-256 | `2b4ee109…` (truncated) | REQUIRED-FROM-RECOVERY |
| Expected scope | Likely `artifacts/web/**` (sign-out is a web UX fix) → would require the published review-gate's `--approve-web-ui "<approver>: <reason>"` flag and an explicit human approval | Must be confirmed from the artifact's changed-file list |
| Tests | Typecheck + build + relevant regression suites; UX fix candidates follow the Session 052 verification pattern | REQUIRED-FROM-RECOVERY |
| Location | previous account's workspace — NOT here, NOT on remote | — |

## Earlier re-derived candidates
Separate historical identities. Per the handoff rule: **no byte-identity claims** between any re-derivation and any earlier candidate; never silently substitute one identity for another. If Candidates A/B are lost and re-derived from `3e76114`, the re-derivations are NEW candidates with new hashes and new patch checksums, and the ledger entry must say so explicitly.

## Sequencing constraint (both parented on `3e76114`)
Only ONE can land on `main` as a fast-forward. After the first lands (new tip T1), the second's recorded parent (`3e76114`) no longer equals `origin/main`; the fail-closed publication channel will refuse it by design. The second must be **re-derived on T1 as a new identity** with a fresh gate run and its own approval. Therefore: two separate publication drafts (`09_publication_drafts/`), no combined push, no direct push of both.

## Contract checksums (recorded in-repo at `3e76114`, documents not present)
- Phase 4C comfort-profile contract: SHA-256 `1fa0eecba58c4cd5c0b8a31cbd56f934ba47067e9af4dddf8a461d0e7269bb14`
- Provider economics contract: SHA-256 `5a7a20290d0e99eb73f418e09eebb346f6778b0900e73dcf6cfeef2a49342bcc`
