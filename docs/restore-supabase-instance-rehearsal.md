# Restore Rehearsal Guide — Disposable Targets Only

**Added:** 2026-08-29. Companion tooling for
`docs/restore-rehearsal-design.md`,
`docs/backup-supabase-instance.md`,
`docs/backup-restore-runbook.md`, and
`docs/provider-export-and-recovery-backup-architecture.md` (§4–§5).

## Purpose

```text
This is a restore rehearsal for verifying a backup procedure using a disposable,
non-production PostgreSQL target. It is not a production restore workflow.
```

The rehearsal proves a backup artifact can actually be restored. A non-empty
dump file is necessary evidence, never sufficient evidence. A successful
script run is a **basic technical verification only** — it is not a
substitute for full application-level recovery validation.

The scripts:

```text
scripts/restore-supabase-instance-rehearsal.sh   (macOS/Linux/WSL)
scripts/restore-supabase-instance-rehearsal.ps1  (Windows PowerShell)
```

are **operator-only tooling**. They are never called from application runtime
code, never exposed through the provider/vendor dashboard, never run in CI or
unattended, and never touch GitHub, Railway, or Supabase dashboard APIs.

## Preconditions

- Operator authorization for the rehearsal.
- A confirmed **non-production, disposable** target, provisioned separately
  and **empty** (the script never deletes, truncates, drops, resets, alters,
  or migrates the target before restoring — start from a fresh empty
  database).
- Clear ownership of the disposable target and an agreed cleanup plan.
- A local backup file, verified to exist and be non-empty.
- The backup file is stored **outside any Git working tree**.
- PostgreSQL client tools (`psql`) installed. (In a GitHub Codespaces
  operator workspace, new/rebuilt Codespaces provide compatible client tools
  automatically — see `docs/codespaces-recovery-workspace.md`.)
- The target connection information kept in a secure **runtime-only** method
  (password manager or platform secret manager → session environment
  variable). No actual credentials are ever entered in this document or
  copied to GitHub.

## Safety gates enforced by the scripts

1. Strict shell error behavior (`set -euo pipefail` / PowerShell
   `$ErrorActionPreference = "Stop"`); every failure exits non-zero and fails
   closed.
2. All three inputs are required: backup file, target label, and the explicit
   disposable-target acknowledgement flag.
3. Backup file must exist, be a regular file, be non-empty, and have a
   `.sql` extension (or the operator must explicitly pass
   `--allow-nonstandard-extension` / `-AllowNonstandardExtension`).
4. The target URL comes **only** from `RESTORE_TARGET_DB_URL`. It is verified
   non-empty without ever being printed. `SUPABASE_DB_URL` (the backup
   *source* variable) is never read as a target, and the script refuses to
   run if the two values are identical.
5. `psql` must exist on `PATH`.
6. The target label must contain one of these case-insensitive terms:

   ```text
   disposable
   test
   rehearsal
   sandbox
   temporary
   ```

   and is rejected if it contains any of:

   ```text
   production
   prod
   canonical
   live
   primary
   oncall-foot
   ```

   **Label checks are defense-in-depth, not proof of target safety.** The
   operator remains responsible for where `RESTORE_TARGET_DB_URL` actually
   points.
7. The script connects and reads only minimal safe metadata (the server major
   version) before doing anything else; if it cannot, it fails closed and
   instructs the operator not to proceed. Optionally,
   `RESTORE_EXPECTED_SERVER_MAJOR` (a plain number such as `17`, never a URL)
   cross-checks the target against the recorded source server major version.
8. After all preflight checks, a second **typed interactive confirmation** is
   required:

   ```text
   Type exactly: RESTORE TO DISPOSABLE TARGET
   ```

   Any other input aborts. Piping the phrase to defeat the interactive
   intent is prohibited.
9. The restore runs via `psql` with `ON_ERROR_STOP=1` **inside a single
   transaction** (`--single-transaction`): on any error the entire restore is
   rolled back, so a failed rehearsal leaves the (empty) disposable target
   unchanged instead of partially restored. `psql` stdout is fully suppressed
   so no SQL contents, credentials, project references, or personal data can
   leak into terminals, logs, or transcripts. `psql` **stderr is captured to a
   private, operator-only error log** written next to the backup file
   (`<backup-file>.restore-error.log`, owner-only permissions) so a failure
   can actually be diagnosed. The log's contents are never printed by the
   script — only its path. It may contain SQL identifiers or hostnames:
   treat it exactly like the backup file itself (never commit it, never paste
   it into chat/tickets/documentation, delete it after diagnosis). The log is
   deleted automatically on success.
10. Post-restore verification is **non-destructive and read-only**: a
    connection check, the server major version, and a count of `public`
    schema tables (schema metadata only — never user records). It is clearly
    labeled a basic technical verification, not full recovery validation.

