#!/usr/bin/env bash
# Local-safe tests for the Codespaces PostgreSQL client bootstrap
# (.devcontainer/install-postgres-client.sh and verify-postgres-client.sh).
#
# All system-mutating commands (apt-get, curl) are mocks on a controlled
# PATH, and the installer writes only into a temporary sandbox via its
# documented FOOT_BOOTSTRAP_* test overrides. No package is installed, no
# repository is contacted, no live or managed database is ever touched, and
# no real URL, password, token, project ID, or customer record appears here.
#
# Run: bash scripts/tests/test-codespaces-bootstrap.sh
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="$REPO_ROOT/.devcontainer/install-postgres-client.sh"
VERIFY_SCRIPT="$REPO_ROOT/.devcontainer/verify-postgres-client.sh"

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# Minimal clean PATH of core utilities so real apt-get/curl/pg_dump/psql can
# never be reached by accident.
CLEAN_BIN="$TMP_ROOT/clean-bin"
mkdir -p "$CLEAN_BIN"
for tool in bash sh env sed grep head tr date mkdir install mv tee id dirname basename cat ls rm cut; do
  src="$(command -v "$tool" 2>/dev/null || true)"
  [ -n "$src" ] && ln -s "$src" "$CLEAN_BIN/$tool"
done

PASS=0
FAIL=0
CASE_BIN=""
SANDBOX=""
OUTPUT=""
STATUS=0

new_case() {
  CASE_BIN="$TMP_ROOT/bin-$1"
  SANDBOX="$TMP_ROOT/sandbox-$1"
  mkdir -p "$CASE_BIN" "$SANDBOX/etc-apt/sources.list.d" "$SANDBOX/keys" "$SANDBOX/profile-d"
  # Ubuntu 22.04 (jammy) os-release fixture — the actual Codespaces base.
  printf 'NAME="Ubuntu"\nVERSION_ID="22.04"\nVERSION_CODENAME=jammy\n' > "$SANDBOX/os-release"
  # sudo passthrough mock (harness may run as non-root).
  printf '#!/usr/bin/env bash\nexec "$@"\n' > "$CASE_BIN/sudo"
  chmod +x "$CASE_BIN/sudo"
}

write_mock_curl() {
  cat > "$CASE_BIN/curl" <<'EOF'
#!/usr/bin/env bash
out=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then out="$a"; fi
  prev="$a"
done
if [ -n "$out" ]; then printf 'mock pgdg signing key material\n' > "$out"; fi
exit 0
EOF
  chmod +x "$CASE_BIN/curl"
}

write_mock_apt_get() { # $1 = "ok" | "scoped-update-fail" | "full-update-fail-scoped-ok"
  local mode="$1"
  cat > "$CASE_BIN/apt-get" <<EOF
#!/usr/bin/env bash
MODE="$mode"
EOF
  cat >> "$CASE_BIN/apt-get" <<'EOF'
scoped=0
cmd=""
for a in "$@"; do
  case "$a" in
    update|install) cmd="$a" ;;
    -o) : ;;
    Dir::Etc::sourcelist=*) scoped=1 ;;
  esac
done
if [ "$cmd" = "update" ] && [ "$scoped" -eq 1 ]; then
  [ "$MODE" = "scoped-update-fail" ] && exit 100
  exit 0
fi
if [ "$cmd" = "update" ]; then
  [ "$MODE" = "full-update-fail-scoped-ok" ] && exit 100
  [ "$MODE" = "scoped-update-fail" ] && exit 100
  exit 0
fi
exit 0
EOF
  chmod +x "$CASE_BIN/apt-get"
}

write_mock_pg_tools() { # $1 = major version for both tools, or "garbage"
  local v="$1"
  if [ "$v" = "garbage" ]; then
    printf '#!/usr/bin/env bash\necho "not a version line"\n' > "$CASE_BIN/pg_dump"
    printf '#!/usr/bin/env bash\necho "not a version line"\n' > "$CASE_BIN/psql"
  else
    printf '#!/usr/bin/env bash\necho "pg_dump (PostgreSQL) %s.1"\n' "$v" > "$CASE_BIN/pg_dump"
    printf '#!/usr/bin/env bash\necho "psql (PostgreSQL) %s.1"\n' "$v" > "$CASE_BIN/psql"
  fi
  chmod +x "$CASE_BIN/pg_dump" "$CASE_BIN/psql"
}

run_install() { # forced full install (bypasses the already-installed fast path)
  OUTPUT="$(env -i PATH="$CASE_BIN:$CLEAN_BIN" \
    FOOT_BOOTSTRAP_APT_DIR="$SANDBOX/etc-apt" \
    FOOT_BOOTSTRAP_PGDG_KEY_DIR="$SANDBOX/keys" \
    FOOT_BOOTSTRAP_OS_RELEASE="$SANDBOX/os-release" \
    FOOT_BOOTSTRAP_VERSIONED_BIN="$SANDBOX/no-such-versioned-bin" \
    FOOT_BOOTSTRAP_PROFILE_DIR="$SANDBOX/profile-d" \
    FOOT_BOOTSTRAP_FORCE_INSTALL=1 \
    bash "$INSTALL_SCRIPT" 2>&1)"
  STATUS=$?
}

