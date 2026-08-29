#!/usr/bin/env bash
# Local-safe tests for the version-compatibility preflight in
# scripts/backup-supabase-instance.sh.
#
# Every external command (pg_dump, psql) is a mock on a controlled PATH.
# No live or managed database is ever contacted, and no real URL, password,
# token, project ID, or customer record appears anywhere in this harness.
# The only connection string is a loopback fixture value.
#
# Run: bash scripts/tests/test-backup-preflight.sh
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/backup-supabase-instance.sh"
# Fixture-only loopback URL (allowed by scripts/secret-scan.sh; never a real host).
FIXTURE_URL='postgresql://postgres:postgres@127.0.0.1:5432/scratch'

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# Minimal clean PATH of core utilities so any real pg_dump/psql on this
# machine can never be reached by accident.
CLEAN_BIN="$TMP_ROOT/clean-bin"
mkdir -p "$CLEAN_BIN"
for tool in bash sh env sed grep head tr date mkdir du cut rm cat ls basename dirname; do
  src="$(command -v "$tool" 2>/dev/null || true)"
  [ -n "$src" ] && ln -s "$src" "$CLEAN_BIN/$tool"
done

PASS=0
FAIL=0
CASE_BIN=""
CASE_NAME=""
OUT_DIR=""
OUTPUT=""
STATUS=0

new_case() {
  CASE_NAME="$1"
  CASE_BIN="$TMP_ROOT/bin-$CASE_NAME"
  OUT_DIR="$TMP_ROOT/out-$CASE_NAME"
  mkdir -p "$CASE_BIN" "$OUT_DIR"
}

write_mock_pg_dump() { # $1 = "ok:<major>" | "garbage"
  local mode="$1"
  {
    printf '#!/usr/bin/env bash\n'
    printf 'if [ "${1:-}" = "--version" ]; then\n'
    case "$mode" in
      ok:*)    printf '  echo "pg_dump (PostgreSQL) %s.2"\n' "${mode#ok:}" ;;
      garbage) printf '  echo "not a version line"\n' ;;
    esac
    printf '  exit 0\nfi\n'
    printf 'out=""\n'
    printf 'for a in "$@"; do case "$a" in --file=*) out="${a#--file=}" ;; esac; done\n'
    printf 'if [ -n "$out" ]; then printf -- "-- mock plain-SQL dump\\nCREATE TABLE mock_only (id integer);\\n" > "$out"; fi\n'
    printf 'exit 0\n'
  } > "$CASE_BIN/pg_dump"
  chmod +x "$CASE_BIN/pg_dump"
}

write_mock_psql() { # $1 = "num:<server_version_num>" | "fail" | "garbage"
  local mode="$1"
  case "$mode" in
    num:*)   printf '#!/usr/bin/env bash\necho "%s"\nexit 0\n' "${mode#num:}" > "$CASE_BIN/psql" ;;
    fail)    printf '#!/usr/bin/env bash\nexit 2\n' > "$CASE_BIN/psql" ;;
    garbage) printf '#!/usr/bin/env bash\necho "totally unexpected"\nexit 0\n' > "$CASE_BIN/psql" ;;
  esac
  chmod +x "$CASE_BIN/psql"
}

run_backup() { # $1 = URL fixture value, or "" for no variable
  local url="$1"
  if [ -n "$url" ]; then
    OUTPUT="$(env -i PATH="$CASE_BIN:$CLEAN_BIN" SUPABASE_DB_URL="$url" \
      bash "$SCRIPT" --output-dir "$OUT_DIR" 2>&1)"
  else
    OUTPUT="$(env -i PATH="$CASE_BIN:$CLEAN_BIN" \
      bash "$SCRIPT" --output-dir "$OUT_DIR" 2>&1)"
  fi
  STATUS=$?
}

