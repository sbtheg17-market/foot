# Gate A — Discrepancy Report Template (v1)

**Classification: LOCAL DOCUMENTATION-ONLY ARTIFACT.**
Drafted in the environment-mismatch workspace. This template contacts nothing and inspects nothing. It is to be FILLED IN by the auditor running the approved Gate A read-only procedure (`GATE_A_READONLY_AUDIT_PROCEDURE.md`) inside a **verified clone of `sbtheg17-market/foot`**. A completed report is content-free: refs, SHAs, timestamps, counts, and ancestry only — no file contents, no diffs, no secrets.

> RULE: Filing this report is a STOP action. No cleanup, deletion, merge, rebase, push, or "fix" may follow until the report is reviewed and remediation is explicitly approved.

---

## A. Audit session metadata

| Field | Value |
|---|---|
| Report date/time (UTC) | |
| Auditor session ID | |
| Working directory (`git rev-parse --show-toplevel`) | |
| Remote URL (`git remote -v`) — must be sbtheg17-market/foot | |
| Fetch performed read-only, no prune (Y/N) | |
| Procedure version used | GATE_A_READONLY_AUDIT_PROCEDURE v1 |

## B. Main verification

| Field | Expected | Observed | Match (Y/N) |
|---|---|---|---|
| `origin/main` commit SHA | 3e76114 | | |
| `origin/main` tree SHA | (pinned in canonical docs) | | |

If either mismatch: STOP. Complete sections D–F and file the report. Do not proceed with branch enumeration remediation.

## C. Branch count verification

| Field | Expected | Observed | Match (Y/N) |
|---|---|---|---|
| Total `origin/conflict_*` refs | 15 | | |
| Original inventory branches present | 12 | | |
| `conflict_090826_2326` present @ 73bdad6 | Y | | |
| `conflict_100826_0813` present @ 8cc0028 (post-S063 addendum) | Y | | |
| `conflict_100826_0906` present @ 018e69b (post-S063 addendum) | Y | | |

## D. Per-branch inventory table

One row per observed `origin/conflict_*` ref, sorted by branch name. Status codes: **OK** (matches pinned inventory), **MOVED** (tip SHA differs), **MISSING** (in inventory, not on remote), **EXTRA** (on remote, not in inventory), **ANCESTRY** (unexpected first-parent / merge-base relationship).

| # | Branch name | Pinned tip SHA | Observed tip SHA | Commit timestamp (ISO) | First-parent SHA | Merge-base w/ origin/main | Status |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| … | | | | | | | |
| 15 | | | | | | | |

## E. Discrepancy detail (one block per non-OK row)

```
Discrepancy ID:        GA-DISC-___
Type:                  COUNT | MOVED | MISSING | EXTRA | ANCESTRY | MAIN-MISMATCH
Branch (if applicable):
Expected value:
Observed value:
First observed (this audit) or previously known:
Evidence commands run (read-only only):
Auditor notes (facts only, no speculation, no content):
```

## F. Report integrity

| Field | Value |
|---|---|
| Inventory listing checksum (`sort inventory.txt \| sha256sum`) | |
| This report body checksum (sha256) | |
| Report storage location (read-only audit area / investigation branch — never main, never any conflict_* branch) | |

## G. Auditor attestation

- [ ] No `conflict_*` branch was checked out, merged, rebased, updated, deleted, or pushed.
- [ ] `origin/main` was not modified.
- [ ] No prune, no force operations, no remote branch created.
- [ ] No private keys, tokens, or DATABASE_URL were requested, used, or recorded.
- [ ] This report contains no file contents, diffs, or secrets.
- [ ] Audit STOPPED at report filing; no remediation attempted.

Auditor signature (session ID + timestamp): ______________________

---
*Template drafted as documentation only in the environment-mismatch workspace. See `HANDOFF_ENVIRONMENT_MISMATCH.md` and `GATE_A_READONLY_AUDIT_PROCEDURE.md` in this directory.*