run_install_nofast() { # no force flag: exercises the already-installed fast path
  OUTPUT="$(env -i PATH="$CASE_BIN:$CLEAN_BIN" \
    FOOT_BOOTSTRAP_APT_DIR="$SANDBOX/etc-apt" \
    FOOT_BOOTSTRAP_PGDG_KEY_DIR="$SANDBOX/keys" \
    FOOT_BOOTSTRAP_OS_RELEASE="$SANDBOX/os-release" \
    FOOT_BOOTSTRAP_VERSIONED_BIN="$SANDBOX/no-such-versioned-bin" \
    FOOT_BOOTSTRAP_PROFILE_DIR="$SANDBOX/profile-d" \
    bash "$INSTALL_SCRIPT" 2>&1)"
  STATUS=$?
}

run_verify() {
  OUTPUT="$(env -i PATH="$CASE_BIN:$CLEAN_BIN" \
    FOOT_BOOTSTRAP_VERSIONED_BIN="$SANDBOX/no-such-versioned-bin" \
    bash "$VERIFY_SCRIPT" 2>&1)"
  STATUS=$?
}

check() { # $1 desc, $2 zero|nonzero, $3 required substring (optional)
  local desc="$1" want="$2" substr="${3:-}"
  local ok=1
  if [ "$want" = "zero" ] && [ "$STATUS" -ne 0 ]; then ok=0; fi
  if [ "$want" = "nonzero" ] && [ "$STATUS" -eq 0 ]; then ok=0; fi
  if [ -n "$substr" ] && ! printf '%s' "$OUTPUT" | grep -Fq -- "$substr"; then ok=0; fi
  # Secret-safety invariant: no connection-string-shaped value in any output.
  if printf '%s' "$OUTPUT" | grep -Eq 'postgres(ql)?://[^ ]+:[^ ]+@'; then
    ok=0; desc="$desc (connection-string-shaped value leaked into output)"
  fi
  if [ "$ok" -eq 1 ]; then
    PASS=$((PASS + 1)); echo "PASS: $desc"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $desc (status=$STATUS)"
    printf '%s\n' "$OUTPUT" | sed 's/^/    /'
  fi
}

