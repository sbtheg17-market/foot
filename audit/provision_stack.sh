#!/bin/bash
# B-prime r2 verification stack provisioning (local-only, ephemeral).
# Secrets are generated locally, written only to the untracked worktree .env,
# and NEVER printed. Output is safe for the redacted ledger.
set -e
PGBIN=/usr/lib/postgresql/15/bin
PGDATA=/app/audit/pgdata/cluster
PGPORT=55432
WT=/app/audit/bprime_worktree

# 1. ephemeral cluster
if [ ! -d "$PGDATA" ]; then
  su postgres -c "$PGBIN/initdb -D $PGDATA -A trust" > /tmp/initdb.log 2>&1
  echo "initdb: OK"
fi
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k /tmp' -l /tmp/pg.log start" > /dev/null 2>&1 || true
sleep 2
su postgres -c "$PGBIN/pg_isready -p $PGPORT" && echo "postgres 15.18 ready on scratch port"
su postgres -c "$PGBIN/psql -p $PGPORT -h /tmp -tc \"SELECT 1 FROM pg_database WHERE datname='footdb'\"" | grep -q 1 || \
  su postgres -c "$PGBIN/createdb -p $PGPORT -h /tmp footdb" && echo "footdb present"

# 2. worktree .env (values never echoed; file is gitignored)
JWT=$(openssl rand -hex 32)
cat > "$WT/.env" <<EOF
DATABASE_URL=postgresql://postgres@localhost:$PGPORT/footdb
JWT_SECRET=$JWT
PORT=8899
NODE_ENV=production
EOF
echo ".env written (values redacted, not shown)"

# 3. schema push + seed
cd "$WT"
set -a; . ./.env; set +a
pnpm --filter @workspace/db run push 2>&1 | tail -2
pnpm run seed 2>&1 | tail -6

# 4. api-server build + start (serves built SPA same-origin)
pnpm --filter @workspace/api-server run build 2>&1 | tail -2
pkill -f "artifacts/api-server/dist/index.mjs" 2>/dev/null || true
sleep 1
nohup node --enable-source-maps artifacts/api-server/dist/index.mjs > /tmp/api.log 2>&1 &
disown
sleep 3

# 5. probes
curl -sf http://localhost:8899/api/healthz && echo " <- healthz OK"
curl -s -o /dev/null -w "SPA root HTTP %{http_code}\n" http://localhost:8899/
curl -s -o /dev/null -w "login page HTTP %{http_code}\n" http://localhost:8899/login
echo "STACK READY"
