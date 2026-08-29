#!/usr/bin/env bash
# restore-supabase-instance-rehearsal.sh — operator-only restore REHEARSAL of
# a local plain-SQL backup into an explicitly DISPOSABLE, NON-PRODUCTION
# PostgreSQL target, using psql.
#
# This is not a production restore workflow. It exists to prove that a backup
# artifact can be restored at all. It must never be called from application
# runtime code, a provider/vendor dashboard, CI, or unattended automation, and
# it never uses GitHub, Railway, Supabase dashboard APIs, or artifact storage.
#
# The target URL is read ONLY from RESTORE_TARGET_DB_URL (never
# SUPABASE_DB_URL, never a CLI argument) and is never printed, logged, or
# stored. Begin with a newly provisioned EMPTY disposable target: this script
# never drops, truncates, resets, alters, or migrates the target before
# restoring. Full guide: docs/restore-supabase-instance-rehearsal.md
set -euo pipefail

CONFIRM_PHRASE="RESTORE TO DISPOSABLE TARGET"

usage() {
  cat <<'EOF'
Usage: restore-supabase-instance-rehearsal.sh \
         --backup-file PATH \
         --target-label LABEL \
         --confirm-disposable-target \
         [--allow-nonstandard-extension]

Operator-only restore REHEARSAL into a disposable, non-production PostgreSQL
target. The target URL is read only from the RESTORE_TARGET_DB_URL
environment variable and is never printed.

Required:
  --backup-file PATH             Local plain-SQL backup file to restore.
  --target-label LABEL           Operator label for the target. Must contain
                                 one of: disposable, test, rehearsal, sandbox,
                                 temporary. Labels containing production,
                                 prod, canonical, live, primary, or
                                 oncall-foot are rejected. Label checks are
                                 defense-in-depth, not proof of target safety.
  --confirm-disposable-target    Explicit acknowledgement that the target is
                                 a separately provisioned disposable database.

Optional:
  --allow-nonstandard-extension  Accept a backup file without a .sql
                                 extension (only if you are certain it is a
                                 plain-SQL dump).
  -h, --help                     Show this help and exit.

A second typed confirmation is required after all preflight checks pass.
Start from a newly provisioned EMPTY disposable target under operator
control. Never use a production database. Delete the disposable target after
verification. See docs/restore-supabase-instance-rehearsal.md.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  printf 'The rehearsal fails closed: do not proceed until the condition is fixed.\n' >&2
  exit 1
}

BACKUP_FILE=""
TARGET_LABEL=""
CONFIRM_FLAG=0
ALLOW_NONSTANDARD_EXT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --backup-file)
      [ $# -ge 2 ] || fail "--backup-file requires a value."
      BACKUP_FILE="$2"; shift 2 ;;
    --target-label)
      [ $# -ge 2 ] || fail "--target-label requires a value."
      TARGET_LABEL="$2"; shift 2 ;;
    --confirm-disposable-target) CONFIRM_FLAG=1; shift ;;
    --allow-nonstandard-extension) ALLOW_NONSTANDARD_EXT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "unknown argument: $1" ;;
  esac
done

[ -n "$BACKUP_FILE" ] || { usage >&2; fail "--backup-file is required."; }
[ -n "$TARGET_LABEL" ] || { usage >&2; fail "--target-label is required."; }
[ "$CONFIRM_FLAG" -eq 1 ] || { usage >&2; fail "--confirm-disposable-target is required."; }

[ -e "$BACKUP_FILE" ] || fail "backup file does not exist: $BACKUP_FILE"
[ -f "$BACKUP_FILE" ] || fail "backup path is not a regular file: $BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail "backup file is empty: $BACKUP_FILE"

case "$BACKUP_FILE" in
  *.sql|*.SQL) : ;;
  *)
    [ "$ALLOW_NONSTANDARD_EXT" -eq 1 ] \
      || fail "backup file does not have a .sql extension. Pass --allow-nonstandard-extension only if you are certain it is a plain-SQL dump."
    ;;
esac

# Target URL: environment only, never printed. SUPABASE_DB_URL (the backup
# SOURCE variable) is deliberately never read as a target.
if [ -z "${RESTORE_TARGET_DB_URL:-}" ]; then
  fail "RESTORE_TARGET_DB_URL is not set. Set it for this shell session only (see docs/restore-supabase-instance-rehearsal.md)."
fi

# Defense-in-depth: refuse if the rehearsal target equals the backup-source
# variable, which would mean the operator pointed the rehearsal at the live
# instance. Neither value is printed.
if [ -n "${SUPABASE_DB_URL:-}" ] && [ "$SUPABASE_DB_URL" = "$RESTORE_TARGET_DB_URL" ]; then
  fail "RESTORE_TARGET_DB_URL matches SUPABASE_DB_URL. The rehearsal target must never be the backup source. Provision a separate disposable target."
fi

command -v psql >/dev/null 2>&1 \
  || fail "psql not found on PATH. Install the PostgreSQL client tools first (docs/backup-supabase-instance.md → Prerequisites)."

