# PROVENANCE — Rule 12 provenance-docs, candidate r3

Generated: 2026-08-11 (Emergent recovery container; no remote writes, no credentials)

## Identity (NEW re-derivation; separate from Phase 4C at all times)
- Candidate branch (LOCAL ONLY, never pushed): candidate/rule12-provenance-r3
- Commit: fc6251a4e2726c31f7adab1c45370500a0d2d693
- Parent: d2ad54cd8e450fcc3bf8fab28aed257d67e73b42  (canonical origin/main)
- Tree:   1f1da660eb1b7b04c61264358cf881bc23b5980d
- Patch:  provenance-rule-docs-r3.patch
  SHA-256 3eee486c85ce2e510aeda3283209ed3a9d749e6c8c2ed2ec31116038196154c9
- The historical r2 commit e5919bd4f0e94feb77d711d8f789ff5aa8755931 remains ABSENT
  and is NOT claimed or impersonated.

## Source material
- Content taken verbatim from the RECOVERED, checksum-verified r2 patch
  candidates/provenance-rule-docs-r2.patch
  SHA-256 1afb92dcce0a759604cd7cc2912c9cf29834e63337096baac0db2e3dc3c52570
  (byte-identical to both handoff-MANIFEST-149 entries).
- Applied clean via `git am` onto d2ad54cd; zero conflicts.
- Scope: DOCS-ONLY — one file, .agents/AGENT-RULES.md (+32 lines, Rule 12:
  evidence and provenance requirements). No code, schema, lockfile, UI,
  routing, storage, events, or economics changes.

## Validation (captured in the append-only ledger /app/recovery/ledger/LEDGER.jsonl)
| Ledger | Action | Result |
|---|---|---|
| AC-001 | candidate identity verification (commit/parent/tree) | PASS |
| AC-002 | scripts/verify-publication.sh — 12/12 checks incl. clean tree, fresh base (fetched from checksum-verified bundle), parent==origin/main, fast-forward single commit, allow-list scope (.agents/AGENT-RULES.md), no forbidden paths, no draft wording, session numbering untouched, tree identity match, patch checksum match | PASS |
| AC-003 | secret scan (superseded — policy-text false positive) | FAIL, superseded |
| AC-005 | secret VALUE scan via pattern file (supersedes AC-003) | PASS — clean |

## Status
- LOCAL-ONLY / UNPUBLISHED. Publication NOT authorized for this candidate.
- Never bundled with Phase 4C r3; separate branch, separate package, separate
  approval track.
- Gate output line "safe to hand to the managed publication channel" is a
  pre-approval SAFETY result only; named human publication approval, bounded
  credential, and publication window remain absent by instruction.
