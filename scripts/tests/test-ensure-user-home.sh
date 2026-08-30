#!/usr/bin/env bash
# Local-safe tests for the Codespaces home-directory preflight
# (.devcontainer/ensure-user-home.sh) and the devcontainer user/home
# configuration assumptions.
#
# Every case runs inside a temporary sandbox via the documented
# FOOT_BOOTSTRAP_PASSWD_HOME test override, so the real home directory is
# never read or modified. No package is installed, no repository or database
# is contacted, and no secret-shaped value appears here. Cases are written to
# pass whether the harness runs as root or as an unprivileged user.
#
# Run: bash scripts/tests/test-ensure-user-home.sh
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENSURE_SCRIPT="$REPO_ROOT/.devcontainer/ensure-user-home.sh"
DEVCONTAINER_JSON="$REPO_ROOT/.devcontainer/devcontainer.json"

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# Minimal clean PATH so the script under test can only reach the utilities we
# provide (no getent by default; sudo is a passthrough mock).
CLEAN_BIN="$TMP_ROOT/clean-bin"
mkdir -p "$CLEAN_BIN"
for tool in bash sh env id mkdir chmod chown cut grep sed head cat ls rm dirname basename; do
  src="$(command -v "$tool" 2>/dev/null || true)"
  [ -n "$src" ] && ln -s "$src" "$CLEAN_BIN/$tool"
done
printf '#!/usr/bin/env bash\nexec "$@"\n' > "$CLEAN_BIN/sudo"
chmod +x "$CLEAN_BIN/sudo"

PASS=0
FAIL=0
OUTPUT=""
STATUS=0