# Target-label denylist/allowlist. Defense-in-depth only: a compliant label is
# NOT proof the target is safe — the operator remains responsible for where
# RESTORE_TARGET_DB_URL actually points.
LABEL_LC="$(printf '%s' "$TARGET_LABEL" | tr '[:upper:]' '[:lower:]')"
for banned in production prod canonical live primary oncall-foot; do
  case "$LABEL_LC" in
    *"$banned"*) fail "target label contains the prohibited term '$banned'. This tool never restores to production-like targets." ;;
  esac
done
LABEL_OK=0
for required in disposable test rehearsal sandbox temporary; do
  case "$LABEL_LC" in
    *"$required"*) LABEL_OK=1 ;;
  esac
done
[ "$LABEL_OK" -eq 1 ] \
  || fail "target label must contain one of: disposable, test, rehearsal, sandbox, temporary."

# Safe, minimal target metadata: connection check + server major version only.
# Neither the URL nor any identifying query output is ever printed.
TARGET_VERSION_NUM="$( { psql --dbname="$RESTORE_TARGET_DB_URL" --no-psqlrc \
  --quiet --tuples-only --no-align --command='SHOW server_version_num;' \
  2>/dev/null || true; } | tr -d '[:space:]')"
case "$TARGET_VERSION_NUM" in
  ''|*[!0-9]*)
    fail "could not connect to the rehearsal target or read its server version. Verify the disposable target and RESTORE_TARGET_DB_URL in your secure runtime environment. Nothing was restored."
    ;;
esac
TARGET_MAJOR=$((TARGET_VERSION_NUM / 10000))

# Optional non-secret source hint: if the operator recorded the source server
# major version during the backup, it can be cross-checked here. Never a URL.
if [ -n "${RESTORE_EXPECTED_SERVER_MAJOR:-}" ]; then
  case "$RESTORE_EXPECTED_SERVER_MAJOR" in
    ''|*[!0-9]*) fail "RESTORE_EXPECTED_SERVER_MAJOR must be a plain major version number (for example 17)." ;;
  esac
  if [ "$TARGET_MAJOR" -lt "$RESTORE_EXPECTED_SERVER_MAJOR" ]; then
    fail "rehearsal target PostgreSQL major version $TARGET_MAJOR is older than the expected source major version $RESTORE_EXPECTED_SERVER_MAJOR. Provision a disposable target at the source major version or newer."
  fi
fi

BACKUP_BASENAME="$(basename "$BACKUP_FILE")"
BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"

echo
echo "Restore rehearsal preflight passed. Review before continuing:"
echo "  Backup file:   $BACKUP_BASENAME ($BACKUP_SIZE)"
echo "  Target label:  $TARGET_LABEL"
echo "  Target server: PostgreSQL major version $TARGET_MAJOR"
echo "  Target URL:    (read from RESTORE_TARGET_DB_URL — never printed)"
echo
echo "This restores into the operator-labeled DISPOSABLE target only."
echo "The target should be a newly provisioned EMPTY database; this script"
echo "never deletes, truncates, drops, or alters the target before restoring."
echo "If there is any doubt the target is disposable, abort now."
echo
echo "Type exactly: $CONFIRM_PHRASE"
printf '> '
IFS= read -r CONFIRM_INPUT || CONFIRM_INPUT=""
if [ "$CONFIRM_INPUT" != "$CONFIRM_PHRASE" ]; then
  fail "confirmation phrase did not match. Nothing was restored."
fi

echo
echo "Restoring backup into the disposable target…"
# psql output is fully suppressed so no SQL contents, identifiers, hostnames,
# or data can leak into the terminal, logs, or transcripts.
if ! psql --dbname="$RESTORE_TARGET_DB_URL" --no-psqlrc --quiet \
  --set ON_ERROR_STOP=1 --file="$BACKUP_FILE" >/dev/null 2>&1; then
  fail "psql reported a failure during the restore (output suppressed to avoid exposing SQL or identifiers). The disposable target may be partially restored: delete and re-provision it before retrying."
fi

# Non-destructive, read-only technical verification. This is a basic
# technical verification only — NOT full application-level recovery
# validation.
VERIFY_VERSION_NUM="$( { psql --dbname="$RESTORE_TARGET_DB_URL" --no-psqlrc \
  --quiet --tuples-only --no-align --command='SHOW server_version_num;' \
  2>/dev/null || true; } | tr -d '[:space:]')"
case "$VERIFY_VERSION_NUM" in
  ''|*[!0-9]*) fail "post-restore verification could not re-connect to the disposable target. Treat the rehearsal as unverified." ;;
esac
PUBLIC_TABLE_COUNT="$( { psql --dbname="$RESTORE_TARGET_DB_URL" --no-psqlrc \
  --quiet --tuples-only --no-align \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  2>/dev/null || true; } | tr -d '[:space:]')"
case "$PUBLIC_TABLE_COUNT" in
  ''|*[!0-9]*) fail "post-restore verification could not count public schema tables. Treat the rehearsal as unverified." ;;
esac

echo
echo "Basic technical verification only (not full recovery validation):"
echo "  Connection:           OK"
echo "  Server major version: $((VERIFY_VERSION_NUM / 10000))"
echo "  public schema tables: $PUBLIC_TABLE_COUNT"
echo
echo "Restore rehearsal completed against the operator-labeled disposable target."
echo "Record non-secret metadata only."
echo "Do not treat this target as production."
echo "Delete the disposable target according to the runbook when verification is complete."
