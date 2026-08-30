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
.devcontainer/ensure-user-home.sh
.devcontainer/install-postgres-client.sh
.devcontainer/verify-postgres-client.sh
```

At Codespace creation/rebuild:

0. Both lifecycle commands first run `ensure-user-home.sh` (added 2026-08-30
   after a recovery-mode incident — see the troubleshooting section below).
   It derives the **active** lifecycle user and home directory at runtime
   (account database entry for the active uid, then `$HOME`), creates or
   repairs the home directory when needed (sudo only when required and
   available), pre-creates the first-run-notice configuration path, and
   fails closed with a clear error when the home cannot be made usable.
   No user name or home path is hard-coded anywhere in the devcontainer
   configuration: the base image's own default user metadata is used as-is,
   and this repository defines no `remoteUser`, `containerUser`, custom
   user, or forced `HOME`/`USER` value.
1. `onCreateCommand` then runs `install-postgres-client.sh`, which detects the
   base distribution codename from `/etc/os-release` (the Codespaces
   universal image is Ubuntu 22.04 "jammy"), configures the PGDG apt
   repository (modern `signed-by` keyring — no deprecated `apt-key`), then
   noninteractively installs `postgresql-client-17` (client packages only,
   `--no-install-recommends`; no server package, nothing started).
   Reliability behavior (added 2026-08-30 after a real Codespace creation
   failure): any **preexisting** `apt.postgresql.org` entry shipped by the
   base image is disabled first — two entries for the same repository with
   different `signed-by` keyrings make `apt-get update` fail hard
   ("Conflicting values set for option Signed-By") and previously sent the
   Codespace into recovery mode. The full index refresh is best-effort so
   unrelated broken repositories in the base image cannot break the
   bootstrap; only the PGDG index refresh is mandatory. The bootstrap is
   idempotent across rebuilds.
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

## Troubleshooting: recovery mode from home-directory initialization

Incident (2026-08-30): a Codespace entered recovery mode during setup with:

```text
mkdir: cannot create directory '/home/codespace': Permission denied
touch: cannot touch '/home/codespace/.config/vscode-dev-containers/first-run-notice-already-displayed':
No such file or directory
```

Diagnosis (from the published `mcr.microsoft.com/devcontainers/universal:2`
image metadata — read-only registry inspection, nothing executed against any
live system):

- The image itself declares `containerUser: codespace` and
  `remoteUser: codespace` in its embedded devcontainer metadata and ships
  that user's home directory. This repository's devcontainer configuration
  has never set `remoteUser`, `containerUser`, `USER`, or `HOME` — the image
  defaults are (and remain) the supported configuration.
- The failure mode is a **fixed-home assumption**: container setup wrote
  first-run state under `/home/codespace` while that directory was missing
  or not writable for the active non-root user (`/home` is root-owned, so a
  non-root user cannot create its own home there). `mkdir` fails with
  `Permission denied`, the marker `touch` then fails with
  `No such file or directory`, setup is marked failed, and Codespaces falls
  back to recovery mode.

Hardening (this repository's mitigation — the only part in our control):

- `ensure-user-home.sh` runs **before** any other lifecycle step in both
  `onCreateCommand` and `postCreateCommand`. It never assumes the user is
  `codespace` or that the home is `/home/codespace`; it resolves the active
  user's real home at runtime, creates/repairs it when possible, pre-creates
  `~/.config/vscode-dev-containers`, and fails closed with an explicit
  message otherwise — so the later bootstrap steps never depend on an
  unwritable fixed home path.
- No custom user is created anywhere (image/container initialization or
  lifecycle commands); the base image's default user is used unchanged.

If a Codespace still lands in recovery mode, open the creation log
(Command Palette → "Codespaces: View Creation Log") and look for the first
`ERROR:` line from the bootstrap scripts — each failure path prints one.
Then do a Full Rebuild (Command Palette → "Codespaces: Full Rebuild
Container") after the fix is merged.

## Local-safe tests

`scripts/tests/test-ensure-user-home.sh` exercises the home preflight with
sandboxed home paths (the real home directory is never read or modified):
active user/home detection, creation of a missing home, writable-home
verification and repair, idempotent reruns, `$HOME` fallback when the
account database is unavailable, fail-closed behavior for uncreatable or
relative or unresolvable homes, plus static guards asserting the
devcontainer configuration hard-codes no `/home/codespace` path, defines no
`remoteUser`/`containerUser`/`HOME`/`USER` override, runs the preflight
first in both lifecycle commands, and keeps PostgreSQL 17 PATH precedence
via `${containerEnv:PATH}`. Run:

```bash
bash scripts/tests/test-ensure-user-home.sh
```

`scripts/tests/test-codespaces-bootstrap.sh` exercises the bootstrap logic
with mocked `apt-get`/`curl` and sandboxed paths (no packages installed, no
repository contacted): Ubuntu 22.04 codename handling, preexisting
conflicting PGDG entries, idempotent reruns, unrelated-broken-repo
tolerance, mandatory PGDG refresh failure, and all verifier gates
(missing tools, version 16 rejection, 17/18 acceptance, malformed versions,
no secret output). Run:

```bash
bash scripts/tests/test-codespaces-bootstrap.sh
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
