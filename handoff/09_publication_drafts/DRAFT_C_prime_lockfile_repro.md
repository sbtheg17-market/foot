# Publication Draft C′ — Lockfile/toolchain reproducibility fix

**STATUS: PREPARED, NOT EXECUTED. PUBLICATION NOT APPROVED.**
New candidate (no prior identity). Treats the frozen-install failure as a **reproducibility defect**; the canonical dependency graph is untouched — `pnpm-lock.yaml` is byte-identical.

| Field | Value |
|---|---|
| Target repository | `sbtheg17-market/foot` |
| Target ref | `refs/heads/main` (fast-forward only) |
| Commit | `2c6d0248569b9c3f99213a19a40eaade81e69a4a` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` |
| Tree | `093a2c22856ba93e31a002e79486bdb9751fbdd4` |
| Patch artifact | `new_candidates/lockfile-repro-rederived.patch` |
| Patch SHA-256 | `1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31` |
| Changed files | exactly 2, one line each: `package.json` (`packageManager: pnpm@9.15.0 → pnpm@10.18.3`) and `.agents/SETUP.md` (toolchain sentence corrected). **`pnpm-lock.yaml` NOT changed** |

## Documented root cause (diagnosis before any change)
- `pnpm-workspace.yaml` at the canonical tip uses settings (`overrides`, `minimumReleaseAge`, `onlyBuiltDependencies`) that pnpm reads from the workspace manifest **only since pnpm 10.5.0**.
- The stale `packageManager: pnpm@9.15.0` pin therefore made every corepack-pinned toolchain compute an empty `overrides` set ≠ lockfile `overrides` → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on `pnpm install --frozen-lockfile`.
- Empirical version matrix (standalone binaries, `--frozen-lockfile --lockfile-only`): 9.15.0 FAIL · 10.0.0 FAIL · 10.1.0 FAIL · 10.4.1 FAIL · **10.5.2 PASS** · 10.6.5 PASS · 10.7.1 PASS · 10.9.0 PASS · 10.13.1 PASS · 10.16.0 PASS · 10.18.3 PASS.
- Classification: **package-manager drift** (manifest pin), NOT a stale lockfile, NOT environment drift. The lockfile was verified consistent: full frozen install under 10.18.3 completes with **zero** lockfile diff. An earlier no-frozen rewrite diff (787/30 lines, produced by a mis-resolved toolchain during diagnosis) is archived at `lockfile_investigation/nofrozen_rewrite_pnpm10.18.3.diff` and was never committed.

## Evidence (durable logs in `lockfile_investigation/battery/`)
- `frozen_install.log`: `pnpm install --frozen-lockfile` → Done under corepack-resolved pnpm **10.18.3** (the new pin); `git diff pnpm-lock.yaml` = 0 lines.
- `lf_typecheck.log` (TYPECHECK_EXIT=0), `lf_build.log` (BUILD_EXIT=0).
- **Complete baseline battery, 13/13 suites, every EXIT=0, 205 passing / 0 failing** (per-suite logs with exit codes): booking 63/63 · concurrency 16/16 · pressure 13/13 · availability 3/3 · provider-application 8/8 · provider-status 9/9 · onboarding 23/23 · authorization 7/7 · provider-readiness 14/14 · provider-notifications 12/12 · reviewer-decisions 14/14 · provider-resubmission 11/11 · marketplace-events 12/12. Run on branch head with ephemeral local PostgreSQL (secrets in-shell only, shredded after; Gate B untouched).
- `gate_output.txt`: `publish:gate` **12/12 PASS** with allow-list `package.json .agents/SETUP.md`, expected tree `093a2c2…`, patch checksum verified.

## Sequencing constraint
Parented on `3e76114`, mutually exclusive with A′/B′ as-is; re-derive on the new tip if publishing second or third (mechanical one-line re-application; fresh gate + fresh draft).

## Execution steps
Identical to Draft A′ steps 1–7 (no web flag needed), with the gate invocation shown above and post-push scope check = exactly the two files.
