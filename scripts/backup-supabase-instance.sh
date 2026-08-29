#!/usr/bin/env bash
# backup-supabase-instance.sh — private logical backup of a Foot instance's
# Supabase PostgreSQL database using pg_dump.
#
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres:...@db.example.com:5432/postgres"
#   scripts/backup-supabase-instance.sh [--output-dir <dir>]
#
# The connection string is read ONLY from the environment (SUPABASE_DB_URL,
# or DATABASE_URL as an explicit operator-set fallback) and is never printed,
# logged, or stored. Output: supabase-backup-YYYY-MM-DD-HHMM.sql in the
# chosen directory. Never commit the backup file to Git.
# Full guide: docs/backup-supabase-instance.md
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: backup-supabase-instance.sh [--output-dir <dir>]

Creates a timestamped plain-SQL logical backup (public schema) of the
Supabase PostgreSQL database identified by the SUPABASE_DB_URL environment
variable (DATABASE_URL is used as a fallback only if you set it explicitly).

Options:
  --output-dir <dir>   Directory for the backup file (default: current
                       directory; created if it does not exist).
  -h, --help           Show this help and exit.

The connection string is never printed or stored by this script.
Store the resulting .sql file in secure private storage only —
NEVER commit it to Git or attach it to shared documents.
EOF
}

OUTPUT_DIR="."
while [ $# -gt 0 ]; do
  case "$1" in
    --output-dir)
      [ $# -ge 2 ] || { echo "ERROR: --output-dir requires a value." >&2; exit 1; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set (and no DATABASE_URL fallback was set)." >&2
  echo "Set it for this shell session only — see docs/backup-supabase-instance.md." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found on PATH." >&2
  echo "Install the PostgreSQL client tools first" >&2
  echo "(docs/backup-supabase-instance.md → Prerequisites)." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

STAMP="$(date -u +%Y-%m-%d-%H%M)"
OUT_FILE="$OUTPUT_DIR/supabase-backup-$STAMP.sql"
# Safe to re-run: never overwrite an earlier backup from the same minute.
if [ -e "$OUT_FILE" ]; then
  STAMP="$(date -u +%Y-%m-%d-%H%M%S)"
  OUT_FILE="$OUTPUT_DIR/supabase-backup-$STAMP.sql"
fi

echo "Starting logical backup (public schema, plain SQL)…"
if ! pg_dump \
  --dbname="$DB_URL" \
  --schema=public \
  --format=plain \
  --no-owner \
  --no-privileges \
  --file="$OUT_FILE"; then
  echo "ERROR: pg_dump failed — no usable backup was produced." >&2
  rm -f "$OUT_FILE"
  exit 1
fi

if [ ! -s "$OUT_FILE" ]; then
  echo "ERROR: backup file is missing or empty: $OUT_FILE" >&2
  exit 1
fi

SIZE="$(du -h "$OUT_FILE" | cut -f1)"

if command -v git >/dev/null 2>&1 \
  && git -C "$OUTPUT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "WARNING: the backup file was written inside a Git working tree." >&2
  echo "         Move it to private storage now and NEVER commit it." >&2
fi

echo
echo "Backup complete."
echo "  File:      $OUT_FILE"
echo "  Size:      $SIZE"
echo "  Timestamp: $STAMP (UTC)"
echo
echo "Next steps:"
echo "  1. Move the file to secure private storage (encrypted drive or"
echo "     password-manager attachment). Never commit it to Git."
echo "  2. Open the file and confirm it contains SQL statements."
echo "  3. Update the instance registry: backup_method, backup_verified_date,"
echo "     backup_artifact_label, backup_location_note."
