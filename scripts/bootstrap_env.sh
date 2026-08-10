#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# OnCall Foot — environment self-heal after pod restarts.
#
# This container only persists /app and /root. Everything installed via apt
# (PostgreSQL binaries, /etc/postgresql config) and global npm tools (pnpm)
# can vanish on a pod restart. This script idempotently re-establishes the
# full runtime. It is invoked automatically by /app/backend/server.py when
# PostgreSQL is unreachable, and can also be run manually:
#
#   bash /app/scripts/bootstrap_env.sh
#
# Persistent state that survives restarts:
#   /app/foot            — canonical git clone (main @ 3e76114) + untracked .env
#   /root/pg_data/15-main — PostgreSQL data directory (footdb, seeded)
# ─────────────────────────────────────────────────────────────────────────────
set -u

PG_DATA=/root/pg_data/15-main
LOG_PREFIX="[bootstrap_env]"

log() { echo "$LOG_PREFIX $*"; }

# 1) PostgreSQL binaries ------------------------------------------------------
if ! command -v pg_lsclusters >/dev/null 2>&1; then
  log "PostgreSQL missing — installing via apt..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
  # A fresh install auto-creates a default cluster in /var/lib — remove it so
  # we can register our persistent one under the same version/name.
  pg_dropcluster --stop 15 main 2>/dev/null || true
fi

# 2) Cluster registration pointing at the persistent data dir -----------------
chmod 711 /root 2>/dev/null || true
if [ -d "$PG_DATA" ]; then
  chown -R postgres:postgres /root/pg_data
  chmod 700 "$PG_DATA"
fi

if ! pg_lsclusters 2>/dev/null | awk '{print $1" "$2}' | grep -q "^15 main$"; then
  if [ -d /root/pg_data/etc_backup ]; then
    log "Restoring cluster config from persistent backup..."
    mkdir -p /etc/postgresql/15
    rm -rf /etc/postgresql/15/main
    cp -a /root/pg_data/etc_backup /etc/postgresql/15/main
    chown -R postgres:postgres /etc/postgresql/15/main
  elif [ -d "$PG_DATA" ]; then
    log "Adopting existing persistent data dir (no config backup found)..."
    # pg_createcluster adopts an existing data dir only when conf files live
    # inside it — seed minimal ones if absent.
    if [ ! -f "$PG_DATA/postgresql.conf" ]; then
      printf "listen_addresses = 'localhost'\nport = 5432\nmax_connections = 100\nshared_buffers = 128MB\ndynamic_shared_memory_type = posix\nlog_timezone = 'Etc/UTC'\ndatestyle = 'iso, mdy'\ntimezone = 'Etc/UTC'\ndefault_text_search_config = 'pg_catalog.english'\n" > "$PG_DATA/postgresql.conf"
    fi
    if [ ! -f "$PG_DATA/pg_hba.conf" ]; then
      printf "local   all   postgres   peer\nlocal   all   all   peer\nhost   all   all   127.0.0.1/32   scram-sha-256\nhost   all   all   ::1/128   scram-sha-256\n" > "$PG_DATA/pg_hba.conf"
    fi
    touch "$PG_DATA/pg_ident.conf"
    chown postgres:postgres "$PG_DATA"/postgresql.conf "$PG_DATA"/pg_hba.conf "$PG_DATA"/pg_ident.conf
    pg_createcluster 15 main -d "$PG_DATA" || log "WARNING: pg_createcluster adoption failed"
  else
    log "No persistent data found — creating fresh cluster (DB will need push+seed)..."
    mkdir -p /root/pg_data
    chown postgres:postgres /root/pg_data
    pg_createcluster 15 main -d "$PG_DATA"
  fi
else
  # Cluster registered — make sure it points at the persistent data dir.
  CONF=/etc/postgresql/15/main/postgresql.conf
  if [ -f "$CONF" ] && ! grep -q "$PG_DATA" "$CONF"; then
    log "Repointing cluster config to persistent data dir..."
    pg_ctlcluster 15 main stop 2>/dev/null || true
    sed -i "s|^data_directory = .*|data_directory = '$PG_DATA'|" "$CONF"
  fi
fi

# 3) Start the cluster ---------------------------------------------------------
if ! pg_lsclusters 2>/dev/null | grep -q online; then
  pg_ctlcluster 15 main start 2>/dev/null && log "PostgreSQL online." \
    || log "WARNING: PostgreSQL failed to start — check /var/log/postgresql/"
fi

# Keep a persistent copy of the working cluster config for future self-heals.
if pg_lsclusters 2>/dev/null | grep -q online && [ -d /etc/postgresql/15/main ]; then
  rm -rf /root/pg_data/etc_backup
  cp -a /etc/postgresql/15/main /root/pg_data/etc_backup
fi

# 4) pnpm ----------------------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  log "pnpm missing — installing..."
  npm install -g pnpm@10 >/dev/null 2>&1
fi

# 5) Monorepo dependencies + API build ----------------------------------------
cd /app/foot || exit 1
if [ ! -d node_modules ]; then
  log "node_modules missing — running pnpm install (frozen lockfile)..."
  pnpm install --frozen-lockfile --reporter=append-only >/tmp/bootstrap_pnpm.log 2>&1 \
    && log "pnpm install done." || log "WARNING: pnpm install failed — see /tmp/bootstrap_pnpm.log"
fi
if [ ! -f artifacts/api-server/dist/index.mjs ]; then
  log "API build missing — building..."
  pnpm --filter @workspace/api-server run build >/tmp/bootstrap_build.log 2>&1 \
    && log "API build done." || log "WARNING: API build failed — see /tmp/bootstrap_build.log"
fi

log "Done."
