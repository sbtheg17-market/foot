#!/usr/bin/env bash
# Phase 4A — Managed-database catalog verification (READ-ONLY).
#
# Confirms the Phase 1 marketplace_events objects exist in the MANAGED
# database before any production event-writing is unblocked. Catalog-only:
# runs SELECTs against pg_catalog/information_schema. It never creates,
# alters, drops, inserts, updates, or deletes anything, and it NEVER prints
# credentials (only a redacted host/db identifier).
#
# Run in the environment that holds the managed DATABASE_URL:
#   DATABASE_URL=... bash verify-marketplace-events-catalog.sh
#
# Exit 0 = catalog VERIFIED (all objects present as approved in Phase 1).
# Exit 1 = one or more objects missing/mismatched -> a separate authorized
#          migration operation is required; event writes stay BLOCKED.
#
# Expected objects (source of truth: lib/db/src/schema/marketplace-events.ts
# at origin/main 7c33672):
#   - table  marketplace_events (14 columns)
#   - enums  marketplace_event_type (16), marketplace_event_reason_code (14),
#            marketplace_event_source (3)
#   - 5 indexes + primary key
#   - 5 FKs, all ON DELETE SET NULL

set -uo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Aborting (nothing was checked)." >&2
  exit 2
fi

PSQL=(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1)

# Redacted connection identity (host+dbname only; never user/password).
IDENT="$("${PSQL[@]}" -c "select current_database() || ' @ ' || coalesce(inet_server_addr()::text,'local') || ' (user: ' || current_user || ')'" 2>/dev/null || echo "connection failed")"
if [[ "$IDENT" == "connection failed" ]]; then
  echo "Could not connect to the managed database. Aborting." >&2
  exit 2
fi
echo "Catalog check against: $IDENT"
echo "Mode: READ-ONLY (catalog SELECTs only)"
echo

FAIL=0
pass() { echo "  [PASS] $1"; }
fail() { echo "  [FAIL] $1" >&2; FAIL=1; }

q() { "${PSQL[@]}" -c "$1"; }

# --- 1. Table exists ---------------------------------------------------------
T_EXISTS="$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relname='marketplace_events' and c.relkind='r' and n.nspname='public'")"
if [[ "$T_EXISTS" == "1" ]]; then pass "table public.marketplace_events exists"; else fail "table public.marketplace_events MISSING"; fi

# --- 2. Enum types + exact value counts --------------------------------------
check_enum() { # name expected_count
  local n="$1" want="$2"
  local got
  got="$(q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='$n'")"
  if [[ "$got" == "$want" ]]; then pass "enum $n present with $want values"; else fail "enum $n: expected $want values, found ${got:-0}"; fi
}
check_enum marketplace_event_type 16
check_enum marketplace_event_reason_code 14
check_enum marketplace_event_source 3

# Spot-check sentinel enum values (first + last of each, per approved schema)
check_enum_value() { # type value
  local got
  got="$(q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='$1' and e.enumlabel='$2'")"
  if [[ "$got" == "1" ]]; then pass "enum $1 contains '$2'"; else fail "enum $1 missing value '$2'"; fi
}
check_enum_value marketplace_event_type provider_approved
check_enum_value marketplace_event_type booking_no_show
check_enum_value marketplace_event_reason_code NOT_APPROVED
check_enum_value marketplace_event_reason_code CLIENT_ABANDONED
check_enum_value marketplace_event_source system

# --- 3. Required columns (name -> type) --------------------------------------
declare -A COLS=(
  [id]="integer"
  [event_type]="marketplace_event_type"
  [occurred_at]="timestamp without time zone"
  [recorded_at]="timestamp without time zone"
  [actor_user_id]="integer"
  [actor_role]="account_role"
  [provider_profile_id]="integer"
  [client_user_id]="integer"
  [service_id]="integer"
  [booking_id]="integer"
  [correlation_id]="text"
  [source]="marketplace_event_source"
  [metadata]="jsonb"
  [reason_code]="marketplace_event_reason_code"
)
for col in "${!COLS[@]}"; do
  want="${COLS[$col]}"
  got="$(q "select coalesce((select case when data_type='USER-DEFINED' then udt_name else data_type end from information_schema.columns where table_schema='public' and table_name='marketplace_events' and column_name='$col'),'MISSING')")"
  if [[ "$got" == "$want" ]]; then pass "column $col ($want)"; else fail "column $col: expected $want, found $got"; fi
done
NCOLS="$(q "select count(*) from information_schema.columns where table_schema='public' and table_name='marketplace_events'")"
if [[ "$NCOLS" == "14" ]]; then pass "column count is exactly 14"; else fail "column count: expected 14, found $NCOLS"; fi

# --- 4. NOT NULL constraints on required columns ------------------------------
for col in id event_type occurred_at recorded_at source; do
  got="$(q "select is_nullable from information_schema.columns where table_schema='public' and table_name='marketplace_events' and column_name='$col'")"
  if [[ "$got" == "NO" ]]; then pass "column $col is NOT NULL"; else fail "column $col nullability: expected NO, found ${got:-MISSING}"; fi
done

# --- 5. Indexes ----------------------------------------------------------------
for idx in marketplace_events_type_occurred_idx marketplace_events_provider_occurred_idx marketplace_events_client_occurred_idx marketplace_events_correlation_idx marketplace_events_occurred_idx; do
  got="$(q "select count(*) from pg_indexes where schemaname='public' and tablename='marketplace_events' and indexname='$idx'")"
  if [[ "$got" == "1" ]]; then pass "index $idx"; else fail "index $idx MISSING"; fi
done
PK="$(q "select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid where r.relname='marketplace_events' and c.contype='p'")"
if [[ "$PK" == "1" ]]; then pass "primary key present"; else fail "primary key MISSING"; fi

# --- 6. Foreign keys: 5, all ON DELETE SET NULL ---------------------------------
NFK="$(q "select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid where r.relname='marketplace_events' and c.contype='f'")"
NSETNULL="$(q "select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid where r.relname='marketplace_events' and c.contype='f' and c.confdeltype='n'")"
if [[ "$NFK" == "5" ]]; then pass "5 foreign keys present"; else fail "foreign keys: expected 5, found $NFK"; fi
if [[ "$NSETNULL" == "$NFK" ]]; then pass "all FKs are ON DELETE SET NULL"; else fail "FK delete rule: $NSETNULL of $NFK are SET NULL"; fi

# --- 7. Row count (informational only; no data read) ----------------------------
NROWS="$(q "select count(*) from marketplace_events" 2>/dev/null || echo "n/a")"
echo "  [INFO] marketplace_events row count: $NROWS (informational)"

echo
if [[ $FAIL -eq 0 ]]; then
  echo "RESULT: VERIFIED — Phase 1 marketplace_events catalog is present in the managed database."
  echo "Production event writes may be unblocked by the appropriate approval."
  exit 0
else
  echo "RESULT: NOT VERIFIED — objects missing or mismatched. Event writes remain BLOCKED." >&2
  echo "Remediation must be a separate authorized migration operation (do not bundle into product work)." >&2
  exit 1
fi
