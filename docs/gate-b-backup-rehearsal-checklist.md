# Gate-B Backup and Disposable Restore Rehearsal Checklist

## Purpose

- This is a local, operator-led checklist.
- It does not authorize production changes.
- It does not authorize migrations, deployments, or production restores.
- It prohibits putting backup contents or credentials in source control.

## Phase 0 — Preconditions

- [ ] Operator and reviewer are named for this rehearsal.
- [ ] Written authorization for the rehearsal is recorded outside Git.
- [ ] Canonical target is confirmed out of band, never in this repository.
- [ ] Backup ownership is confirmed with the named backup owner.
- [ ] Encryption method and key custody are confirmed before any backup.
- [ ] Private storage location is approved and access-controlled.
- [ ] Retention, RPO, RTO, and rehearsal cadence values are confirmed.
- [ ] Disposable restore target planning is PostgreSQL 17 compatible.
- [ ] No production restore is authorized by this checklist.
- [ ] No migration or deployment authorization is implied by this checklist.

## Phase 1 — Backup Verification

- [ ] A fresh backup or recovery point covers the planned change window.
- [ ] The backup completed under the authorized operator process.
- [ ] Artifact type is recorded in the evidence record, never committed.
- [ ] Artifact size passes a sanity check against expectations.
- [ ] Artifact checksum is computed and recorded outside Git.
- [ ] Artifact is encrypted with the approved method.
- [ ] Decrypt and integrity test passes on the encrypted artifact.
- [ ] Confirmed no backup materials, credentials, or output entered Git.

## Phase 2 — Private Storage

- [ ] Access control on the private storage location is reviewed.
- [ ] Encryption key custody and recovery process are documented privately.
- [ ] Retention and deletion timing are recorded for the artifact.
- [ ] Evidence reference is recorded without sensitive locations.
- [ ] Access is limited to authorized operators only.

## Phase 3 — Disposable Restore Target

- [ ] Target is non-production and ephemeral.
- [ ] Target is PostgreSQL 17 compatible.
- [ ] Target is isolated from production networks and data.
- [ ] No unintended production integrations can run from the target.
- [ ] Restore into the disposable target is explicitly authorized.
- [ ] Target lifecycle (create, use, destroy) is recorded outside Git.

## Phase 4 — Restore Execution

- [ ] Safe-target review completed immediately before the restore.
- [ ] Restore runs only against the disposable target.
- [ ] Restore start, finish, and duration are recorded in the evidence record.
- [ ] Error evidence is protected in the private store, never committed to Git.
- [ ] Restore outcome is classified (pass, pass with notes, fail).
- [ ] Confirmed no production endpoint was contacted during the restore.

## Phase 5 — Read-only Validation

- [ ] Restored target is reachable for read-only validation.
- [ ] Schema inventory matches expectations.
- [ ] Extension inventory matches expectations.
- [ ] Representative table and row-count checks pass.
- [ ] Read-only application compatibility checks pass.
- [ ] No migrations, data corrections, or write tests were run.
- [ ] Validation findings are recorded in the evidence record.

## Phase 6 — Gate-B Handoff

- [ ] Evidence is attached to the controlled release record.
- [ ] Blockers and exceptions are recorded.
- [ ] Read-only catalog or preflight access is separately authorized if needed.
- [ ] Migration authorization is a separate, explicit decision.
- [ ] Deployment authorization is a separate, explicit decision.
- [ ] Default disposition: no migration applied without recorded approval.

## Phase 7 — Cleanup

- [ ] Disposable target is destroyed or destruction is scheduled.
- [ ] Temporary artifacts are securely removed by an authorized operator.
- [ ] Access review and revocation are completed.
- [ ] Evidence retention is confirmed against the approved policy.
- [ ] Confirmed no backup material remains in the repository.

## Phase 8 — Evidence Record

- [ ] Evidence template is completed outside source control.
- [ ] Record metadata (record ID, date, operator, reviewer) is complete.
- [ ] Encryption and private-storage evidence is complete.
- [ ] Restore timing and outcome are recorded.
- [ ] Validation findings are recorded.
- [ ] Operator and reviewer sign-offs are recorded.
- [ ] Follow-ups are recorded with owners.
- [ ] Next rehearsal date is recorded.

## Repository safety reminders

- Never commit backup contents, dumps, archives, restore logs, credentials, or environment files.
- Never include connection strings, credential-bearing URLs, tokens, hostnames, or project identifiers.
- Never run migrations, deployments, or production restores as part of this checklist.
- Default outcome is no migration applied until formal authorization is recorded.
