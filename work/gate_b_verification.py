#!/usr/bin/env python3
"""
Gate B Clearance Verification Script
Post-migration catalog verification for OnCall Foot project
SECURITY: Never prints DATABASE_URL
SAFETY: Read-only session, rollback at end
"""

import sys
import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class GateBVerifier:
    def __init__(self):
        self.connection = None
        self.cursor = None
        self.checks_passed = 0
        self.checks_failed = 0
        self.critical_failures = []
        
        # Expected values from the migration plan
        self.EXPECTED_TABLES = [
            'account_roles', 'availability', 'bookings', 'invoices', 
            'marketplace_events', 'provider_application_events',
            'provider_application_submissions', 'provider_applications',
            'provider_notifications', 'provider_profiles', 'push_tokens',
            'reviews', 'services', 'support_messages', 'support_tickets',
            'travel_zones', 'users', 'verification_docs'
        ]
        self.EXPECTED_TABLE_COUNT = 18
        self.EXPECTED_ENUM_COUNT = 14
        self.EXPECTED_INDEX_COUNT = 12
        self.EXPECTED_FK_COUNT = 34
        
    def log_check(self, name, passed, details="", critical=False):
        """Log a verification check result"""
        if passed:
            self.checks_passed += 1
            print(f"{GREEN}✓{RESET} {name}")
            if details:
                print(f"  {details}")
        else:
            self.checks_failed += 1
            print(f"{RED}✗{RESET} {name}")
            if details:
                print(f"  {RED}{details}{RESET}")
            if critical:
                self.critical_failures.append(f"{name}: {details}")
    
    def load_database_url(self):
        """Load DATABASE_URL from .gateb.env without printing it"""
        env_path = '/app/work/.gateb.env'
        if not os.path.exists(env_path):
            raise FileNotFoundError(f"Credentials file not found: {env_path}")
        
        # Parse the env file (handles both "export DATABASE_URL=" and "DATABASE_URL=" formats)
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                # Remove 'export ' prefix if present
                if line.startswith('export '):
                    line = line[7:].strip()
                
                if line.startswith('DATABASE_URL='):
                    # Extract value, handle quotes
                    value = line.split('=', 1)[1]
                    value = value.strip('"').strip("'")
                    return value
        
        raise ValueError("DATABASE_URL not found in .gateb.env")
    
    def connect_readonly(self, max_retries=3):
        """Connect to database with read-only session"""
        print(f"\n{BLUE}=== Connecting to Database ==={RESET}")
        
        database_url = self.load_database_url()
        
        for attempt in range(1, max_retries + 1):
            try:
                print(f"Connection attempt {attempt}/{max_retries}...")
                
                # Connect to database
                self.connection = psycopg2.connect(database_url)
                self.cursor = self.connection.cursor(cursor_factory=RealDictCursor)
                
                # Set session to read-only
                self.cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;")
                self.connection.commit()
                
                # Start a new read-only transaction
                self.cursor.execute("BEGIN TRANSACTION READ ONLY;")
                
                # Verify read-only mode
                self.cursor.execute("SHOW transaction_read_only;")
                readonly_status = self.cursor.fetchone()['transaction_read_only']
                
                if readonly_status == 'on':
                    print(f"{GREEN}✓{RESET} Connected in read-only mode")
                    return True
                else:
                    print(f"{RED}✗{RESET} Connection not in read-only mode!")
                    return False
                    
            except psycopg2.OperationalError as e:
                error_msg = str(e)
                # Don't print the full error if it contains connection details
                if 'could not connect' in error_msg.lower():
                    print(f"{YELLOW}⚠{RESET} Connection failed (attempt {attempt}/{max_retries})")
                else:
                    print(f"{YELLOW}⚠{RESET} {error_msg}")
                
                if attempt < max_retries:
                    print(f"Retrying in 5 seconds...")
                    time.sleep(5)
                else:
                    print(f"{RED}✗{RESET} Failed to connect after {max_retries} attempts")
                    return False
        
        return False
    
    def verify_database_identity(self):
        """Verify database name and PostgreSQL version"""
        print(f"\n{BLUE}=== Database Identity ==={RESET}")
        
        # Check database name
        self.cursor.execute("SELECT current_database();")
        db_name = self.cursor.fetchone()['current_database']
        self.log_check(
            "Database name",
            db_name == 'postgres',
            f"current_database() = '{db_name}'",
            critical=True
        )
        
        # Check PostgreSQL version
        self.cursor.execute("SHOW server_version;")
        version = self.cursor.fetchone()['server_version']
        version_ok = version.startswith('17.6')
        self.log_check(
            "PostgreSQL version",
            version_ok,
            f"server_version = '{version}' (expected: starts with '17.6')",
            critical=True
        )
    
    def verify_tables(self):
        """Verify exactly 18 tables matching the pinned list"""
        print(f"\n{BLUE}=== Table Verification ==={RESET}")
        
        # Get all base tables in public schema
        self.cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        actual_tables = [row['table_name'] for row in self.cursor.fetchall()]
        actual_count = len(actual_tables)
        
        # Check count
        count_ok = actual_count == self.EXPECTED_TABLE_COUNT
        self.log_check(
            "Table count",
            count_ok,
            f"Found {actual_count} tables (expected: {self.EXPECTED_TABLE_COUNT})",
            critical=True
        )
        
        # Check exact match with pinned list
        expected_set = set(self.EXPECTED_TABLES)
        actual_set = set(actual_tables)
        
        missing = expected_set - actual_set
        unexpected = actual_set - expected_set
        
        if missing:
            self.log_check(
                "Missing tables",
                False,
                f"Missing {len(missing)} tables: {sorted(missing)}",
                critical=True
            )
        else:
            self.log_check("Missing tables", True, "0 missing tables")
        
        if unexpected:
            self.log_check(
                "Unexpected tables",
                False,
                f"Found {len(unexpected)} unexpected tables: {sorted(unexpected)}",
                critical=True
            )
        else:
            self.log_check("Unexpected tables", True, "0 unexpected tables")
        
        # Exact match check
        exact_match = (actual_set == expected_set)
        self.log_check(
            "Exact table set match",
            exact_match,
            f"18/18 tables present and correct" if exact_match else "Table set mismatch",
            critical=True
        )
        
        if actual_tables:
            print(f"\n  {BLUE}Actual tables:{RESET}")
            for table in actual_tables:
                marker = "✓" if table in expected_set else "✗"
                print(f"    {marker} {table}")
    
    def verify_enum_types(self):
        """Verify exactly 14 enum types"""
        print(f"\n{BLUE}=== Enum Type Verification ==={RESET}")
        
        self.cursor.execute("""
            SELECT typname 
            FROM pg_type 
            WHERE typtype = 'e' 
              AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            ORDER BY typname;
        """)
        
        enums = [row['typname'] for row in self.cursor.fetchall()]
        enum_count = len(enums)
        
        count_ok = enum_count == self.EXPECTED_ENUM_COUNT
        self.log_check(
            "Enum type count",
            count_ok,
            f"Found {enum_count} enum types (expected: {self.EXPECTED_ENUM_COUNT})",
            critical=True
        )
        
        if enums:
            print(f"  {BLUE}Enum types:{RESET} {', '.join(enums)}")
    
    def verify_indexes(self):
        """Verify exactly 12 non-constraint indexes"""
        print(f"\n{BLUE}=== Index Verification ==={RESET}")
        
        # Get indexes that are NOT backing constraints
        self.cursor.execute("""
            SELECT i.indexname
            FROM pg_indexes i
            WHERE i.schemaname = 'public'
              AND NOT EXISTS (
                SELECT 1 
                FROM pg_constraint c
                WHERE c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND c.conindid = (
                    SELECT oid 
                    FROM pg_class 
                    WHERE relname = i.indexname 
                      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  )
              )
            ORDER BY i.indexname;
        """)
        
        indexes = [row['indexname'] for row in self.cursor.fetchall()]
        index_count = len(indexes)
        
        count_ok = index_count == self.EXPECTED_INDEX_COUNT
        self.log_check(
            "Non-constraint index count",
            count_ok,
            f"Found {index_count} indexes (expected: {self.EXPECTED_INDEX_COUNT})",
            critical=True
        )
        
        if indexes:
            print(f"  {BLUE}Indexes:{RESET}")
            for idx in indexes:
                print(f"    • {idx}")
    
    def verify_foreign_keys(self):
        """Verify exactly 34 foreign key constraints"""
        print(f"\n{BLUE}=== Foreign Key Verification ==={RESET}")
        
        self.cursor.execute("""
            SELECT conname
            FROM pg_constraint
            WHERE contype = 'f'
              AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            ORDER BY conname;
        """)
        
        fks = [row['conname'] for row in self.cursor.fetchall()]
        fk_count = len(fks)
        
        count_ok = fk_count == self.EXPECTED_FK_COUNT
        self.log_check(
            "Foreign key count",
            count_ok,
            f"Found {fk_count} foreign keys (expected: {self.EXPECTED_FK_COUNT})",
            critical=True
        )
    
    def verify_no_seed_data(self):
        """Verify all tables are empty (no seed data)"""
        print(f"\n{BLUE}=== Seed Data Verification ==={RESET}")
        
        # Check pg_stat_user_tables
        self.cursor.execute("""
            SELECT COALESCE(SUM(n_live_tup), 0) as total_rows
            FROM pg_stat_user_tables
            WHERE schemaname = 'public';
        """)
        
        total_rows = self.cursor.fetchone()['total_rows']
        
        self.log_check(
            "Total rows (pg_stat_user_tables)",
            total_rows == 0,
            f"n_live_tup sum = {total_rows} (expected: 0)",
            critical=True
        )
        
        # Spot-check users table
        self.cursor.execute("SELECT COUNT(*) as count FROM users;")
        users_count = self.cursor.fetchone()['count']
        
        self.log_check(
            "Users table empty",
            users_count == 0,
            f"SELECT COUNT(*) FROM users = {users_count} (expected: 0)",
            critical=True
        )
        
        # Spot-check bookings table
        self.cursor.execute("SELECT COUNT(*) as count FROM bookings;")
        bookings_count = self.cursor.fetchone()['count']
        
        self.log_check(
            "Bookings table empty",
            bookings_count == 0,
            f"SELECT COUNT(*) FROM bookings = {bookings_count} (expected: 0)",
            critical=True
        )
    
    def verify_structural_integrity(self):
        """Spot-check structural integrity of specific tables"""
        print(f"\n{BLUE}=== Structural Integrity Checks ==={RESET}")
        
        # Check bookings table columns
        self.cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'bookings'
            ORDER BY ordinal_position;
        """)
        
        bookings_columns = [row['column_name'] for row in self.cursor.fetchall()]
        required_columns = ['id', 'client_id', 'provider_id', 'service_id', 'status', 'scheduled_at']
        
        has_required = all(col in bookings_columns for col in required_columns)
        
        self.log_check(
            "Bookings table structure",
            has_required,
            f"Has required columns: {', '.join(required_columns)}" if has_required 
            else f"Missing columns. Found: {', '.join(bookings_columns)}"
        )
        
        # Check marketplace_events table column count
        self.cursor.execute("""
            SELECT COUNT(*) as col_count
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'marketplace_events';
        """)
        
        me_col_count = self.cursor.fetchone()['col_count']
        
        self.log_check(
            "Marketplace_events column count",
            me_col_count == 14,
            f"Found {me_col_count} columns (expected: 14)"
        )
    
    def verify_readonly_safety(self):
        """Verify session is read-only and rollback"""
        print(f"\n{BLUE}=== Read-Only Safety Verification ==={RESET}")
        
        # Check transaction_read_only
        self.cursor.execute("SHOW transaction_read_only;")
        readonly = self.cursor.fetchone()['transaction_read_only']
        
        self.log_check(
            "Session read-only mode",
            readonly == 'on',
            f"transaction_read_only = '{readonly}'"
        )
        
        # Rollback transaction
        try:
            self.connection.rollback()
            self.log_check("Transaction rollback", True, "Successfully rolled back")
        except Exception as e:
            self.log_check("Transaction rollback", False, f"Error: {str(e)}")
    
    def run_verification(self):
        """Run all verification checks"""
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}Gate B Clearance Verification{RESET}")
        print(f"{BLUE}OnCall Foot Project - Post-Migration Catalog Check{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
        
        try:
            # Connect
            if not self.connect_readonly():
                print(f"\n{RED}GATE B: FAILED - Cannot establish read-only connection{RESET}")
                return False
            
            # Run all checks
            self.verify_database_identity()
            self.verify_tables()
            self.verify_enum_types()
            self.verify_indexes()
            self.verify_foreign_keys()
            self.verify_no_seed_data()
            self.verify_structural_integrity()
            self.verify_readonly_safety()
            
            # Summary
            print(f"\n{BLUE}{'='*60}{RESET}")
            print(f"{BLUE}Verification Summary{RESET}")
            print(f"{BLUE}{'='*60}{RESET}")
            print(f"Checks passed: {GREEN}{self.checks_passed}{RESET}")
            print(f"Checks failed: {RED}{self.checks_failed}{RESET}")
            
            if self.critical_failures:
                print(f"\n{RED}Critical Failures:{RESET}")
                for failure in self.critical_failures:
                    print(f"  {RED}✗{RESET} {failure}")
            
            # Final verdict
            print(f"\n{BLUE}{'='*60}{RESET}")
            if self.checks_failed == 0:
                print(f"{GREEN}GATE B: CLEARED ✓{RESET}")
                print(f"{GREEN}All verification checks passed.{RESET}")
                print(f"{GREEN}Catalog state matches expected post-migration state:{RESET}")
                print(f"{GREEN}  • 18/18 tables present and correct{RESET}")
                print(f"{GREEN}  • 14 enum types{RESET}")
                print(f"{GREEN}  • 12 non-constraint indexes{RESET}")
                print(f"{GREEN}  • 34 foreign keys{RESET}")
                print(f"{GREEN}  • 0 seed data rows{RESET}")
                print(f"{BLUE}{'='*60}{RESET}\n")
                return True
            else:
                print(f"{RED}GATE B: NOT CLEARED ✗{RESET}")
                print(f"{RED}Verification failed with {self.checks_failed} issue(s).{RESET}")
                print(f"{RED}Review the failures above before recording clearance.{RESET}")
                print(f"{BLUE}{'='*60}{RESET}\n")
                return False
                
        except Exception as e:
            print(f"\n{RED}GATE B: FAILED - Unexpected error{RESET}")
            print(f"{RED}Error: {str(e)}{RESET}")
            import traceback
            traceback.print_exc()
            return False
            
        finally:
            # Clean up
            if self.cursor:
                self.cursor.close()
            if self.connection:
                self.connection.close()
                print(f"{GREEN}✓{RESET} Database connection closed")

def main():
    verifier = GateBVerifier()
    success = verifier.run_verification()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
