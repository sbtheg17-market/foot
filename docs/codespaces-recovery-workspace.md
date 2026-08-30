# Codespaces Recovery Workspace — PostgreSQL Client Bootstrap

**Added:** 2026-08-29. Companion to
`docs/provider-export-and-recovery-backup-architecture.md` (§5),
`docs/backup-supabase-instance.md`, and
`docs/restore-supabase-instance-rehearsal.md`.

## Purpose

GitHub Codespaces may serve as a **trusted, temporary operator workspace**
for the manual recovery tooling (backup and disposable restore rehearsal).
This repository's devcontainer configuration standardizes that workspace so
that every **new or rebuilt** Codespace automatically provides PostgreSQL
**client** tools compatible with the recovery workflow — no repeated manual
installation.

Scope is deliberately narrow:

```text
PostgreSQL client tools only (pg_dump, psql) — never a database server.
Operator recovery workspace only — never application production hosting.
```

Motivating generic failure class: a default workspace supplied `pg_dump`
major version 16 while the managed server was major version 17. The backup
preflight correctly failed closed, but the operator had to install client
tools by hand. The bootstrap removes that repeated manual setup.

```text
Codespaces client bootstrap is a convenience layer.
The backup script's runtime server/client version preflight remains mandatory.
```

## How the bootstrap works

Files:

```text
.devcontainer/devcontainer.json
.devcontainer/install-postgres-client.sh
.devcontainer/verify-postgres-client.sh
```

At Codespace creation/rebuild:

1. `onCreateCommand` runs `install-postgres-client.sh`, which configures the
   PGDG apt repository (modern `signed-by` keyring — no deprecated `apt-key`),
   then noninteractively installs `postgresql-client-17` (client packages
   only, `--no-install-recommends`; no server package, nothing started).
2. PostgreSQL 17 client binaries take PATH precedence two ways:
   `devcontainer.json` prepends `/usr/lib/postgresql/17/bin` via `remoteEnv`,
   and Debian/Ubuntu's `postgresql-common` wrapper selects the newest
   installed client by default.
3. `postCreateCommand` runs `verify-postgres-client.sh`, which prints only
   version numbers and **fails the bootstrap (non-zero)** if `pg_dump` or
   `psql` is missing or older than the version-17 workspace baseline.

No database URL, Supabase key, SQL file, Codespaces secret, backup output, or
project identifier appears anywhere in the devcontainer configuration, and
none may ever be added to it.

## Verifying the client tools (operator)

```bash
pg_dump --version
psql --version
```

Expected condition: **PostgreSQL 17 or newer.** You can also re-run the
bundled check at any time:

```bash
bash .devcontainer/verify-postgres-client.sh
```

No claim is made that version 17 will remain sufficient forever. The backup
script remains the ultimate runtime check: it compares the local client
against the **actual** target server major version at run time and fails
closed if the client is older — including any future server major upgrade.

## New vs. existing Codespaces

- **New or rebuilt** Codespaces created from `main` after this change receive
  the bootstrap automatically.
- **Existing** Codespaces do **not** automatically receive it. After this
  change is merged, either rebuild the current container
  (Command Palette → "Codespaces: Rebuild Container") or create a fresh
  Codespace from `main`.
- Either way, the backup script still checks the actual server major version
  and fails closed when a client upgrade is needed.

## Boundaries (unchanged)

Codespaces is **transitional operator tooling** — not a provider UI, not
backup artifact storage, not application hosting, and not a secrets or
document vault. The full transitional pattern and its conditions are defined
in `docs/provider-export-and-recovery-backup-architecture.md` §5.

Prohibited, always:

```text
Saving SQL files in the repository.
Committing dumps or restore transcripts.
Printing connection strings.
Storing credentials in devcontainer configuration.
Using provider dashboard flows for recovery.
Leaving dumps or secrets in a Codespace after use.
```

## Cleanup checklist (after any recovery run)

```text
1. Download/store the backup in private encrypted storage.
2. Delete the Codespace copy of the dump.
3. Unset/delete the temporary secret (environment variable and any
   Codespaces secret), or rotate it.
4. Stop/delete the temporary Codespace if appropriate.
5. Record non-secret metadata only (see
   docs/restore-supabase-instance-rehearsal.md registry evidence).
```
