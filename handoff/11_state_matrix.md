# State matrix — after C′ completion (2026-08-10)

Canonical `origin/main` = `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (live-verified, unchanged). 18 `conflict_*` branches (inventory v5). Zero pushes/merges/deletions/remote writes ever performed from this account.

## Local candidates (each parented on exactly `3e76114`; publish at most ONE as-is, re-derive the rest on the new tip)

| Candidate | Branch | Commit | Tree | Patch SHA-256 | Scope | Evidence | Publication |
|---|---|---|---|---|---|---|---|
| A′ Session 063 traceability | `rederive/session063-100826` | `f4a5dfeca5af222aeb9dcb1a6da822415397f902` | `63dcfbe3080dae65a478c55d8e4bdbebb1832838` | `dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9` | `.agents/LOG.md`+`NEXT_TASK.md` | gate 12/12 PASS | Draft A′ — approval pending |
| B′ Provider sign-out | `rederive/provider-signout-100826` | `e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae` | `c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321` | `dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093` | 1 web file | typecheck+build+browser E2E PASS; gate 11/12 (web flag at publication) | Draft B′ — approval + `--approve-web-ui` pending |
| C′ Lockfile reproducibility | `rederive/lockfile-repro-100826` | `2c6d0248569b9c3f99213a19a40eaade81e69a4a` | `093a2c22856ba93e31a002e79486bdb9751fbdd4` | `1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31` | `package.json`+`.agents/SETUP.md` (lockfile untouched) | 13/13-suite battery all EXIT=0 (205 passes); frozen install PASS; gate 12/12 PASS | Draft C′ — approval pending |

Retired identities (recovered artifacts kept as evidence; never reused): `eec0147cd54fe…` (patch `290fa509…`), `0c216d6f9f6b…` (patch `2b4ee109…`). Older generations `63b6b2c…/a7a1ba2…/a9d769c…` remain lost.

## Gates and evidence
| Item | Status |
|---|---|
| Gate A / conflict cleanup | PAUSED — inventory v5 (18 branches) recorded; 16-branch plan + deletion approval INVALIDATED; rows 17–18 attribution: content-verified, owner audit confirmation OPEN |
| Gate B managed DB | BLOCKED externally — UNVERIFIED; requires managed env with runtime-injected `DATABASE_URL` |
| Branch-protection export | MISSING — owner authenticated read required (anon 401) |
| Audit export | Recovered through 2026-08-10T13:15:16Z; coverage 13:15Z→present still OPEN |
| v3 contracts | RECOVERED + checksum-verified (`339a03e6…`, `2172f6cf…`); Phase 4C non-schema prep authorized; economics contract-only |

## Approved next work (local only)
1. Owner picks publication order and grants per-candidate approvals (recommended A′ → C′ → B′).
2. Phase 4C non-schema preparation (OpenAPI draft, UI shells, fixtures, contract tests, non-persistent boundary prep) against the checksum-verified contract — may proceed locally while Gate B remains pending.

## Blocked (unchanged)
Schema/migrations/storage wiring; production event writes; economics implementation; marketplace expansion; conflict-branch operations; remote ledger edits; any push/merge without named approval; packet dashboard (deferred).
