# PROVENANCE — Phase 4C non-schema prep, candidate r3

Generated: 2026-08-11 (Emergent recovery container; read-only with respect to all remotes)

## Identity (NEW — this is a re-derivation, not the historical r2)
- Candidate branch (LOCAL ONLY, never pushed): candidate/phase4c-nonschema-prep-r3
- Commit: d9195dfab83a211dd2d79e7836348693a9748bc8
- Parent: d2ad54cd8e450fcc3bf8fab28aed257d67e73b42  (canonical origin/main baseline)
- Tree:   2b1a3f7d7141b3afdfc8e016fbf6083dd47b8a93
- The historical r2 commit 396040ea3e6921eaee7555609269dae3dd201412 remains ABSENT
  and is NOT claimed, reproduced, or impersonated by this candidate.

## Source material
- Content taken verbatim from the RECOVERED, checksum-verified r2 patch:
  candidates/phase4c-nonschema-prep-r2.patch
  SHA-256 db0717024ac609367a5edd69cc6467ba2b24743333012cb82cf754c8e536e66c
  (byte-identical match to both handoff-MANIFEST-149 entries; recovered from
  snapshot branches conflict_100826_2113 / conflict_100826_2258)
- Applied onto d2ad54cd via `git am` — clean apply, zero conflicts, zero fuzz.
- Diff scope (9 files, +1905/-1): docs/comfort-profile/openapi.draft.yaml,
  PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md, WIRING_NOTES.md,
  api-server contract module + fixtures + contract tests + package.json script,
  two UNWIRED web UI shells (client editor, provider booking card).
- Explicitly NOT included: DB schema, migrations, codegen, routing changes,
  storage wiring, event emission, economics. pnpm-lock.yaml untouched.

## Validation (NEW evidence, this container, 2026-08-11)
| Check | Result | Evidence |
|---|---|---|
| pnpm install --frozen-lockfile (pnpm 10.18.3, node v20.20.2) | PASS (15.5s, lockfile byte-identical) | evidence/P4R3-PNPM_INSTALL_2026-08-11.log |
| test:comfort-contract | PASS 38/38, 0 fail/skip | evidence/P4R3-COMFORT_CONTRACT_TEST_2026-08-11.log |
| workspace typecheck (libs + artifacts + scripts) | PASS | evidence/P4R3-TYPECHECK_2026-08-11.log |
| web production build (vite) | PASS (4.91s) | evidence/P4R3-WEB_BUILD_2026-08-11.log |
| tracked-file cleanliness after all runs | 0 modified | (git status recorded in logs) |
| secret scan of patch | CLEAN | this file |

## Status and blocks
- Publication: NOT authorized. No push, no remote write, no publication window.
- Gate B: NOT run here. It must run separately in the managed environment with a
  runtime-injected DATABASE_URL; no credentials were requested or used in this
  container.
- Schema, migrations, storage, economics, production events: BLOCKED pending
  their explicit prerequisites.
- Rule 12 r2 re-derivation: NOT performed (not authorized in this instruction).
- Evidence ceiling of the historical recovery (90/149, 64/80, 55 missing) is
  unchanged; the logs in evidence/ here are new artifacts, clearly labeled, and
  do not close any missing manifest entry.
