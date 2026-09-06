# Backup and Release Evidence Record — Template (copy per release)

Editable operator template. Copy this file per release/rehearsal, fill every
field, and attach it to the release record (`docs/backup-restore-runbook.md`
→ Evidence record; sequence: `docs/gate-b-backup-rehearsal-checklist.md`).

> **Safe content only.** No hostname, Supabase project reference, database
> URL, connection string, password, token, encryption key or passphrase, raw
> log, backup content, SQL dump text, or row-level data belongs in this
> document. Use safe labels, dates, checksums, and named people/roles only.

## 1. Ownership and policy decisions

| Field | Value |
| --- | --- |
| Backup owner (named person/role) | |
| Backup provider/destination (safe label only) | |
| Backup frequency | |
| Backup retention period | |
| PITR availability (yes/no/plan) | |
| Restore-test cadence | |
| Recovery point objective (RPO) | |
| Recovery time objective (RTO) | |
| Escalation owner / path | |
| Encryption-key custody / rotation owner | |
| External destination approval (approver, date) | |

## 2. This backup run

| Field | Value |
| --- | --- |
| Fresh recovery-point reference (artifact label + UTC timestamp) | |
| Source identity confirmation (safe label only, e.g. `canonical prototype`) | |
| Source PostgreSQL major version | |
| Client tool versions (pg_dump / psql majors) | |
| Backup creation result (pass/fail + date) | |
| Plaintext SHA-256 | |
| Encrypted-payload SHA-256 | |
| Encryption validation result (round-trip decrypt + checksum match) | |
| Stored-destination confirmation (safe label only) | |

## 3. Restore rehearsal

| Field | Value |
| --- | --- |
| Restore target identity confirmation (safe disposable label only) | |
| Target PostgreSQL major version | |
| Pre-restore decrypt + checksum verification result | |
| Restore result (pass/fail + date) | |
| Extension check result | |
| Critical-table / safe-count validation result | |
| Application compatibility check result | |
| Non-production reconfirmation | |
| Cleanup result (target deleted, plaintext removed, secrets unset + date) | |

## 4. Gate-B preflight and approval

| Field | Value |
| --- | --- |
| Artifact state confirmation (expected 2 existing / 8 absent / 0 partial) | |
| §7 prerequisite check result (`docs/gate-b-catalog-queries-readonly.sql`) | |
| §6 R1 collision check result (REQUIRED verdict row) | |
| Named SQL reviewer | |
| Named release approver | |
| Explicit approval decision (go / no-go / blocked) | |
| Date/time with timezone | |

Completion of this record is evidence only. It does not authorize applying
any migration artifact or any deployment.