## Bash example (placeholders only)

```bash
export RESTORE_TARGET_DB_URL='[private disposable target URL]'
bash scripts/restore-supabase-instance-rehearsal.sh \
  --backup-file '/private/path/to/backup.sql' \
  --target-label 'disposable-rehearsal-YYYY-MM-DD' \
  --confirm-disposable-target
unset RESTORE_TARGET_DB_URL
```

## PowerShell example (placeholders only)

```powershell
$env:RESTORE_TARGET_DB_URL = "[private disposable target URL]"
.\scripts\restore-supabase-instance-rehearsal.ps1 `
  -BackupFile "C:\private\path\to\backup.sql" `
  -TargetLabel "disposable-rehearsal-YYYY-MM-DD" `
  -ConfirmDisposableTarget
Remove-Item Env:RESTORE_TARGET_DB_URL
```

## Required process

```text
1. Verify the backup exists and is non-empty.
2. Create/select an empty disposable target under operator control.
3. Set the target URL only for the current local session.
4. Run the guarded script.
5. Complete the second typed confirmation.
6. Record non-secret rehearsal evidence.
7. Independently inspect approved technical checks.
8. Delete the disposable target according to the approved cleanup process.
9. Remove the runtime secret from the environment.
```

## Registry evidence (non-secret metadata only)

Record only safe metadata such as:

```text
instance_id
backup_event_id
backup_method
database_engine_major_version
pg_dump_major_version
backup_artifact_label
artifact_size_bytes
backup_verified_date
restore_rehearsal_status
restore_rehearsal_date
restore_target_label
verification_status
operator_role_label
purpose_code
cleanup_confirmed_date
```

It is **explicitly prohibited** to record:

```text
database URLs
passwords
API keys
Supabase project reference IDs
GitHub/Railway tokens
backup files
backup storage paths
provider/client data
SQL contents
```

## Explicit non-goals of the scripts

The scripts do **not**:

- auto-provision a database;
- auto-detect or auto-connect to production;
- run backup creation;
- store, upload, or download a copy of the backup;
- execute in CI or run unattended;
- run from the provider dashboard or accept a browser-supplied target URL;
- use `SUPABASE_DB_URL` as a target;
- include any production identifier;
- claim a restore is fully validated from a successful `psql` exit code
  alone.

## Warnings (non-negotiable)

```text
Never use a production target.
Never use the OnCall Foot production database as a target.
Never pass a connection string on the command line.
Never commit a backup, connection string, or restore transcript.
Never paste credentials or SQL output into chat, a ticket, or documentation.
Never treat a successful script run as a substitute for full application-level
recovery validation.
```

## Troubleshooting: restore failed with all output suppressed (2026-08-30)

Incident: a rehearsal against a disposable Supabase target passed every
preflight (client 17.5, target major 17, typed confirmation) and then failed
during the `psql` restore. The script at that time discarded **all** psql
output, so the operator had no way to learn the cause, and the
non-transactional restore left the target possibly partially restored.

Hardening (this change):

- `--single-transaction`: any failure now rolls the whole restore back — the
  disposable target is left unchanged, and the rehearsal can be re-run
  against the same still-empty target without re-provisioning.
- Private error log: psql stderr is captured to
  `<backup-file>.restore-error.log` (owner-only permissions, same private
  directory as the backup itself). Review it privately; delete it after
  diagnosis. Never commit or paste it.

Operator recovery path after a pre-fix failed attempt:

```text
1. The pre-fix attempt was NOT transactional: delete and re-provision the
   disposable target once (it may be partially restored).
2. Pull the updated main into the operator workspace.
3. Re-set RESTORE_TARGET_DB_URL for the session (never printed).
4. Re-run the guarded rehearsal.
5. If it fails again: open the printed .restore-error.log privately, fix the
   condition it names, delete the log, re-run (the target stays unchanged).
```

Common causes to check first (generic, non-secret):

```text
- Target not actually empty (SQLSTATE 42P07/42710 "already exists"):
  a previous partial restore, a schema push, or a reused project.
  Remedy: provision a fresh disposable target or empty its public schema
  through the provider's own tooling before rerunning.
- Connection interrupted mid-restore through a pooler: retry; prefer the
  provider's session-mode connection for long-running psql work.
- Client/server major-version mismatch: already blocked by preflight.
```

## Local-safe tests

`scripts/tests/test-restore-rehearsal.sh` exercises every safety gate with a
mocked `psql` on a controlled `PATH` — including the single-transaction
rollback flag, the private error-log capture (path printed, contents never),
and its owner-only permissions. It never contacts any database and uses
only a loopback fixture URL. Run:

```bash
bash scripts/tests/test-restore-rehearsal.sh
```

(companion: `bash scripts/tests/test-backup-preflight.sh` for the backup
version preflight).
