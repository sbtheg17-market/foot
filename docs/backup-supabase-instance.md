# Private Supabase Backup/Export Guide

**Added:** 2026-08-29. Companion tooling for
`docs/canonical-prototype-and-instance-model.md` §H (backup, migration, and
recovery model) and `docs/instance-provisioning-checklist.md`
(Backup/recovery section).

## Purpose

`scripts/backup-supabase-instance.sh` (macOS/Linux/WSL) and
`scripts/backup-supabase-instance.ps1` (Windows PowerShell) create a **local,
private logical backup** of one Foot instance's Supabase PostgreSQL database
as a single timestamped `.sql` file, using standard `pg_dump`.

Use it for:

- the canonical OnCall Foot prototype (required before any Gate-B migration —
  see `docs/managed-db-release-gate.md`);
- every future isolated provider instance (required before any schema change,
  and on a regular cadence when the instance's Supabase plan has no verified
  managed backup coverage — never assume it does).

The script contacts **only** the target database, prints **no secrets**, and
stores **nothing** in the repository. The backup file contains real client
data: it is production-sensitive and must never enter Git, Graphify, shared
documents, sheets, chat, or email.

## Prerequisites

You need the PostgreSQL client tools (`pg_dump` for the dump itself and
`psql` for the version-compatibility preflight) on the machine that runs the
backup:

