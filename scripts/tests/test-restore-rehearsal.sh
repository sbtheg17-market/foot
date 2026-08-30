#!/usr/bin/env bash
# Local-safe tests for the guarded restore rehearsal script
# scripts/restore-supabase-instance-rehearsal.sh.
#
# psql is a mock on a controlled PATH. No live or managed database is ever
# contacted, and no real URL, password, token, project ID, or customer record
# appears anywhere in this harness. The only connection string is a loopback
# fixture value.
#
# Run: bash scripts/tests/test-restore-rehearsal.sh
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/restore-supabase-instance-rehearsal.sh"
# Fixture-only loopback URL (allowed by scripts/secret-scan.sh; never a real host).
FIXTURE_URL='postgresql://postgres:postgres@127.0.0.1:5432/scratch'
CONFIRM_PHRASE='RESTORE TO DISPOSABLE TARGET'

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# Minimal clean PATH of core utilities so any real psql on this machine can
# never be reached by accident.
CLEAN_BIN="$TMP_ROOT/clean-bin"
mkdir -p "$CLEAN_BIN"
for tool in bash sh env sed grep head tr date mkdir du cut rm cat ls basename dirname awk; do
  src="$(command -v "$tool" 2>/dev/null || true)"
  [ -n "$src" ] && ln -s "$src" "$CLEAN_BIN/$tool"
done

GOOD_BACKUP="$TMP_ROOT/fixture-backup.sql"
printf -- '-- fixture plain-SQL dump (mock content only)\nSELECT 1;\n' > "$GOOD_BACKUP"
EMPTY_BACKUP="$TMP_ROOT/fixture-empty.sql"
: > "$EMPTY_BACKUP"
ODD_EXT_BACKUP="$TMP_ROOT/fixture-backup.dump"
printf -- '-- fixture plain-SQL dump (mock content only)\nSELECT 1;\n' > "$ODD_EXT_BACKUP"
# Fixture dump with a provider-emitted 'CREATE SCHEMA public;' statement AND a
# COPY data row containing the exact same text (which must never be touched).
SCHEMA_BACKUP="$TMP_ROOT/fixture-schema.sql"
{
  printf 'SET statement_timeout = 0;\n'
  printf 'CREATE SCHEMA public;\n'
  printf 'COPY public.notes (body) FROM stdin;\n'
  printf 'CREATE SCHEMA public;\n'
  printf '\\.\n'
  printf 'SELECT 1;\n'
} > "$SCHEMA_BACKUP"

PASS=0
FAIL=0
CASE_BIN=""
OUTPUT=""
STATUS=0

new_case() {
  CASE_BIN="$TMP_ROOT/bin-$1"
  mkdir -p "$CASE_BIN"
}

write_mock_psql() { # $1 version-mode "num:<n>"|"fail", $2 restore exit code, $3 table count
  local vmode="$1" rexit="$2" tcount="$3"
  {
    printf '#!/usr/bin/env bash\n'
    printf 'cmd=""\nisfile=0\n'
    printf 'for a in "$@"; do case "$a" in --command=*) cmd="${a#--command=}" ;; --file=*) isfile=1 ;; esac; done\n'
    printf 'if [ "$isfile" -eq 1 ]; then\n'
    printf '  printf "%%s\\n" "$@" > "%s"\n' "$CASE_BIN/restore-args"
    printf '  cat - > "%s" 2>/dev/null || true\n' "$CASE_BIN/restore-stdin"
    printf '  if [ %s -ne 0 ]; then echo "ERROR:  42P07: fixture-relation already exists (mock stderr detail)" >&2; fi\n' "$rexit"
    printf '  exit %s\n' "$rexit"
    printf 'fi\n'
    printf 'case "$cmd" in\n'
    printf '  *server_version_num*)\n'
    case "$vmode" in
      num:*) printf '    echo "%s"\n    exit 0\n' "${vmode#num:}" ;;
      fail)  printf '    exit 2\n' ;;
    esac
    printf '    ;;\n'
    printf '  *information_schema*)\n    echo "%s"\n    exit 0\n    ;;\n' "$tcount"
    printf 'esac\nexit 2\n'
  } > "$CASE_BIN/psql"
  chmod +x "$CASE_BIN/psql"
}