active_pgdg_entries() { # counts active (non-disabled) files containing apt.postgresql.org
  grep -ls 'apt\.postgresql\.org' "$SANDBOX"/etc-apt/sources.list.d/*.list "$SANDBOX"/etc-apt/sources.list.d/*.sources 2>/dev/null | wc -l
}

echo "== Codespaces bootstrap tests (mocked apt-get/curl; sandboxed paths; no packages installed) =="

new_case "ubuntu-2204-fresh"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 17
run_install
check "fresh Ubuntu 22.04 (jammy) bootstrap succeeds" zero "OK: PostgreSQL client tools meet the 17+ workspace baseline."
if grep -qs 'jammy-pgdg main' "$SANDBOX/etc-apt/sources.list.d/pgdg.list"; then
  PASS=$((PASS + 1)); echo "PASS: canonical entry targets the detected jammy codename"
else
  FAIL=$((FAIL + 1)); echo "FAIL: canonical entry does not target jammy"
fi
if grep -qs "signed-by=$SANDBOX/keys/apt.postgresql.org.asc" "$SANDBOX/etc-apt/sources.list.d/pgdg.list"; then
  PASS=$((PASS + 1)); echo "PASS: canonical entry uses the modern signed-by keyring"
else
  FAIL=$((FAIL + 1)); echo "FAIL: canonical entry missing signed-by keyring"
fi

new_case "preexisting-conflicting-entry"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 17
printf 'deb [signed-by=/usr/share/keyrings/other.gpg] https://apt.postgresql.org/pub/repos/apt jammy-pgdg main\n' \
  > "$SANDBOX/etc-apt/sources.list.d/preexisting-pgdg.list"
printf 'Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: jammy-pgdg\n' \
  > "$SANDBOX/etc-apt/sources.list.d/preexisting-pgdg.sources"
run_install
check "bootstrap succeeds despite preexisting conflicting PGDG entries (universal-image failure class)" zero \
  "Disabled preexisting PGDG apt entry"
if [ "$(active_pgdg_entries)" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: exactly one active PGDG entry remains (conflicting .list and .sources disabled)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: expected exactly 1 active PGDG entry, found $(active_pgdg_entries)"
fi

new_case "idempotent-rerun"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 17
run_install
check "first run succeeds" zero
run_install
check "second run succeeds (idempotent on rebuild)" zero
if [ "$(active_pgdg_entries)" = "1" ] && [ ! -e "$SANDBOX/etc-apt/sources.list.d/pgdg.list.disabled-by-foot-bootstrap" ]; then
  PASS=$((PASS + 1)); echo "PASS: rerun leaves exactly one active entry and never disables its own file"
else
  FAIL=$((FAIL + 1)); echo "FAIL: rerun changed the source layout unexpectedly"
fi

new_case "unrelated-broken-repo"
write_mock_curl; write_mock_apt_get full-update-fail-scoped-ok; write_mock_pg_tools 17
run_install
check "unrelated broken repositories do not break the bootstrap (scoped PGDG refresh)" zero \
  "WARNING: full 'apt-get update' reported errors"

new_case "pgdg-index-failure"
write_mock_curl; write_mock_apt_get scoped-update-fail; write_mock_pg_tools 17
run_install
check "PGDG index refresh failure fails closed with a clear message" nonzero \
  "could not refresh the PGDG package index"

new_case "verify-17-accepted"
write_mock_pg_tools 17
run_verify
check "verifier accepts PostgreSQL 17 clients" zero "OK: PostgreSQL client tools meet the 17+ workspace baseline."

new_case "verify-18-accepted"
write_mock_pg_tools 18
run_verify
check "verifier accepts PostgreSQL 18 clients" zero

new_case "verify-16-rejected"
write_mock_pg_tools 16
run_verify
check "verifier rejects PostgreSQL 16 clients" nonzero "older than the workspace baseline 17"

new_case "verify-missing-pg-dump"
write_mock_pg_tools 17
rm -f "$CASE_BIN/pg_dump"
run_verify
check "verifier fails closed when pg_dump is missing" nonzero "pg_dump not found"

new_case "verify-missing-psql"
write_mock_pg_tools 17
rm -f "$CASE_BIN/psql"
run_verify
check "verifier fails closed when psql is missing" nonzero "psql not found"

new_case "verify-malformed-version"
write_mock_pg_tools garbage
run_verify
check "verifier fails closed on unparsable versions" nonzero "could not parse"

new_case "fast-path-skip"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 17
run_install_nofast
check "fast path: already-compatible client skips package setup (build-stage redundancy)" zero "nothing to install"
if [ ! -e "$SANDBOX/etc-apt/sources.list.d/pgdg.list" ]; then
  PASS=$((PASS + 1)); echo "PASS: fast path performed no apt source changes"
else
  FAIL=$((FAIL + 1)); echo "FAIL: fast path unexpectedly wrote apt sources"
fi

new_case "fast-path-never-masks-old-client"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 16
run_install_nofast
check "fast path never masks an old client (full bootstrap attempted; 16 rejected)" nonzero "older than the workspace baseline 17"

new_case "profile-path-snippet"
write_mock_curl; write_mock_apt_get ok; write_mock_pg_tools 17
run_install
SNIPPET="$SANDBOX/profile-d/99-foot-postgres-client-path.sh"
check "forced bootstrap succeeds and writes the PATH precedence snippet" zero "Wrote login-shell PATH precedence snippet"
if [ -f "$SNIPPET" ] && grep -Fq '/usr/lib/postgresql/17/bin' "$SNIPPET" && grep -Fq 'case ":$PATH:"' "$SNIPPET"; then
  PASS=$((PASS + 1)); echo "PASS: snippet prefers the versioned client dir with a dedup guard"
else
  FAIL=$((FAIL + 1)); echo "FAIL: snippet missing or malformed"
fi
if sh -n "$SNIPPET" 2>/dev/null; then
  PASS=$((PASS + 1)); echo "PASS: snippet is valid sh"
else
  FAIL=$((FAIL + 1)); echo "FAIL: snippet is not valid sh"
fi
PREPEND_PATH="$(env PATH="/usr/bin:/bin" sh -c ". '$SNIPPET'; printf %s \"\$PATH\"")"
case "$PREPEND_PATH" in
  /usr/lib/postgresql/17/bin:*) PASS=$((PASS + 1)); echo "PASS: snippet prepends the versioned client dir (PATH precedence)" ;;
  *) FAIL=$((FAIL + 1)); echo "FAIL: snippet did not prepend the versioned client dir" ;;
esac
DEDUP_PATH="$(env PATH="/usr/lib/postgresql/17/bin:/usr/bin:/bin" sh -c ". '$SNIPPET'; printf %s \"\$PATH\"")"
DEDUP_COUNT="$(printf '%s' "$DEDUP_PATH" | grep -o '/usr/lib/postgresql/17/bin' | wc -l | tr -d ' ')"
if [ "$DEDUP_COUNT" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: snippet never duplicates the PATH entry (idempotent sourcing)"
else
  FAIL=$((FAIL + 1)); echo "FAIL: snippet duplicated the PATH entry ($DEDUP_COUNT occurrences)"
fi
run_install
check "forced rerun keeps the snippet and stays idempotent" zero

echo
echo "Results: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
