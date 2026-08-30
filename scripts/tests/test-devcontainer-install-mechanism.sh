#!/usr/bin/env bash
# Local-safe static tests for the PostgreSQL client INSTALLATION MECHANISM.
# The image build stage must perform the installation, because the observed
# GitHub Codespaces lifecycle can start a container without executing
# onCreateCommand/postCreateCommand (incident 2026-08-30).
#
# Static analysis only: nothing is installed, built, or contacted; no live
# or managed database is ever touched; no secret-shaped value appears here.
#
# Run: bash scripts/tests/test-devcontainer-install-mechanism.sh
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DC_DIR="$REPO_ROOT/.devcontainer"
DOCKERFILE="$DC_DIR/Dockerfile"
PASS=0
FAIL=0

assert() { # $1 desc, $2 exit status (0 = pass)
  if [ "$2" -eq 0 ]; then
    PASS=$((PASS + 1)); echo "PASS: $1"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $1"
  fi
}

echo "== Devcontainer installation-mechanism tests (static; nothing built or installed) =="

# 1. devcontainer.json performs installation via the image build stage.
python3 - "$DC_DIR/devcontainer.json" <<'PYEOF'
import json, sys
cfg = json.load(open(sys.argv[1]))
assert "image" not in cfg, "bare image reference would skip the build-stage install"
assert cfg["build"]["dockerfile"] == "Dockerfile"
assert cfg["build"].get("context", ".") == "."
PYEOF
assert "devcontainer.json builds .devcontainer/Dockerfile (no bare image reference)" $?

# 2. Dockerfile: pinned base, build-time install, cleanup, no user changes.
[ -f "$DOCKERFILE" ]
assert "Dockerfile exists" $?
grep -qxF 'FROM mcr.microsoft.com/devcontainers/universal:2' "$DOCKERFILE"
assert "Dockerfile pins the same universal:2 base image as before" $?
grep -q 'RUN bash /tmp/foot-devcontainer-bootstrap/install-postgres-client.sh' "$DOCKERFILE"
assert "Dockerfile runs the installer at build time (a stage Codespaces must execute)" $?
grep -q 'rm -rf /tmp/foot-devcontainer-bootstrap' "$DOCKERFILE"
assert "Dockerfile removes its temporary bootstrap copy" $?
! grep -qE '^[[:space:]]*USER[[:space:]]' "$DOCKERFILE"
assert "Dockerfile defines no USER override (base image user metadata inherited)" $?
! grep -qE '^[[:space:]]*ENV[[:space:]]+HOME' "$DOCKERFILE"
assert "Dockerfile forces no HOME value" $?
! grep -qE 'useradd|adduser|groupadd' "$DOCKERFILE"
assert "Dockerfile creates no custom user" $?

# 3. Client-only guarantee: only the versioned client package is installed;
#    no server package, no deprecated apt-key.
grep -q 'postgresql-client-\${PG_CLIENT_MAJOR}' "$DC_DIR/install-postgres-client.sh"
assert "installer installs the versioned client package only" $?
! grep -qE 'apt-get install.*postgresql-(server|contrib|[0-9])' "$DC_DIR/install-postgres-client.sh" "$DOCKERFILE"
assert "no PostgreSQL server package is referenced anywhere" $?
! sed 's/#.*//' "$DC_DIR/install-postgres-client.sh" | grep -q 'apt-key'
assert "no deprecated apt-key usage in executable lines" $?

# 4. Version-17 baseline is consistent between installer and verifier.
grep -qxF 'PG_CLIENT_MAJOR=17' "$DC_DIR/install-postgres-client.sh"
assert "installer baseline is PostgreSQL 17" $?
grep -qxF 'REQUIRED_MAJOR=17' "$DC_DIR/verify-postgres-client.sh"
assert "verifier baseline is PostgreSQL 17" $?
grep -q 'bash "$SCRIPT_DIR/verify-postgres-client.sh"' "$DC_DIR/install-postgres-client.sh"
assert "installer ends by running the fail-closed verifier (build fails on bad selection)" $?

# 5. Lifecycle redundancy preserved and ordered: preflight first, then
#    installer (onCreate) / verifier (postCreate); PG 17 PATH precedence kept.
python3 - "$DC_DIR/devcontainer.json" <<'PYEOF'
import json, sys
cfg = json.load(open(sys.argv[1]))
assert cfg["onCreateCommand"] == "bash .devcontainer/ensure-user-home.sh && bash .devcontainer/install-postgres-client.sh"
assert cfg["postCreateCommand"] == "bash .devcontainer/ensure-user-home.sh && bash .devcontainer/verify-postgres-client.sh"
assert cfg["remoteEnv"]["PATH"] == "/usr/lib/postgresql/17/bin:${containerEnv:PATH}"
PYEOF
assert "lifecycle redundancy kept: preflight-first commands and PG 17 remoteEnv PATH precedence" $?

# 6. No secret-shaped value anywhere in the devcontainer configuration.
! grep -rEq 'postgres(ql)?://[^ ]+:[^ ]+@|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN' "$DC_DIR"
assert "no connection-string- or token-shaped value in .devcontainer/" $?

echo
echo "Results: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
