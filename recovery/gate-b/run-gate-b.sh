#!/usr/bin/env bash
# GATE B SESSION — run by the OWNER / MANAGED OPERATOR ONLY, inside the managed
# environment with runtime-injected DATABASE_URL. Per GATE_B_RUNBOOK.md.
#
# This script:
#   - checks only for the PRESENCE of DATABASE_URL (value never read by the shell);
#   - never prints, logs, checksums, persists, or passes the URL via CLI
#     (the Node helper reads it from the child process environment only);
#   - wraps each of the six checks in capture.py (redaction + append-only ledger);
#   - classifies each check PASS/FAIL/BLOCKED/UNRECORDED via capture.py semantics.
#
# Usage: bash /app/recovery/gate-b/run-gate-b.sh --managed
set -uo pipefail
LEDGER=/app/recovery/ledger
Q=/app/recovery/gate-b/gateb-query.mjs

if [[ "${1:-}" != "--managed" ]]; then
  echo "REFUSED: pass --managed to confirm you are the owner/operator running" >&2
  echo "inside the managed environment. Local PostgreSQL does NOT qualify." >&2
  exit 2
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  python3 "$LEDGER/capture.py" --blocked "runtime-injected DATABASE_URL not present" \
    --name "gate B session" --type gate --repo sbtheg17-market/foot
  echo "BLOCKED: DATABASE_URL not injected. Gate B not run." >&2
  exit 3
fi

cap() { # cap <n> <name> <sql>
  python3 "$LEDGER/capture.py" --name "gate B check $1: $2" --type gate \
    --repo sbtheg17-market/foot --timeout 60 \
    -- node "$Q" "$3"
}

cap 1 "database identity"   "SELECT current_database(), version();"
cap 2 "connectivity"        "SELECT 1;"
cap 3 "role and permissions" "SELECT current_user, session_user, has_database_privilege(current_database(),'CREATE');"
cap 4 "schemas"             "SELECT schema_name FROM information_schema.schemata ORDER BY 1;"
cap 5 "schema state — comfort tables must NOT exist" "SELECT COUNT(*) AS comfort_tables_found FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('client_comfort_profiles','client_comfort_consents');"
cap 6 "migration baseline — drizzle bookkeeping presence (absence is itself the state)" "SELECT COUNT(*) AS drizzle_migration_tables FROM information_schema.tables WHERE table_schema='drizzle' AND table_name='__drizzle_migrations';"

echo
echo "Gate B session captured. Now verify and summarize the ledger:"
python3 "$LEDGER/record_action.py" verify && python3 "$LEDGER/record_action.py" summary
echo
echo "PASS criteria (operator judgment against runbook expectations):"
echo "  check 1: expected database name; PostgreSQL 15.x"
echo "  check 2: single row value 1"
echo "  check 3: bounded verification role, NOT superuser; CREATE per role contract"
echo "  check 4: baseline schemas only"
echo "  check 5: comfort_tables_found == 0  (nonzero -> FAIL, stop)"
echo "  check 6: record the count as the baseline finding (0 is valid state)"
echo "Gate B overall = PASS only if checks 1-6 individually PASS in this session."
