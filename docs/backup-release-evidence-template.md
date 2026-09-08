# Gate-B Backup and Release Evidence

Blank fill-in-later template. Copy this template and complete it in the
approved private evidence store, not in Git. Sensitive evidence — real
target names, hosts, URLs, project references, storage paths, credentials,
secrets, keys, tokens, connection strings, backup contents, and command
output — belongs in the approved private evidence store only and must
never be committed to this repository.

Use `[NOT_RECORDED]` for any field intentionally left blank.

## Record metadata

| Field | Value |
|---|---|
| Record ID | `[RECORD_ID]` |
| Date | `[DATE]` |
| Operator | `[OPERATOR]` |
| Reviewer | `[REVIEWER]` |
| Rehearsal scope | `[SCOPE]` |
| Authorization reference | `[AUTHORIZATION_REF]` |
| Related release record | `[RELEASE_RECORD_REF]` |

## Backup metadata

| Field | Value |
|---|---|
| Backup taken at (UTC) | `[DATE]` |
| Recovery point covered | `[RECOVERY_POINT]` |
| Artifact type | `[ARTIFACT_TYPE]` |
| Artifact size class | `[SIZE_CLASS]` |
| Tool and version | `[TOOL_VERSION]` |
| Source target class | `[TARGET_CLASS]` |

Record the artifact type and size class only. Never record paths, hosts,
project references, or the artifact itself.

## Backup integrity

| Field | Value |
|---|---|
| Checksum algorithm | `[CHECKSUM_ALGORITHM]` |
| Artifact checksum | `[CHECKSUM]` |
| Verified by | `[OPERATOR]` |
| Verification date | `[DATE]` |
| Result | `[PASS_OR_FAIL]` |

## Encryption and key custody

| Field | Value |
|---|---|
| Encryption method | `[ENCRYPTION_METHOD]` |
| Key custodian | `[KEY_CUSTODIAN]` |
| Key recovery process reference | `[KEY_RECOVERY_REF]` |
| Decrypt test performed | `[YES_OR_NO]` |
| Decrypt test result | `[PASS_OR_FAIL]` |

## Private storage

| Field | Value |
|---|---|
| Storage class | `[STORAGE_CLASS]` |
| Access limited to | `[AUTHORIZED_ROLES]` |
| Access control reviewed by | `[REVIEWER]` |
| Review date | `[DATE]` |

Describe the storage class only. Never record storage paths, bucket names,
URLs, or account identifiers.

## Retention and recovery objectives

| Field | Value |
|---|---|
| Retention period | `[RETENTION_PERIOD]` |
| Scheduled deletion date | `[DELETION_DATE]` |
| Recovery point objective (RPO) | `[RPO]` |
| Recovery time objective (RTO) | `[RTO]` |
| Rehearsal cadence | `[CADENCE]` |

## Disposable restore rehearsal

| Field | Value |
|---|---|
| Disposable target class | `[TARGET_CLASS]` |
| PostgreSQL version compatibility | `[PG_VERSION_CHECK]` |
| Restore started (UTC) | `[DATE]` |
| Restore finished (UTC) | `[DATE]` |
| Measured duration | `[DURATION]` |
| Outcome | `[PASS_OR_FAIL]` |
| Error evidence reference | `[EVIDENCE_REF]` |

The disposable target must be non-production and ephemeral. Error evidence
stays in the private evidence store, never in Git.

## Read-only post-restore validation

| Check | Result |
|---|---|
| Reachability | `[PASS_OR_FAIL]` |
| Schema inventory | `[PASS_OR_FAIL]` |
| Extension inventory | `[PASS_OR_FAIL]` |
| Representative row counts | `[PASS_OR_FAIL]` |
| Read-only compatibility checks | `[PASS_OR_FAIL]` |
| No writes, migrations, or corrections performed | `[YES_OR_NO]` |

Findings summary: `[FINDINGS]` or `[NOT_RECORDED]`

## Gate-B handoff

| Field | Value |
|---|---|
| Evidence attached to controlled release record | `[YES_OR_NO]` |
| Blockers or exceptions | `[BLOCKERS]` |
| Read-only catalog/preflight authorization | `[AUTHORIZATION_REF]` |
| Migration authorization (separate) | `[AUTHORIZATION_REF]` |
| Deployment authorization (separate) | `[AUTHORIZATION_REF]` |

Default disposition: no migration applied and no deployment performed until
formal authorization is recorded.

## Cleanup

| Field | Value |
|---|---|
| Disposable target destroyed or destruction scheduled | `[DATE]` |
| Temporary artifacts securely removed by | `[OPERATOR]` |
| Access review and revocation completed | `[YES_OR_NO]` |
| No backup material remains in the repository | `[YES_OR_NO]` |

## Evidence references

| Field | Value |
|---|---|
| Private evidence store record | `[EVIDENCE_REF]` |
| Follow-up items | `[FOLLOW_UPS]` |
| Next rehearsal date | `[DATE]` |

List reference identifiers only. Never include sensitive locations, URLs,
or connection data.

## Operator sign-off

| Field | Value |
|---|---|
| Operator | `[OPERATOR]` |
| Date | `[DATE]` |
| Sign-off reference | `[SIGNOFF_REF]` |

## Reviewer sign-off

| Field | Value |
|---|---|
| Reviewer | `[REVIEWER]` |
| Date | `[DATE]` |
| Sign-off reference | `[SIGNOFF_REF]` |

The reviewer confirms this record is complete, sensitive material stayed in
the approved private evidence store and out of Git, and the default
disposition stands until formal authorization is recorded.
