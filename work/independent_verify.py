#!/usr/bin/env python3
"""
Independent Gate B Verification Script (Testing Agent T1)
Re-verifies the main agent's claims independently.
SECURITY: Never prints DATABASE_URL or password.
STRICTLY READ-ONLY: No writes, no schema changes.
"""
import os
import sys
import time

import psycopg2

# Results tracking
results = {
    "checks_passed": 0,
    "checks_failed": 0,
    "checks_total": 0,
    "issues": []
}

def check(name, condition, details=""):
    """Record a check result"""
    results["checks_total"] += 1
    status = "PASS" if condition else "FAIL"
    if condition:
        results["checks_passed"] += 1
        print(f"✓ CHECK {results['checks_total']}: {name} - {status}")
    else:
        results["checks_failed"] += 1
        results["issues"].append(f"{name}: {details}")
        print(f"✗ CHECK {results['checks_total']}: {name} - {status}")
    if details:
        print(f"  Details: {details}")
    return condition

# Load DATABASE_URL from .gateb.env WITHOUT printing it
print("=" * 80)
print("INDEPENDENT GATE B VERIFICATION - Testing Agent T1")
print("=" * 80)

env_file = "/app/work/.gateb.env"
database_url = None

try:
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('export DATABASE_URL='):
                # Extract value after 'export DATABASE_URL='
                database_url = line.split('=', 1)[1].strip('\'"')
                break
            elif line.startswith('DATABASE_URL='):
                database_url = line.split('=', 1)[1].strip('\'"')
                break
except Exception as e:
    check("Load DATABASE_URL from .gateb.env", False, f"Error reading file: {e}")
    sys.exit(2)

check("Load DATABASE_URL from .gateb.env", database_url is not None, 
      "Loaded successfully (value withheld for security)")

if not database_url:
    print("\nFATAL: DATABASE_URL not found in .gateb.env")
    sys.exit(2)

# Load pinned tables list
pinned_tables = []
try:
    with open("/app/work/pinned_tables.txt", 'r') as f:
        content = f.read()
        # Get lines before "---"
        before_separator = content.split("---")[0]
        pinned_tables = [line.strip() for line in before_separator.strip().split('\n') if line.strip()]
except Exception as e:
    print(f"Warning: Could not load pinned tables: {e}")

print(f"\nLoaded {len(pinned_tables)} pinned table names for comparison")

# Attempt connection with retry logic (up to 3 attempts with 5s backoff)
conn = None
max_retries = 3
retry_delay = 5

for attempt in range(1, max_retries + 1):
    try:
        print(f"\nConnection attempt {attempt}/{max_retries}...")
        conn = psycopg2.connect(database_url, connect_timeout=15)
        check("Connection to managed database (port 5432)", True, 
              "Connected via session pooler")
        break
    except Exception as e:
        if attempt < max_retries:
            print(f"  Connection failed: {type(e).__name__}: {e}")
            print(f"  Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            check("Connection to managed database (port 5432)", False, 
                  f"{type(e).__name__}: {e}")
            print("\nFATAL: Connection failed after all retries")
            sys.exit(3)

# Set session to read-only
conn.set_session(readonly=True, autocommit=False)
cur = conn.cursor()

print("\n" + "=" * 80)
print("SERVER IDENTITY VERIFICATION")
print("=" * 80)

# Check 1: Server identity claims
try:
    cur.execute("""
        SELECT 
            current_database(),
            current_setting('server_version'),
            pg_is_in_recovery(),
            current_setting('server_encoding'),
            current_setting('transaction_read_only')
    """)
    db_name, server_version, in_recovery, encoding, readonly = cur.fetchone()
    
    print(f"\nServer Identity:")
    print(f"  Database: {db_name}")
    print(f"  Version: {server_version}")
    print(f"  In Recovery: {in_recovery}")
    print(f"  Encoding: {encoding}")
    print(f"  Read-Only Session: {readonly}")
    
    check("current_database() = 'postgres'", db_name == 'postgres', f"Got: {db_name}")
    check("server_version starts with '17.6'", server_version.startswith('17.6'), 
          f"Got: {server_version}")
    check("pg_is_in_recovery() = false", in_recovery == False, f"Got: {in_recovery}")
    check("server_encoding = 'UTF8'", encoding == 'UTF8', f"Got: {encoding}")
    check("transaction_read_only = 'on'", readonly == 'on', f"Got: {readonly}")
    
except Exception as e:
    check("Server identity verification", False, f"Error: {e}")

print("\n" + "=" * 80)
print("SUPABASE-MANAGED MARKERS VERIFICATION")
print("=" * 80)

# Check 2: Supabase-managed markers - roles
try:
    cur.execute("""
        SELECT rolname FROM pg_roles 
        WHERE rolname IN ('supabase_admin', 'authenticator', 'supabase_auth_admin')
        ORDER BY rolname
    """)
    found_roles = [row[0] for row in cur.fetchall()]
    print(f"\nSupabase Roles Found: {found_roles}")
    
    expected_roles = ['authenticator', 'supabase_admin', 'supabase_auth_admin']
    check("Supabase roles (3/3): supabase_admin, authenticator, supabase_auth_admin", 
          len(found_roles) == 3 and set(found_roles) == set(expected_roles),
          f"Found {len(found_roles)}/3: {found_roles}")
    
except Exception as e:
    check("Supabase roles verification", False, f"Error: {e}")

# Check 3: Supabase-managed markers - schemas
try:
    cur.execute("""
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name IN ('auth', 'storage', 'realtime', 'extensions')
        ORDER BY schema_name
    """)
    found_schemas = [row[0] for row in cur.fetchall()]
    print(f"Supabase Schemas Found: {found_schemas}")
    
    expected_schemas = ['auth', 'extensions', 'realtime', 'storage']
    check("Supabase schemas (4/4): auth, storage, realtime, extensions", 
          len(found_schemas) == 4 and set(found_schemas) == set(expected_schemas),
          f"Found {len(found_schemas)}/4: {found_schemas}")
    