run_restore() { # $1 stdin line, $2 URL fixture value or "-" for unset, rest = args
  local stdin_input="$1" url="$2"
  shift 2
  if [ "$url" = "-" ]; then
    OUTPUT="$(printf '%s\n' "$stdin_input" \
      | env -i PATH="$CASE_BIN:$CLEAN_BIN" bash "$SCRIPT" "$@" 2>&1)"
  else
    OUTPUT="$(printf '%s\n' "$stdin_input" \
      | env -i PATH="$CASE_BIN:$CLEAN_BIN" RESTORE_TARGET_DB_URL="$url" \
        bash "$SCRIPT" "$@" 2>&1)"
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

echo "== restore rehearsal tests (mocked psql; no database contacted) =="

new_case "missing-backup-flag"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --target-label disposable-check --confirm-disposable-target
check "missing --backup-file fails with message" nonzero "--backup-file is required"

new_case "missing-backup-file"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --backup-file "$TMP_ROOT/does-not-exist.sql" \
  --target-label disposable-check --confirm-disposable-target
check "nonexistent backup file fails" nonzero "does not exist"

new_case "empty-backup-file"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --backup-file "$EMPTY_BACKUP" \
  --target-label disposable-check --confirm-disposable-target
check "empty backup file fails" nonzero "is empty"

new_case "missing-target-url"
write_mock_psql num:170004 0 12
run_restore "" "-" --backup-file "$GOOD_BACKUP" \
  --target-label disposable-check --confirm-disposable-target
check "missing RESTORE_TARGET_DB_URL fails" nonzero "RESTORE_TARGET_DB_URL is not set"

new_case "missing-psql"
run_restore "" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label disposable-check --confirm-disposable-target
check "missing psql fails" nonzero "psql not found"

new_case "missing-confirm-flag"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label disposable-check
check "missing --confirm-disposable-target fails" nonzero "--confirm-disposable-target is required"

new_case "nonstandard-extension"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --backup-file "$ODD_EXT_BACKUP" \
  --target-label disposable-check --confirm-disposable-target
check "non-.sql extension fails without acknowledgement" nonzero "--allow-nonstandard-extension"

new_case "unsafe-labels"
write_mock_psql num:170004 0 12
for banned in production prod canonical live primary oncall-foot; do
  run_restore "" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
    --target-label "target-$banned-check" --confirm-disposable-target
  check "label containing '$banned' is rejected" nonzero "prohibited term"
done

new_case "label-without-safe-term"
write_mock_psql num:170004 0 12
run_restore "" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "mydatabase" --confirm-disposable-target
check "label without a disposable/test term is rejected" nonzero \
  "must contain one of: disposable, test, rehearsal, sandbox, temporary"

new_case "wrong-typed-confirmation"
write_mock_psql num:170004 0 12
run_restore "no thanks" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
check "safe label reaches the typed-confirmation stage" nonzero "Type exactly: $CONFIRM_PHRASE"
check "wrong typed confirmation aborts" nonzero "confirmation phrase did not match"

new_case "target-version-query-failure"
write_mock_psql fail 0 12
run_restore "$CONFIRM_PHRASE" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
check "target connection/version failure fails closed" nonzero "could not connect to the rehearsal target"

new_case "restore-failure"
write_mock_psql num:170004 3 12
ERROR_LOG_PATH="$GOOD_BACKUP.restore-error.log"
rm -f "$ERROR_LOG_PATH"
run_restore "$CONFIRM_PHRASE" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
check "psql restore failure is reported safely" nonzero "failure during the restore"
check "failure message states the single transaction was rolled back" nonzero "rolled back"
check "failure message points to the private error log path" nonzero "restore-error.log"
if printf '%s' "$OUTPUT" | grep -Fq 'fixture-relation already exists'; then
  FAIL=$((FAIL + 1)); echo "FAIL: psql stderr contents leaked into terminal output"
else
  PASS=$((PASS + 1)); echo "PASS: psql stderr contents never reach the terminal"
fi
if [ -f "$ERROR_LOG_PATH" ] && grep -Fq 'fixture-relation already exists' "$ERROR_LOG_PATH"; then
  PASS=$((PASS + 1)); echo "PASS: psql stderr is captured to the private error log next to the backup"
else
  FAIL=$((FAIL + 1)); echo "FAIL: private error log missing or does not contain the psql stderr"
fi
LOG_MODE="$(stat -c '%a' "$ERROR_LOG_PATH" 2>/dev/null || stat -f '%Lp' "$ERROR_LOG_PATH" 2>/dev/null)"
if [ "$LOG_MODE" = "600" ]; then
  PASS=$((PASS + 1)); echo "PASS: private error log has owner-only permissions (600)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: private error log permissions are '$LOG_MODE', expected 600"
fi
rm -f "$ERROR_LOG_PATH"

new_case "successful-rehearsal"
write_mock_psql num:170004 0 12
run_restore "$CONFIRM_PHRASE" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
check "full rehearsal path succeeds with mocks" zero \
  "Restore rehearsal completed against the operator-labeled disposable target."
check "verification is labeled as basic/technical only" zero \
  "Basic technical verification only (not full recovery validation)"
check "cleanup reminder is printed" zero \
  "Delete the disposable target according to the runbook"
if grep -qx -- '--single-transaction' "$CASE_BIN/restore-args" 2>/dev/null; then
  PASS=$((PASS + 1)); echo "PASS: restore runs with --single-transaction (all-or-nothing)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: restore did not pass --single-transaction to psql"
fi
if [ ! -e "$GOOD_BACKUP.restore-error.log" ]; then
  PASS=$((PASS + 1)); echo "PASS: no error log is left behind after a successful rehearsal"
else
  FAIL=$((FAIL + 1)); echo "FAIL: error log left behind after success"
fi
if grep -Fxq 'SELECT 1;' "$CASE_BIN/restore-stdin" 2>/dev/null; then
  PASS=$((PASS + 1)); echo "PASS: restore feeds the backup contents to psql via the input stream"
else
  FAIL=$((FAIL + 1)); echo "FAIL: psql did not receive the backup contents on stdin"
fi

new_case "public-schema-statement-skipped"
write_mock_psql num:170004 0 12
run_restore "$CONFIRM_PHRASE" "$FIXTURE_URL" --backup-file "$SCHEMA_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
check "rehearsal succeeds when the dump contains CREATE SCHEMA public (42P06 incident)" zero \
  "skipped during the restore"
STDIN_CAPTURE="$CASE_BIN/restore-stdin"
if sed -n '2p' "$STDIN_CAPTURE" 2>/dev/null | grep -q '^-- CREATE SCHEMA public; (skipped'; then
  PASS=$((PASS + 1)); echo "PASS: the header CREATE SCHEMA public statement is commented in the input stream"
else
  FAIL=$((FAIL + 1)); echo "FAIL: the header CREATE SCHEMA public statement was not neutralized"
fi
if [ "$(grep -c '^CREATE SCHEMA public;$' "$STDIN_CAPTURE" 2>/dev/null)" = "1" ] \
  && sed -n '4p' "$STDIN_CAPTURE" | grep -qx 'CREATE SCHEMA public;'; then
  PASS=$((PASS + 1)); echo "PASS: the identical COPY data row is preserved verbatim (data never rewritten)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: COPY data was altered by the schema-statement filter"
fi
if [ "$(grep -c '' "$STDIN_CAPTURE" 2>/dev/null)" = "6" ]; then
  PASS=$((PASS + 1)); echo "PASS: line count preserved (dump line numbers stay meaningful in error logs)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: the filter changed the line count"
fi
if cmp -s "$SCHEMA_BACKUP" "$STDIN_CAPTURE"; then
  FAIL=$((FAIL + 1)); echo "FAIL: filter did not change the stream at all"
else
  PASS=$((PASS + 1)); echo "PASS: backup file on disk untouched while the stream was filtered"
fi
HASH_BEFORE_CHECK="$(grep -c '^CREATE SCHEMA public;$' "$SCHEMA_BACKUP")"
if [ "$HASH_BEFORE_CHECK" = "2" ]; then
  PASS=$((PASS + 1)); echo "PASS: the backup file itself still contains both original lines (never modified)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: the backup file was modified"
fi

new_case "no-schema-note-for-plain-backup"
write_mock_psql num:170004 0 12
run_restore "$CONFIRM_PHRASE" "$FIXTURE_URL" --backup-file "$GOOD_BACKUP" \
  --target-label "disposable-rehearsal-check" --confirm-disposable-target
if printf '%s' "$OUTPUT" | grep -q "skipped during the restore"; then
  FAIL=$((FAIL + 1)); echo "FAIL: schema-skip note printed for a backup without CREATE SCHEMA public"
else
  PASS=$((PASS + 1)); echo "PASS: no schema-skip note for a backup without CREATE SCHEMA public"
fi

echo
echo "Results: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