| Platform | Install |
|---|---|
| macOS | `brew install libpq` then `brew link --force libpq` (or `brew install postgresql@<major>` matching or exceeding the target server's major version) |
| Debian/Ubuntu | `sudo apt-get install postgresql-client` |
| Fedora/RHEL | `sudo dnf install postgresql` |
| Windows | Install "Command Line Tools" from the EDB PostgreSQL installer, or use WSL with the Debian/Ubuntu command above |

Verify: `pg_dump --version` and `psql --version` both print a version number.

GitHub Codespaces (operator recovery workspace): new or rebuilt Codespaces
receive PostgreSQL 17 client tools automatically via the repository
devcontainer bootstrap — see `docs/codespaces-recovery-workspace.md`.
Existing Codespaces must be rebuilt first. The bootstrap is a convenience
layer only; the runtime preflight below remains mandatory.

## PostgreSQL version compatibility (mandatory preflight)

`pg_dump` must be the **same major version as, or newer than**, the target
PostgreSQL server. An older client aborts partway through and produces **no
usable backup** — this failure class has been observed in practice (for
example, a version-16 `pg_dump` against a version-17 server) and is now
rejected before any dump is attempted.

Both scripts therefore run a preflight before creating anything:

1. Confirm `pg_dump` and `psql` exist on `PATH`.
2. Read the local `pg_dump` major version from `pg_dump --version`.
3. Read the target server major version with a minimal `psql` query
   (`SHOW server_version_num;`). Only the version number is read and shown;
   the connection string and any identifying query output are never printed.
4. Compare major versions numerically. An equal or newer client proceeds;
   an older client fails closed:

   ```text
   ERROR: pg_dump major version 16 is older than target PostgreSQL major version 17.
   Install or select PostgreSQL client version 17 or newer, then retry.
   No backup was created.
   ```

If `psql` is missing, the version query fails, or either version string is
malformed, the script also fails closed with a safe message and creates no
backup file.

**Design limitation:** the target server version can only be learned after
connecting to the database. No database mutation occurs during preflight, but
the operator must still run the script only from a trusted environment with
runtime-only secret injection.

## Getting the connection string (Supabase dashboard)

1. Sign in to the Supabase dashboard **for this instance's own project only**.
2. Open the project → **Connect** (or Project Settings → Database).
3. Copy the **Direct connection** PostgreSQL URI (not the pooled/transaction
   URL if a direct one is offered) and substitute the database password where
   the dashboard shows a placeholder.
4. Treat that URI as a secret from this moment on: password manager only.

The URI has this general shape (placeholder values only — yours will differ):

```text
postgresql://postgres:YOUR-DB-PASSWORD@db.example.com:5432/postgres
```

## Setting the environment variable securely

Set the variable **for the current shell session only**. Do not put it in a
committed file, a shell profile in a shared machine, a doc, or a script.

macOS / Linux / WSL:

```bash
export SUPABASE_DB_URL="postgresql://postgres:YOUR-DB-PASSWORD@db.example.com:5432/postgres"
```

Windows PowerShell:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:YOUR-DB-PASSWORD@db.example.com:5432/postgres"
```

Notes:

- `DATABASE_URL` is honored as a fallback only if you set it explicitly for
  this purpose; `SUPABASE_DB_URL` is preferred so a backup can never
  accidentally target whatever `DATABASE_URL` happens to point at.
- On a shared machine, prefer a private terminal session; the leading space
  trick (` export …`) keeps the command out of bash history on most setups.
- Close the terminal (or `unset SUPABASE_DB_URL`) when you are done.
- Run the script on a trusted local machine only.

## Running the backup

macOS / Linux / WSL, from the repository root (or anywhere):

```bash
bash scripts/backup-supabase-instance.sh --output-dir ~/private-backups/instance-a
```

Windows PowerShell:

```powershell
.\scripts\backup-supabase-instance.ps1 -OutputDir C:\PrivateBackups\instance-a
```

Without `--output-dir`/`-OutputDir` the file is written to the current
directory. **Prefer a private directory outside any Git working tree** — the
script warns if it detects it wrote inside one.

Expected output (shape):

```text
Preflight OK: pg_dump major 17 / target PostgreSQL major 17.
Starting logical backup (public schema, plain SQL)…

Backup complete.
  File:      /home/operator/private-backups/instance-a/supabase-backup-2026-08-29-1412.sql
  Size:      1.2M
  Timestamp: 2026-08-29-1412 (UTC)

Next steps:
  1. Move the file to secure private storage …
  2. Open the file and confirm it contains SQL statements.
  3. Update the instance registry: …
```

The script exits non-zero with a clear message if the connection string is
missing, `pg_dump` is not installed, the dump fails, or the output file is
missing/empty. It is safe to re-run — each run produces a new timestamped
file and never overwrites an earlier one.

## Verifying the backup file

1. The script already checks the file exists and is non-empty.
2. Open the first ~50 lines and confirm they are PostgreSQL DDL/SQL:
   ```bash
   head -50 supabase-backup-*.sql
   ```
   You should see `--` comment headers, `CREATE TABLE`, `COPY … FROM stdin`,
   etc.
3. Spot-check that expected tables appear:
   ```bash
   grep -c "CREATE TABLE" supabase-backup-YYYY-MM-DD-HHMM.sql
   ```
4. For real recovery confidence, periodically restore into a **disposable,
   non-production database** using the guarded rehearsal tooling —
   `scripts/restore-supabase-instance-rehearsal.sh` / `.ps1`, guide:
   `docs/restore-supabase-instance-rehearsal.md` (runbook:
   `docs/backup-restore-runbook.md`). A non-empty export alone is **not**
   restore validation; a backup that has never been restore-tested is
   unproven.

## Storing the backup securely

Choose one, per the instance's ownership model:

- an **encrypted drive/volume** (FileVault, BitLocker, LUKS, or an encrypted
  external disk) in the data owner's custody;
- a **password-manager attachment** (suitable for small dumps) in the
  owner's vault;
- a **private, access-controlled backup folder** (owner-controlled encrypted
  cloud storage) — never a shared/public folder.

Retention and deletion follow the same rules as the live data: the provider
owns their client data; delete per the offboarding agreement.

## Recording the backup in the instance registry

After every verified backup, update the instance's registry row
(non-secret metadata only — spec in
`docs/canonical-prototype-and-instance-model.md` §E):

| Registry column | What to record (labels/dates only) |
|---|---|
| `backup_method` | e.g. `pg_dump logical export via scripts/backup-supabase-instance.sh` |
| `backup_verified_date` | Date you confirmed the file is non-empty and readable |
| `backup_artifact_label` | e.g. `supabase-backup-2026-08-29-1412.sql` (filename only) |
| `backup_location_note` | e.g. `owner encrypted drive, backups folder` (never a path that reveals credentials, never a shared link) |

## Warnings (non-negotiable)

- **Never commit the backup file to Git** — it contains real provider/client
  data. Keep output directories outside working trees; heed the script's
  warning if you did not.
- **Never share the connection string.** It is a full-access database
  credential.
- **Never store secrets in docs, Git, Graphify, Sheets, chat, or email.**
  Connection strings and passwords live only in a password manager or the
  platform's native secret manager.
- A fresh backup created by this script is **required before every schema
  change** on any instance (`docs/canonical-prototype-and-instance-model.md`
  §H, `docs/managed-db-release-gate.md`).
- This script does not grant or replace Gate-B authorization; it only
  produces the backup evidence the gate requires.
