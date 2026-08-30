#!/usr/bin/env bash
# verify-postgres-client.sh — non-secret verification that PostgreSQL client
# tools compatible with the recovery tooling are the defaults on PATH.
# Prints version numbers only; contacts nothing; exits non-zero (fails the
# container bootstrap) when pg_dump/psql are missing or older than the
# required workspace baseline.
#
# This standardizes the operator recovery WORKSPACE only. It is NOT a
# substitute for the backup script's mandatory runtime preflight, which
# compares the client against the ACTUAL target server major version — the
# managed server may move beyond this baseline in the future.
# Guide: docs/codespaces-recovery-workspace.md
set -euo pipefail

REQUIRED_MAJOR=17

# Prefer the versioned client binaries when present (standard Debian/Ubuntu
# packaging location; no production information is encoded here). The
# FOOT_BOOTSTRAP_VERSIONED_BIN override exists for the local-safe test
# harness only; never set it in devcontainer configuration.
VERSIONED_BIN="${FOOT_BOOTSTRAP_VERSIONED_BIN:-/usr/lib/postgresql/${REQUIRED_MAJOR}/bin}"
if [ -d "$VERSIONED_BIN" ]; then
  PATH="$VERSIONED_BIN:$PATH"
fi

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

major_of() {
  printf '%s\n' "$1" | sed -n 's/^[a-z_]* (PostgreSQL[^)]*) \([0-9][0-9]*\).*/\1/p' | head -n 1
}

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found on PATH."
command -v psql >/dev/null 2>&1 || fail "psql not found on PATH."

PG_DUMP_OUT="$(pg_dump --version)"
PSQL_OUT="$(psql --version)"
echo "$PG_DUMP_OUT"
echo "$PSQL_OUT"

PG_DUMP_MAJOR="$(major_of "$PG_DUMP_OUT")"
PSQL_MAJOR="$(major_of "$PSQL_OUT")"
case "$PG_DUMP_MAJOR" in ''|*[!0-9]*) fail "could not parse the pg_dump major version." ;; esac
case "$PSQL_MAJOR" in ''|*[!0-9]*) fail "could not parse the psql major version." ;; esac

[ "$PG_DUMP_MAJOR" -ge "$REQUIRED_MAJOR" ] \
  || fail "pg_dump major version $PG_DUMP_MAJOR is older than the workspace baseline $REQUIRED_MAJOR. Rebuild the container or install postgresql-client-$REQUIRED_MAJOR."
[ "$PSQL_MAJOR" -ge "$REQUIRED_MAJOR" ] \
  || fail "psql major version $PSQL_MAJOR is older than the workspace baseline $REQUIRED_MAJOR. Rebuild the container or install postgresql-client-$REQUIRED_MAJOR."

echo "OK: PostgreSQL client tools meet the ${REQUIRED_MAJOR}+ workspace baseline."
echo "Reminder: the backup script's runtime preflight against the actual target"
echo "server major version remains mandatory and fails closed."
