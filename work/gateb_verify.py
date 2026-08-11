#!/usr/bin/env python3
"""Gate B read-only verifier — managed Supabase PostgreSQL via authorized session pooler.

Fresh, clearly-labeled verifier. It does NOT claim to be the lost pinned script
verify-marketplace-events-catalog.sh (SHA-256 df1465bb...) and never prints secrets.
STRICTLY READ-ONLY: session forced to read-only; no DDL, no DML, no schema push.
"""
import os
import sys

import psycopg2

url = os.environ.get("DATABASE_URL")
if not url:
    print("CHECK 1 DATABASE_URL exists: FAIL — not set")
    sys.exit(2)
print("CHECK 1 DATABASE_URL exists: PASS (value withheld)")

PINNED_TABLES = sorted(
    open("/app/work/pinned_tables.txt").read().split("---")[0].split()
)

try:
    conn = psycopg2.connect(url, connect_timeout=15)
except Exception as exc:  # noqa: BLE001
    print(f"CHECK 2 connection: FAIL — {type(exc).__name__}: {exc}")
    sys.exit(3)
print("CHECK 2 connection succeeds (session pooler, port 5432): PASS")

conn.set_session(readonly=True, autocommit=False)
cur = conn.cursor()

# ---- identity / version (safe values only) ----
cur.execute(
    "SELECT current_database(), current_user, current_setting('server_version'),"
    " pg_is_in_recovery(), current_setting('server_encoding'),"
    " current_setting('TimeZone'), current_setting('transaction_read_only')"
)
db, user, ver, recov, enc, tz, ro = cur.fetchone()
print(f"CHECK 3 identity/version: database={db} user={user} server_version={ver} "
      f"in_recovery={recov} encoding={enc} timezone={tz} session_read_only={ro}")

# ---- provider fingerprint (Supabase-managed markers, read-only) ----
cur.execute("SELECT count(*) FROM pg_roles WHERE rolname IN ('supabase_admin','authenticator','supabase_auth_admin')")
sb_roles = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM information_schema.schemata WHERE schema_name IN ('auth','storage','realtime','extensions')")
sb_schemas = cur.fetchone()[0]
print(f"CHECK 4 managed-provider identity: supabase marker roles={sb_roles}/3, marker schemas={sb_schemas}/4 "
      f"-> {'SUPABASE-MANAGED CONFIRMED' if sb_roles >= 2 and sb_schemas >= 2 else 'UNCONFIRMED'}")

# ---- extensions ----
cur.execute("SELECT extname, extversion FROM pg_extension ORDER BY extname")
exts = cur.fetchall()
print(f"CHECK 5 installed extensions ({len(exts)}): " + ", ".join(f"{n} {v}" for n, v in exts))
required = {"plpgsql"}  # OnCall Foot Drizzle schema uses identity columns + now(); no extension beyond core required
missing_req = required - {n for n, _ in exts}
print(f"CHECK 5 required extensions present: {'PASS' if not missing_req else 'FAIL missing=' + str(missing_req)} "
      f"(required by pinned schema: {sorted(required)}; gen_random_uuid is core in PG13+)")

# ---- migration state ----
cur.execute(
    "SELECT table_schema, table_name FROM information_schema.tables "
    "WHERE table_name ILIKE '%drizzle%' OR table_schema = 'drizzle'"
)
mig = cur.fetchall()
print(f"CHECK 6 migration state: drizzle journal tables found={mig if mig else 'NONE'} "
      "(repo uses drizzle-kit push workflow; no journal expected until an authorized migration/push runs)")

# ---- catalog inspection: public schema ----
cur.execute(
    "SELECT table_name FROM information_schema.tables "
    "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
)
live = [r[0] for r in cur.fetchall()]
print(f"CHECK 7 catalog — public schema base tables ({len(live)}): {live if live else 'EMPTY'}")

pinned = [t for t in PINNED_TABLES if t]
present = sorted(set(pinned) & set(live))
absent = sorted(set(pinned) - set(live))
unexpected = sorted(set(live) - set(pinned))
print(f"CHECK 8 pinned-catalog comparison ({len(pinned)} pinned tables):")
print(f"  present:    {len(present)}/{len(pinned)} {present}")
print(f"  absent:     {len(absent)}/{len(pinned)} {absent}")
print(f"  unexpected: {unexpected}")
if len(present) == 0:
    print("  RESULT: schema absent — pending separately authorized migration")
elif absent:
    print("  RESULT: PARTIAL — catalog does not match pinned schema")
else:
    print("  RESULT: FULL MATCH")

# ---- prove nothing was written ----
conn.rollback()
print("CHECK 9 rollback/write-safety: session was READ ONLY; transaction rolled back; no writes performed")
cur.close()
conn.close()
print("GATE B VERIFIER: COMPLETE (honest results above; overall gate verdict recorded separately)")