except Exception as e:
    check("Supabase schemas verification", False, f"Error: {e}")

print("\n" + "=" * 80)
print("EXTENSIONS VERIFICATION")
print("=" * 80)

# Check 4: Installed extensions
try:
    cur.execute("""
        SELECT extname, extversion FROM pg_extension 
        ORDER BY extname
    """)
    extensions = cur.fetchall()
    ext_names = [ext[0] for ext in extensions]
    
    print(f"\nInstalled Extensions ({len(extensions)}):")
    for name, version in extensions:
        print(f"  - {name} {version}")
    
    expected_extensions = {'pg_stat_statements', 'pgcrypto', 'plpgsql', 'supabase_vault', 'uuid-ossp'}
    check("Exactly 5 extensions installed", len(extensions) == 5, 
          f"Found {len(extensions)}: {ext_names}")
    check("Expected extensions present: pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp",
          set(ext_names) == expected_extensions,
          f"Found: {set(ext_names)}, Expected: {expected_extensions}")
    check("plpgsql extension present", 'plpgsql' in ext_names, 
          f"plpgsql {'found' if 'plpgsql' in ext_names else 'NOT FOUND'}")
    
except Exception as e:
    check("Extensions verification", False, f"Error: {e}")

print("\n" + "=" * 80)
print("MIGRATION STATE VERIFICATION")
print("=" * 80)

# Check 5: Migration state (no drizzle tables)
try:
    cur.execute("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name ILIKE '%drizzle%'
    """)
    drizzle_tables = cur.fetchall()
    
    cur.execute("""
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'drizzle'
    """)
    drizzle_schema = cur.fetchall()
    
    print(f"\nDrizzle Tables Found: {drizzle_tables if drizzle_tables else 'NONE'}")
    print(f"Drizzle Schema Exists: {bool(drizzle_schema)}")
    
    check("Zero tables matching '%drizzle%'", len(drizzle_tables) == 0,
          f"Found {len(drizzle_tables)} drizzle tables")
    check("No schema named 'drizzle'", len(drizzle_schema) == 0,
          f"Drizzle schema {'exists' if drizzle_schema else 'does not exist'}")
    
except Exception as e:
    check("Migration state verification", False, f"Error: {e}")

print("\n" + "=" * 80)
print("CATALOG VERIFICATION")
print("=" * 80)

# Check 6: Public schema catalog (should be empty)
try:
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    public_tables = [row[0] for row in cur.fetchall()]
    
    print(f"\nPublic Schema Base Tables: {public_tables if public_tables else 'EMPTY (0 tables)'}")
    
    check("Public schema contains 0 base tables", len(public_tables) == 0,
          f"Found {len(public_tables)} tables: {public_tables}")
    
except Exception as e:
    check("Public schema catalog verification", False, f"Error: {e}")

print("\n" + "=" * 80)
print("PINNED CATALOG COMPARISON")
print("=" * 80)

# Check 7: Pinned tables comparison
try:
    print(f"\nPinned Tables ({len(pinned_tables)}):")
    for i, table in enumerate(pinned_tables, 1):
        print(f"  {i}. {table}")
    
    # Check which pinned tables exist in public schema
    present_tables = []
    for table in pinned_tables:
        cur.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = %s
        """, (table,))
        if cur.fetchone()[0] > 0:
            present_tables.append(table)
    
    absent_tables = [t for t in pinned_tables if t not in present_tables]
    
    print(f"\nPinned Tables Present in Public Schema: {len(present_tables)}/{len(pinned_tables)}")
    if present_tables:
        print(f"  Present: {present_tables}")
    print(f"  Absent: {len(absent_tables)}/{len(pinned_tables)}")
    
    check("0/18 pinned tables present (schema absent)", len(present_tables) == 0,
          f"Expected 0/18 present (schema absent), found {len(present_tables)}/{len(pinned_tables)} present")
    
    if len(present_tables) == 0:
        print("\n  RESULT: Schema absent - pending separately authorized migration (EXPECTED)")
    elif len(present_tables) < len(pinned_tables):
        print(f"\n  RESULT: Partial schema - {len(present_tables)}/{len(pinned_tables)} tables present")
    else:
        print(f"\n  RESULT: Full schema - {len(present_tables)}/{len(pinned_tables)} tables present")
    
except Exception as e:
    check("Pinned catalog comparison", False, f"Error: {e}")

print("\n" + "=" * 80)
print("READ-ONLY SAFETY VERIFICATION")
print("=" * 80)

# Rollback and close
try:
    conn.rollback()
    print("\nTransaction rolled back successfully")
    print("No writes were performed (session was read-only)")
    check("Read-only safety: rollback successful", True, 
          "Session was read-only, transaction rolled back, no writes performed")
except Exception as e:
    check("Read-only safety verification", False, f"Error during rollback: {e}")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("VERIFICATION SUMMARY")
print("=" * 80)

print(f"\nTotal Checks: {results['checks_total']}")
print(f"Passed: {results['checks_passed']}")
print(f"Failed: {results['checks_failed']}")

if results['issues']:
    print("\nIssues Found:")
    for issue in results['issues']:
        print(f"  - {issue}")
else:
    print("\n✓ All checks passed!")

print("\n" + "=" * 80)
print("INDEPENDENT VERIFICATION COMPLETE")
print("=" * 80)

# Exit with appropriate code
sys.exit(0 if results['checks_failed'] == 0 else 1)
