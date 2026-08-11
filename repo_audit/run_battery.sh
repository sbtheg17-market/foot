#!/usr/bin/env bash
# Full C' r2 validation battery v2 — proper bootstrap.
# build api-server -> seed DB -> start server on free port -> 17 suites -> teardown.
# TAP-style totals so capture.py --parse-tap records counts.
set -u
export DATABASE_URL='postgres://foot:foot@127.0.0.1:5432/foot_test'
export JWT_SECRET='c-prime-r2-battery-local-secret'
export PORT=8899
WT=/app/repo_audit/derive_worktree
cd "$WT/artifacts/api-server" || exit 2

echo "# bootstrap: reset schema objects"
PGPASSWORD=foot psql -h 127.0.0.1 -U foot -d foot_test -q \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || exit 2
(cd "$WT" && pnpm run db:push >/dev/null 2>&1) || { echo "not ok - db:push"; exit 2; }
echo "ok - db:push (schema recreated)"

pnpm run build >/tmp/battery_build.log 2>&1 || { echo "not ok - api build"; tail -5 /tmp/battery_build.log; exit 2; }
echo "ok - api build"

pnpm run seed >/tmp/battery_seed.log 2>&1 || { echo "not ok - seed"; tail -5 /tmp/battery_seed.log; exit 2; }
echo "ok - seed"

node --enable-source-maps ./dist/index.mjs >/tmp/battery_server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/healthz" 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || { echo "not ok - server healthz ($code)"; tail -5 /tmp/battery_server.log; exit 2; }
echo "ok - server healthz 200 on :$PORT"

SUITES="test test:integration test:reviews test:care-history test:role-state \
test:authorization test:provider-application test:provider-resubmission \
test:provider-status test:availability test:pressure test:onboarding \
test:provider-history test:provider-notifications test:provider-readiness \
test:reviewer-decisions test:marketplace-events"

total_pass=0; total_fail=0; suites_fail=0
for s in $SUITES; do
  out=$(pnpm run "$s" 2>&1)
  rc=$?
  p=$(printf '%s\n' "$out" | grep -Eo '^# pass [0-9]+' | awk '{s+=$3} END {print s+0}')
  f=$(printf '%s\n' "$out" | grep -Eo '^# fail [0-9]+' | awk '{s+=$3} END {print s+0}')
  total_pass=$((total_pass+p)); total_fail=$((total_fail+f))
  if [ $rc -ne 0 ] || [ "$f" -ne 0 ]; then
    suites_fail=$((suites_fail+1))
    echo "not ok - $s (exit=$rc pass=$p fail=$f)"
    printf '%s\n' "$out" | grep -E "^not ok" | head -6
  else
    echo "ok - $s (pass=$p fail=$f)"
  fi
done
kill $SRV 2>/dev/null; trap - EXIT
echo "# tests $((total_pass+total_fail))"
echo "# pass $total_pass"
echo "# fail $total_fail"
echo "suites-failed: $suites_fail"
echo "remote-state-effect: NONE (local postgres + local server only)"
[ $suites_fail -eq 0 ] && [ $total_fail -eq 0 ]
