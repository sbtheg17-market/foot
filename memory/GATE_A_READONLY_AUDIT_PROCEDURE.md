# Gate A — Read-Only Conflict-Branch Audit Procedure (v1)

**Classification: PROCEDURE DOCUMENT ONLY.**
This document was drafted in an environment-mismatch workspace that does **not** contain the Foot repository. It authorizes nothing by itself. It must be executed only by a future session ("next Neo") that has a **verified clone of `sbtheg17-market/foot`** — never against a guessed repository, never from `/app`, and never via "Save to GitHub".

---

## Preconditions (ALL must hold before step 1)

- [ ] Working directory is the canonical Foot clone (verified below), not `/app` and not any template workspace.
- [ ] No credentials, deploy keys, or tokens are created for this audit; only existing read access to the verified clone/remote is used.
- [ ] The session has explicit instruction to run the Gate A audit.
- [ ] Standalone prototype work remains unapproved and out of scope.

## Invariants (hold for the entire audit)

- READ-ONLY: no checkout of `conflict_*` branches, no merge, no rebase, no branch update, no deletion, no push, no force-push, no remote-branch creation.
- `main` is not modified in any way.
- No cleanup, consolidation, or "tidying" is proposed or performed until the discrepancy report (step 10) is reviewed.
- The audit report is **content-free**: refs, SHAs, timestamps, and parentage only — no file contents, no diffs, no secrets.

---

## Procedure

```
1. Confirm the working directory is the canonical Foot clone, not /app.
   - git rev-parse --show-toplevel
   - Verify repository identity markers match the canonical Foot project.

2. Confirm the remote URL and fetch origin read-only.
   - git remote -v            (must be sbtheg17-market/foot)
   - git fetch origin --prune=false   (never prune during audit)

3. Record origin/main SHA and tree SHA.
   - git rev-parse origin/main
   - git rev-parse origin/main^{tree}
   - Expected: main @ 3e76114. If it differs, STOP and report before continuing.

4. Enumerate every origin/conflict_* ref.
   - git for-each-ref 'refs/remotes/origin/conflict_*' \
       --format='%(refname:short) %(objectname)'

5. For each branch, record: branch name, tip SHA, commit timestamp,
   and first-parent relationship.
   - git log -1 --format='%H %cI %P' <ref>
   - git merge-base origin/main <ref>   (record; do not act on it)

6. Compare the full list against the pinned inventory:
   - the original 12-branch Gate A inventory (pinned in canonical repo docs);
   - conflict_090826_2326 @ 73bdad6;
   - conflict_100826_0813 @ 8cc0028   (post-Session-063 addendum);
   - conflict_100826_0906 @ 018e69b   (post-Session-063 addendum).
   Expected total: 15 branches. Every tip SHA must match its pinned value.

7. Produce a checksummed, content-free inventory report.
   - Deterministic, sorted listing of (branch, tip SHA, timestamp, parent).
   - Append a checksum of the report body, e.g.:
     sort inventory.txt | sha256sum
   - Store the report in a read-only audit report location or a separate
     investigation branch — never on main, never on any conflict_* branch.

8. Do not checkout, merge, rebase, update, delete, or push any
   conflict_* branch.

9. Do not modify main.

10. Stop and report discrepancies before any cleanup proposal.
    - Discrepancy = missing branch, extra branch, moved tip SHA,
      or mismatch with the pinned inventory or expected main SHA.
    - No remediation of any kind until the report is reviewed and
      explicitly approved.
```

## Handling of the two newest branches

`conflict_100826_0813 @ 8cc0028` and `conflict_100826_0906 @ 018e69b` are **post-Session-063 addenda to the Gate A inventory**. They are preserved evidence with the same protections as the original 12 + `conflict_090826_2326 @ 73bdad6`. They are not disposable noise and must never be treated as cleanup candidates by default.

## What follows a clean audit (separate, sequential authorizations — not part of this procedure)

```
read-only 15-branch Gate A audit
→ deploy-key deletion confirmation
→ Session 063 (e6809e7, parent 3e76114) publication after manual confirmation
→ managed Gate B verification (verifier v2, runtime-injected DATABASE_URL only)
→ C-2 implementation (owner-scoped consent API; no schema/production writes until Gate B clears)
→ Phase 4C and provider economics
→ local discovery and SEO surfaces (canonical repo only, after governance recovery)
```

---
*Drafted in the environment-mismatch workspace as documentation only. See `HANDOFF_ENVIRONMENT_MISMATCH.md` in this directory for session context.*