check() { # $1 desc, $2 zero|nonzero, $3 required substring (optional)
  local desc="$1" want="$2" substr="${3:-}"
  local ok=1
  if [ "$want" = "zero" ] && [ "$STATUS" -ne 0 ]; then ok=0; fi
  if [ "$want" = "nonzero" ] && [ "$STATUS" -eq 0 ]; then ok=0; fi
  if [ -n "$substr" ] && ! printf '%s' "$OUTPUT" | grep -Fq -- "$substr"; then ok=0; fi
  # Secret-safety invariant: the fixture URL/credentials never appear in output.
  if printf '%s' "$OUTPUT" | grep -Fq 'postgres:postgres@127.0.0.1'; then
    ok=0; desc="$desc (fixture URL leaked into output)"
  fi
  if [ "$ok" -eq 1 ]; then
    PASS=$((PASS + 1)); echo "PASS: $desc"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $desc (status=$STATUS)"
    printf '%s\n' "$OUTPUT" | sed 's/^/    /'
  fi
}

no_dump_created() { # $1 desc — asserts no .sql file exists in OUT_DIR
  if ls "$OUT_DIR"/*.sql >/dev/null 2>&1; then
    FAIL=$((FAIL + 1)); echo "FAIL: $1 (a dump file was created)"
  else
    PASS=$((PASS + 1)); echo "PASS: $1"
  fi
}

dump_created_nonempty() { # $1 desc
  local f
  f="$(ls "$OUT_DIR"/*.sql 2>/dev/null | head -n 1)"
  if [ -n "$f" ] && [ -s "$f" ]; then
    PASS=$((PASS + 1)); echo "PASS: $1"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $1 (no non-empty dump file found)"
  fi
}

echo "== backup preflight tests (mocked pg_dump/psql; no database contacted) =="

new_case "missing-pg-dump"
write_mock_psql num:170004
run_backup "$FIXTURE_URL"
check "missing pg_dump fails" nonzero "pg_dump not found"
no_dump_created "missing pg_dump creates no dump"

new_case "missing-psql"
write_mock_pg_dump ok:17
run_backup "$FIXTURE_URL"
check "missing psql fails" nonzero "psql not found"
no_dump_created "missing psql creates no dump"

new_case "missing-url"
write_mock_pg_dump ok:17
write_mock_psql num:170004
run_backup ""
check "missing SUPABASE_DB_URL fails" nonzero "SUPABASE_DB_URL is not set"

new_case "malformed-local-version"
write_mock_pg_dump garbage
write_mock_psql num:170004
run_backup "$FIXTURE_URL"
check "malformed local pg_dump version fails" nonzero "local pg_dump major version"
no_dump_created "malformed local version creates no dump"

new_case "malformed-target-version"
write_mock_pg_dump ok:17
write_mock_psql garbage
run_backup "$FIXTURE_URL"
check "malformed target version fails closed" nonzero "target PostgreSQL server major version"
no_dump_created "malformed target version creates no dump"

new_case "target-version-query-failure"
write_mock_pg_dump ok:17
write_mock_psql fail
run_backup "$FIXTURE_URL"
check "target version query failure fails closed" nonzero "target PostgreSQL server major version"
no_dump_created "target query failure creates no dump"

new_case "client-16-server-17"
write_mock_pg_dump ok:16
write_mock_psql num:170004
run_backup "$FIXTURE_URL"
check "pg_dump 16 vs server 17 fails before dump" nonzero \
  "pg_dump major version 16 is older than target PostgreSQL major version 17"
check "older-client message says no backup was created" nonzero "No backup was created"
no_dump_created "older client creates no dump"

new_case "client-17-server-17"
write_mock_pg_dump ok:17
write_mock_psql num:170004
run_backup "$FIXTURE_URL"
check "pg_dump 17 vs server 17 is allowed" zero "Preflight OK: pg_dump major 17 / target PostgreSQL major 17"
check "equal-version backup completes" zero "Backup complete."
dump_created_nonempty "equal-version run produced a non-empty dump"

new_case "client-18-server-17"
write_mock_pg_dump ok:18
write_mock_psql num:170004
run_backup "$FIXTURE_URL"
check "pg_dump 18 vs server 17 is allowed" zero "Preflight OK: pg_dump major 18 / target PostgreSQL major 17"
dump_created_nonempty "newer-client run produced a non-empty dump"

echo
echo "Results: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
