#!/usr/bin/env bash
# ensure-user-home.sh — Codespaces/devcontainer lifecycle preflight: verify
# (and, when safely possible, repair) the ACTIVE user's home directory before
# any other bootstrap step runs.
#
# Incident this guards against (observed 2026-08-30, recovery mode):
#   mkdir: cannot create directory '/home/codespace': Permission denied
#   touch: cannot touch '/home/codespace/.config/vscode-dev-containers/
#     first-run-notice-already-displayed': No such file or directory
# Container setup initialized first-run state under a fixed home path that
# did not exist and could not be created by the non-root lifecycle user
# (/home is root-owned), which failed the bootstrap.
#
# Design rules (see docs/codespaces-recovery-workspace.md):
# - No user name and no home path is ever hard-coded. The base image
#   (mcr.microsoft.com/devcontainers/universal:2) declares its own default
#   containerUser/remoteUser in image metadata; this repository defines no
#   custom user and must keep working if the image's default user changes.
# - The active user and home are derived at runtime: account database entry
#   for the active uid first, then $HOME.
# - Missing/unwritable homes are repaired (mkdir/chown/chmod, via sudo only
#   when needed and available), then re-verified fail-closed.
# - The first-run-notice configuration path is pre-created so later marker
#   writes cannot fail on a missing directory.
#
# NON-SECRET: prints only the active username, uid, and home path.
set -euo pipefail

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  printf 'Codespaces bootstrap failed: the active user home directory is not usable.\n' >&2
  exit 1
}

ACTIVE_UID="$(id -u)"
ACTIVE_GID="$(id -g)"
ACTIVE_USER="$(id -un)"

SUDO=""
if [ "$ACTIVE_UID" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

# Resolve the active user's home directory, in order of authority:
#   1. FOOT_BOOTSTRAP_PASSWD_HOME — test-harness override only (never set in
#      devcontainer configuration; keeps tests off the real home directory).
#   2. The account database entry for the active uid (getent passwd).
#   3. $HOME as exported for this lifecycle command.
PASSWD_HOME=""
if [ -n "${FOOT_BOOTSTRAP_PASSWD_HOME:-}" ]; then
  PASSWD_HOME="$FOOT_BOOTSTRAP_PASSWD_HOME"
elif command -v getent >/dev/null 2>&1; then
  PASSWD_HOME="$(getent passwd "$ACTIVE_UID" | cut -d: -f6 || true)"
fi

TARGET_HOME="$PASSWD_HOME"
if [ -z "$TARGET_HOME" ] || [ "$TARGET_HOME" = "/nonexistent" ]; then
  TARGET_HOME="${HOME:-}"
fi
[ -n "$TARGET_HOME" ] \
  || fail "could not determine a home directory for user '$ACTIVE_USER' (uid $ACTIVE_UID) from the account database or \$HOME."
case "$TARGET_HOME" in
  /*) : ;;
  *) fail "resolved home '$TARGET_HOME' for user '$ACTIVE_USER' is not an absolute path." ;;
esac

echo "Active lifecycle user: $ACTIVE_USER (uid $ACTIVE_UID); home: $TARGET_HOME"

if [ ! -d "$TARGET_HOME" ]; then
  echo "Home directory $TARGET_HOME is missing; creating it."
  if ! $SUDO mkdir -p "$TARGET_HOME" 2>/dev/null; then
    fail "home directory $TARGET_HOME does not exist and could not be created for user '$ACTIVE_USER'."
  fi
  $SUDO chown "$ACTIVE_UID:$ACTIVE_GID" "$TARGET_HOME" 2>/dev/null || true
  $SUDO chmod u+rwx "$TARGET_HOME" 2>/dev/null || true
fi

if [ ! -w "$TARGET_HOME" ]; then
  echo "Home directory $TARGET_HOME is not writable by $ACTIVE_USER; repairing ownership and mode."
  $SUDO chown "$ACTIVE_UID:$ACTIVE_GID" "$TARGET_HOME" 2>/dev/null || true
  $SUDO chmod u+rwx "$TARGET_HOME" 2>/dev/null || true
fi
[ -w "$TARGET_HOME" ] \
  || fail "home directory $TARGET_HOME exists but is not writable by user '$ACTIVE_USER' and could not be repaired."

# Pre-create the configuration path that container tooling initializes on
# first run, so later marker writes can never fail on a missing directory.
CONFIG_DIR="$TARGET_HOME/.config/vscode-dev-containers"
mkdir -p "$CONFIG_DIR" || fail "could not create $CONFIG_DIR."
[ -w "$CONFIG_DIR" ] || fail "$CONFIG_DIR is not writable by user '$ACTIVE_USER'."

echo "OK: home directory $TARGET_HOME is present and writable for $ACTIVE_USER; first-run configuration path initialized."