run_ensure() { # $1 = passwd-home override ("" to omit), remaining args: extra env KEY=VALUE
  local passwd_home="$1"; shift || true
  if [ -n "$passwd_home" ]; then
    OUTPUT="$(env -i PATH="$CLEAN_BIN" FOOT_BOOTSTRAP_PASSWD_HOME="$passwd_home" "$@" bash "$ENSURE_SCRIPT" 2>&1)"
  else
    OUTPUT="$(env -i PATH="$CLEAN_BIN" "$@" bash "$ENSURE_SCRIPT" 2>&1)"
  fi
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

check_static() { # $1 desc, $2 = 0 for pass / non-0 for fail
  if [ "$2" -eq 0 ]; then
    PASS=$((PASS + 1)); echo "PASS: $1"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $1"
  fi
}

echo "== Codespaces home-directory preflight tests (sandboxed; real home never touched) =="

# 1. Active user/home detection: reports the real active user and the
#    resolved home path, creates a missing home, and initializes the
#    first-run configuration path.
HOME_A="$TMP_ROOT/homes/case-a"
run_ensure "$HOME_A"
check "missing home is detected, created, and reported for the active user" zero \
  "Active lifecycle user: $(id -un) (uid $(id -u)); home: $HOME_A"
check "preflight ends with a writable-home confirmation" zero "OK: home directory $HOME_A is present and writable"
if [ -d "$HOME_A/.config/vscode-dev-containers" ] && [ -w "$HOME_A/.config/vscode-dev-containers" ]; then
  PASS=$((PASS + 1)); echo "PASS: first-run-notice configuration path is pre-created and writable"
else
  FAIL=$((FAIL + 1)); echo "FAIL: first-run-notice configuration path missing or unwritable"
fi

# 2. Idempotent rerun on an already-valid home.
run_ensure "$HOME_A"
check "rerun on an existing writable home succeeds (idempotent)" zero "OK: home directory $HOME_A is present and writable"
run_ensure "$HOME_A"
check "third run still succeeds (repeated bootstrap safe)" zero

# 3. Unwritable home is repaired (mode repair; chown is best-effort). As
#    root the directory is trivially writable, so this asserts success only.
HOME_B="$TMP_ROOT/homes/case-b"
mkdir -p "$HOME_B"
chmod 500 "$HOME_B"
run_ensure "$HOME_B"
check "pre-existing unwritable home ends usable (repair or root passthrough)" zero "OK: home directory $HOME_B is present and writable"
chmod u+rwx "$HOME_B" 2>/dev/null || true

# 4. Fail-closed: home cannot exist because a path component is a regular
#    file (root-safe simulation of an uncreatable home).
BLOCK_FILE="$TMP_ROOT/blockfile"
: > "$BLOCK_FILE"
run_ensure "$BLOCK_FILE/home"
check "uncreatable home fails closed with a clear error" nonzero "ERROR: home directory $BLOCK_FILE/home does not exist and could not be created"

# 5. Fail-closed: relative home path is rejected.
run_ensure "relative/home"
check "relative home path fails closed" nonzero "is not an absolute path"

# 6. No dependency on \$HOME when the account database provides the home
#    (env -i leaves HOME unset in every case above; assert explicitly here).
HOME_C="$TMP_ROOT/homes/case-c"
run_ensure "$HOME_C"
check "preflight works with no \$HOME in the environment" zero "OK: home directory $HOME_C is present and writable"

# 7. \$HOME fallback: no override, no getent on PATH -> uses exported HOME.
HOME_D="$TMP_ROOT/homes/case-d"
run_ensure "" HOME="$HOME_D"
check "falls back to \$HOME when the account database is unavailable" zero "OK: home directory $HOME_D is present and writable"

# 8. Fail-closed: no resolvable home at all (no override, no getent, no HOME).
run_ensure ""
check "no resolvable home fails closed" nonzero "could not determine a home directory"

echo
echo "== Static devcontainer user/home configuration guards =="

# 9. No forced /home/codespace (or any /home/<user>) assumption anywhere in
#    the devcontainer configuration or bootstrap scripts' executable lines.
if grep -rn "/home/codespace" "$REPO_ROOT/.devcontainer" | grep -v '^\s*#' | grep -vE ':\s*#'; then
  check_static "no hard-coded /home/codespace outside comments in .devcontainer/" 1
else
  check_static "no hard-coded /home/codespace outside comments in .devcontainer/" 0
fi

# 10. devcontainer.json parses as strict JSON and defines no user overrides
#     that could conflict with the base image's own user metadata.
python3 - "$DEVCONTAINER_JSON" <<'PYEOF'
import json, sys
cfg = json.load(open(sys.argv[1]))
forbidden = {"remoteUser", "containerUser", "updateRemoteUserUID", "containerEnv"}
present = forbidden & set(cfg)
assert not present, f"forbidden user/env overrides present: {present}"
remote_env = cfg.get("remoteEnv", {})
assert "HOME" not in remote_env and "USER" not in remote_env, "remoteEnv must not force HOME/USER"
assert "/home/codespace" not in json.dumps(cfg), "no hard-coded /home/codespace in devcontainer.json"
assert cfg["image"] == "mcr.microsoft.com/devcontainers/universal:2", "base image changed unexpectedly"
for key in ("onCreateCommand", "postCreateCommand"):
    cmd = cfg[key]
    assert cmd.startswith("bash .devcontainer/ensure-user-home.sh && "), f"{key} must run the home preflight first"
PYEOF
check_static "devcontainer.json is strict JSON with image-default user, no HOME/USER forcing, and preflight-first lifecycle commands" $?

# 11. PATH precedence for PostgreSQL 17 clients is still declared via the
#     spec-standard containerEnv expansion (no raw \$PATH, no home paths).
python3 - "$DEVCONTAINER_JSON" <<'PYEOF'
import json, sys
cfg = json.load(open(sys.argv[1]))
path = cfg["remoteEnv"]["PATH"]
assert path == "/usr/lib/postgresql/17/bin:${containerEnv:PATH}", f"unexpected remoteEnv PATH: {path}"
PYEOF
check_static "remoteEnv PATH keeps PostgreSQL 17 precedence using \${containerEnv:PATH}" $?

echo
echo "Results: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
