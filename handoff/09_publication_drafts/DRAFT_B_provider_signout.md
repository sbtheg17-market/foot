# Publication Draft B — Provider sign-out (`0c216d6`)

**STATUS: PREPARED, NOT EXECUTED. NOT APPROVED. CONTINGENT ON ARTIFACT RECOVERY. MUTUALLY SEQUENCED WITH DRAFT A.**

| Field | Value |
|---|---|
| Target repository | `sbtheg17-market/foot` |
| Target ref | `refs/heads/main` (fast-forward only) |
| Commit | `0c216d6` — FULL 40-hex REQUIRED-FROM-RECOVERY |
| Parent as recovered | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` — **only valid if B publishes FIRST**; if Draft A (or anything) lands first, this candidate is UNPUBLISHABLE as-is and must be re-derived on the new tip as a NEW identity |
| Tree | REQUIRED-FROM-RECOVERY |
| Patch SHA-256 | `2b4ee109…` — FULL 64-hex REQUIRED-FROM-RECOVERY |
| Changed files | REQUIRED-FROM-RECOVERY. Expected web scope (`artifacts/web/src/**`). Forbidden categories (schema, lockfile, generated clients, `.emergent`, `attached_assets`, mobile unless approved) fail the draft |
| Web-UI approval | If any `artifacts/web/**` file is touched: publication REQUIRES `--approve-web-ui "<approver>: <reason>"` with the printed audit record — an explicit human approval, per the gate published at `47df77e` |
| Tests | Typecheck + web build from the candidate tree; regression suites relevant to auth/session UX (per Session 052 pattern); gate full PASS otherwise |

## Execution steps
Identical to Draft A steps 1–10, with these substitutions:
- Step 4: run `publish:gate` WITH the `--approve-web-ui` flag only after the named human approval exists; archive the audit record it prints.
- Step 8: post-push scope check must list exactly the recovered changed-file set.
- Re-derivation rule: if not publishing first, rebase/re-derive on the current tip, recompute hash + patch checksum, restate identity as NEW in the ledger, rerun gate and tests, and obtain a fresh approval for the re-derived draft. **Never claim byte identity with `0c216d6`.**

## Explicit non-actions
No push occurs from this packet. No combined publication of A+B. No credential appears anywhere in this draft.
