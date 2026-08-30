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
# Reliability notes (Ubuntu 22.04 Codespaces universal image):
# - The base image already ships its own PGDG apt entry with a different
#   signed-by keyring. Two entries for the same repository with different
#   keyrings make 'apt-get update' fail hard ("Conflicting values set for
#   option Signed-By"), so preexisting apt.postgresql.org entries are
#   disabled before the canonical entry is written. Idempotent on rebuild.
# - Unrelated broken repositories in the base image must not break this
#   bootstrap: the full index refresh is best-effort, and only the PGDG
#   index refresh is mandatory.
#
# This bootstrap is a convenience layer for NEW or REBUILT Codespaces only.
# The backup script's runtime server/client version preflight remains
# mandatory and fails closed — the managed server major version may move
# beyond this baseline in the future.
# Guide: docs/codespaces-recovery-workspace.md
set -euo pipefail

PG_CLIENT_MAJOR=17

# Test-only sandbox overrides (defaults are the real system paths; never set
# these in devcontainer configuration). Used by
# scripts/tests/test-codespaces-bootstrap.sh.
APT_DIR="${FOOT_BOOTSTRAP_APT_DIR:-/etc/apt}"
PGDG_KEY_DIR="${FOOT_BOOTSTRAP_PGDG_KEY_DIR:-/usr/share/postgresql-common/pgdg}"
OS_RELEASE_FILE="${FOOT_BOOTSTRAP_OS_RELEASE:-/etc/os-release}"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  printf 'Codespaces bootstrap failed: PostgreSQL client tools were not installed.\n' >&2
  exit 1
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || fail "sudo is required for package installation but was not found."
  SUDO="sudo"
fi

command -v curl >/dev/null 2>&1 || fail "curl is required to fetch the PGDG signing key but was not found."
command -v apt-get >/dev/null 2>&1 || fail "apt-get not found; this bootstrap supports Debian/Ubuntu-based dev containers only."

export DEBIAN_FRONTEND=noninteractive

# Detect the actual base distribution codename (e.g. jammy on Ubuntu 22.04,
# bookworm on Debian 12) instead of assuming a distribution.
CODENAME="$(. "$OS_RELEASE_FILE" && echo "${VERSION_CODENAME:-}")"
[ -n "$CODENAME" ] || fail "could not determine the distribution codename from $OS_RELEASE_FILE."

KEY_FILE="$PGDG_KEY_DIR/apt.postgresql.org.asc"
LIST_FILE="$APT_DIR/sources.list.d/pgdg.list"

# PGDG signing key via the modern signed-by keyring pattern (no deprecated
# apt-key usage).
$SUDO install -d -m 0755 "$PGDG_KEY_DIR"
$SUDO curl -fsSL -o "$KEY_FILE" https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  || fail "could not download the PGDG repository signing key."

# Disable every preexisting apt.postgresql.org entry except the canonical
# list file this bootstrap owns, then write exactly one canonical entry.
# This prevents the fatal Signed-By conflict on images that already ship a
# PGDG entry (such as the Codespaces universal image). Safe to re-run.
$SUDO install -d -m 0755 "$APT_DIR/sources.list.d"
for f in "$APT_DIR"/sources.list.d/*.list "$APT_DIR"/sources.list.d/*.sources; do
  [ -e "$f" ] || continue
  [ "$f" = "$LIST_FILE" ] && continue
  if grep -qs 'apt\.postgresql\.org' "$f"; then
    $SUDO mv "$f" "$f.disabled-by-foot-bootstrap"
    echo "Disabled preexisting PGDG apt entry: $f (avoids apt Signed-By conflict)"
  fi
done
if grep -qsE '^[[:space:]]*deb.*apt\.postgresql\.org' "$APT_DIR/sources.list" 2>/dev/null; then
  $SUDO sed -i -E 's|^([[:space:]]*deb.*apt\.postgresql\.org)|# disabled by foot bootstrap: \1|' "$APT_DIR/sources.list"
  echo "Commented preexisting PGDG entry in sources.list (avoids apt Signed-By conflict)"
fi

echo "deb [signed-by=$KEY_FILE] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
  | $SUDO tee "$LIST_FILE" >/dev/null

# Refresh package indexes. The full refresh is best-effort only — unrelated
# broken repositories in the base image must not break this bootstrap. The
# PGDG index refresh below is mandatory and fails the bootstrap clearly.
$SUDO apt-get update -qq \
  || echo "WARNING: full 'apt-get update' reported errors from unrelated repositories; continuing with the PGDG index only." >&2
$SUDO apt-get update -qq \
  -o Dir::Etc::sourcelist="$LIST_FILE" \
  -o Dir::Etc::sourceparts="-" \
  -o APT::Get::List-Cleanup="0" \
  || fail "could not refresh the PGDG package index for ${CODENAME}-pgdg."

$SUDO apt-get install -y -qq --no-install-recommends "postgresql-client-${PG_CLIENT_MAJOR}" \
  || fail "could not install postgresql-client-${PG_CLIENT_MAJOR} (client tools only; no server)."

# Fail the container bootstrap clearly if a compatible client is not selected.
bash "$(dirname "${BASH_SOURCE[0]}")/verify-postgres-client.sh"
