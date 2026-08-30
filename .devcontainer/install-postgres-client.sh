#!/usr/bin/env bash
# install-postgres-client.sh — Codespaces/devcontainer bootstrap: install the
# PostgreSQL 17 CLIENT tools (pg_dump, psql) required by the operator-only
# recovery tooling (scripts/backup-supabase-instance.sh,
# scripts/restore-supabase-instance-rehearsal.sh).
#
# CLIENT ONLY: this never installs or starts a PostgreSQL database server.
# NON-SECRET: no connection string, credential, hostname, database name,
# project reference, or backup path appears here or anywhere in the
# devcontainer configuration.
#
# This bootstrap is a convenience layer for NEW or REBUILT Codespaces only.
# The backup script's runtime server/client version preflight remains
# mandatory and fails closed — the managed server major version may move
# beyond this baseline in the future.
# Guide: docs/codespaces-recovery-workspace.md
set -euo pipefail

PG_CLIENT_MAJOR=17

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

export DEBIAN_FRONTEND=noninteractive

# PGDG apt repository using the modern signed-by keyring pattern
# (no deprecated apt-key usage).
$SUDO install -d -m 0755 /usr/share/postgresql-common/pgdg
$SUDO curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc

CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
if [ -z "$CODENAME" ]; then
  echo "ERROR: could not determine the distribution codename for the PGDG repository." >&2
  exit 1
fi
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
  | $SUDO tee /etc/apt/sources.list.d/pgdg.list >/dev/null

$SUDO apt-get update -qq
$SUDO apt-get install -y -qq --no-install-recommends \
  ca-certificates "postgresql-client-${PG_CLIENT_MAJOR}"

# Fail the container bootstrap clearly if a compatible client is not selected.
bash "$(dirname "${BASH_SOURCE[0]}")/verify-postgres-client.sh"
