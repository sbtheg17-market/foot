# Managed Database Backup and Restore Runbook

This runbook is provider-agnostic. It defines the evidence required before a
managed database release; it does not choose a provider, set recovery targets,
or initiate a backup or restore.

## Required decisions

The platform owner and database owner must fill these values through the
approved operations process. Do not infer them from defaults or invent them
in repository documentation.

| Control | Status |
|---|---|
| Backup owner | `TBD — operator/provider decision` |
| Backup provider/service | `TBD — operator/provider decision` |
| Backup frequency | `TBD — operator/provider decision` |
| Retention | `TBD — operator/provider decision` |
| Point-in-time recovery | `TBD — operator/provider decision` |
| Restore-test cadence | `TBD — operator/provider decision` |
| Recovery point objective (RPO) | `TBD — operator/provider decision` |
| Recovery time objective (RTO) | `TBD — operator/provider decision` |
| Incident escalation owner | `TBD — operator/provider decision` |

No managed schema release is ready while these decisions are blank.

## Credential and data handling

- Use the provider's secret manager, vault, or protected operator environment.
- Never paste `DATABASE_URL`, passwords, tokens, certificates, connection
  strings, or cloud credentials into Git, chat, tickets, logs, screenshots,
  shell history, or this repository.
- Reports may include target class, target fingerprint, timestamps, status,
  counts, artifact hashes, and evidence references. They must not include raw
  connection details or row contents.
- Restore only into a separately identified recovery/staging target unless an
  incident commander explicitly authorizes a production restore.
- Treat restored data as production-sensitive. Apply the same access control,
  retention, deletion, and PII-handling rules as the source.

## Pre-migration backup gate

The release owner must complete these steps before any managed DDL:

1. Confirm the target identity and environment class without exposing secrets.
2. Confirm the named backup owner and provider.
3. Request or verify a recovery point that covers the planned change window.
4. Record the provider reference or immutable evidence identifier, not a
   credential or private URL.
5. Verify that the recovery point is complete, readable, and within the
   approved retention window.
6. Confirm point-in-time recovery coverage and the latest recoverable time.
7. Confirm the approved RPO/RTO values are known and achievable for this
   release.
8. Attach the evidence to the release record.
9. Stop if any confirmation is missing, stale, ambiguous, or inaccessible.

This is a confirmation procedure only. This audit did not create a backup.

## Restore-test procedure

Run on the provider's approved cadence and before a high-risk schema release,
using a non-production recovery target:

1. Select a documented recovery point and record its source target fingerprint
   and timestamp without recording credentials.
2. Restore into an isolated target with access controls and network policy
   equivalent to the intended recovery environment.
3. Measure restore duration and record whether the documented RTO was met.
4. Confirm that the restored target is reachable and that the database is
   consistent and accepting only the intended test access.
5. Run integrity checks:
   - expected tables, columns, enums, constraints, foreign keys, and indexes;
   - exact definition and validity of the active-booking unique index;
   - source/projection relationships and approved row-count comparisons;
   - application health and read-only smoke checks;
   - booking concurrency invariant in a disposable test fixture only.
6. Confirm that no unexpected production writes, external notifications, or
   scheduled jobs can run from the recovery target.
7. Record the measured restore time, recovery point age, integrity results,
   failed checks, operator, provider evidence reference, and next test due
   date.
8. Destroy or retain the recovery target according to the provider's approved
   data-retention and incident policy.

Never run test writes against the managed production target as part of a
restore rehearsal.

## Restore decision during an incident

The incident commander, database owner, and application owner must decide
whether recovery is:

- a provider point-in-time restore;
- a backup restore;
- a reviewed forward-fix;
- a transactional projection rebuild; or
- not yet safe to attempt.

The decision must consider application compatibility, expected downtime,
data-loss window against RPO, restoration duration against RTO, and whether a
forward-fix is safer than restoring valid customer data. A schema artifact
with no DOWN section must not be reversed by improvised SQL.

Before a production restore:

1. Declare the incident and assign the restore owner.
2. Stop application writes or place the application in the provider-approved
   maintenance mode, if required.
3. Confirm the exact source recovery point and destination target.
4. Capture the last known-good schema/artifact fingerprint.
5. Record the approval and expected customer impact.
6. Perform the provider operation through its protected interface.
7. Monitor progress and stop if the provider reports ambiguity or corruption.

## Validation after restore

Run read-only checks before reopening traffic:

- target identity and recovered timestamp;
- tables, columns, defaults, enums, constraints, foreign keys, and indexes;
- exact active-booking index definition, uniqueness, predicate, and validity;
- row counts and reconciliation checks appropriate to the incident;
- schema fingerprint against the selected known-good commit;
- application health and authenticated smoke tests;
- booking concurrency safety in an isolated fixture;
- queued jobs, notifications, integrations, and scheduled tasks are safe to
  resume;
- no unexpected schema drift or post-restore write occurred.

Record every result. If any critical check fails, keep traffic stopped and
escalate rather than applying ad hoc fixes.

## Evidence record

The release or incident record should contain:

- target class and credential-free target fingerprint;
- source and recovery-point timestamps;
- backup provider reference;
- artifact and repository commit hashes;
- operator, approver, incident commander, and timestamps;
- measured backup/restore duration;
- RPO/RTO decision and actual result;
- integrity and application verification results;
- downtime and data-loss assessment;
- escalation and customer-communication decision;
- next restore-test due date.

Do not store raw exports, row data, connection strings, or secret values in
the repository.

## Current status

The OnCall Foot repository currently has no verified backup owner, provider,
retention, PITR, restore-test cadence, RPO, or RTO. Every value above remains
`TBD — operator/provider decision`. No backup or restore was performed by the
documentation audit. This is a release blocker for managed schema changes.
