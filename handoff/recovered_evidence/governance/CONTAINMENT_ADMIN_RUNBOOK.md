# Containment Admin Runbook — Emergent.sh Write-Path Removal + Main Protection (v1)

**Classification: ADMIN RUNBOOK (documentation artifact).** Authorized by operator on 2026-08-10 as URGENT, executed by a GitHub administrator in the GitHub UI/API — not from any agent container. Containment is NOT cleanup: no `conflict_*` branch may be deleted, merged, renamed, rebased, or modified. Causation framing: the Emergent.sh install churn (~20 reinstall cycles; fresh install 2026-08-10T13:15:12Z) is **strong correlation evidence**; final causation is confirmed only by the canonical audit + post-containment behavior.

---

## Step 1 — Remove the suspected write path

In `github.com/settings/installations` (account: `sbtheg17-market`):

- [ ] Open the **Emergent.sh** app installation.
- [ ] EITHER remove `sbtheg17-market/foot` from "Repository access" (if other repos legitimately use the app),
- [ ] OR uninstall the app entirely (if Foot is its only required repository).
- [ ] Record which option was taken and the UTC time.

## Step 2 — Verify the app can no longer authenticate against Foot

- [ ] Confirm `foot` no longer appears under the app's repository access list.
- [ ] Confirm the GitHub audit log contains the corresponding event
      (`integration_installation.destroy` or `integration_installation.repositories_removed`) with a timestamp AFTER 2026-08-10T13:15:12Z (the last known install).
- [ ] Confirm no new `integration_installation.create` event follows it (watch for the churn pattern re-adding access).

## Step 3 — Protect `main` on sbtheg17-market/foot

Repo → Settings → Branches (or Rules → Rulesets) → protection for `main`:

- [ ] Block force pushes.
- [ ] Block branch deletion.
- [ ] Restrict who can push (direct pushes disallowed except the approved publication path).
- [ ] Require the approved publication path OR a reviewed pull request for changes.
- [ ] Do NOT add the Emergent.sh app (or any app) to the bypass list.
- [ ] Confirm the ruleset is ACTIVE (not evaluate/disabled mode).

## Step 4 — Confirm conflict branches untouched

- [ ] Verify all `conflict_*` branches still exist with unchanged tips (count expected: 15 as of last audit-state report; record the observed count and time — any change is audit input, not a problem to "fix").
- [ ] Take no action on them.

## Step 5 — Capture the evidence

- [ ] Export or screenshot the audit-log entries for: app access removal/uninstall, ruleset/branch-protection creation.
- [ ] Note each event's `_document_id` if using the JSON export.
- [ ] Deliver the export/screenshots to the next session for checksumming and inclusion alongside `DEPLOY_KEY_DELETION_EVIDENCE.md`.

## Completion criteria (all must hold)

1. Emergent.sh cannot authenticate against `sbtheg17-market/foot`.
2. `main` blocks force-push, deletion, and unauthorized direct pushes, with no app bypass.
3. All `conflict_*` branches remain unchanged.
4. Audit-log evidence of both actions is captured.
5. Publication channel remains CLOSED — do not reopen until these protections are verified in the canonical session.

## Next canonical session (after containment)

1. Provision the verified Foot clone.
2. Import + checksum all SEVEN artifacts of the handoff set:
   1. `HANDOFF_ENVIRONMENT_MISMATCH.md` (frozen)
   2. `GATE_A_READONLY_AUDIT_PROCEDURE.md` (frozen)
   3. `GATE_A_DISCREPANCY_REPORT_TEMPLATE.md` (frozen)
   4. `FOOT_GOVERNANCE_SESSION_LEDGER.md` (frozen)
   5. `DEPLOY_KEY_DELETION_EVIDENCE.md`
   6. `evidence/export-sbtheg17-market.json.gz` (raw audit export)
   7. `CONTAINMENT_ADMIN_RUNBOOK.md` (this document)
   Expected hashes are recorded in the session reports and inside the evidence record.
2a. Record the post-containment `conflict_*` branch count as evidence. Do NOT assume it is still 15; do NOT delete any newly appearing or existing conflict branch.
3. Run Gate A read-only across the **current** branch inventory; compare against the 15-branch pinned inventory; record any post-containment changes as audit findings.
4. Update the ledger with deploy-key evidence (doc ID `dBCe3Oevk8h46xWacXhjSA`) and app-containment evidence.
5. Only then consider the bounded Session 063 publication path (parent exactly `3e76114`, candidate exactly `e6809e7`, gate-checked, fast-forward-only, window closed immediately after).

---
*Drafted in the environment-mismatch container as documentation only; no GitHub state was touched in producing this runbook.*
