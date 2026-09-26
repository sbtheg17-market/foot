"""Apply-once runner for frozen artifacts in docs/migrations (Gate B).
Usage: DATABASE_URL=... python3 scripts/apply-frozen-migrations.py FILE [FILE...]
Each file runs in exactly one transaction; any error rolls that file back and stops."""
import hashlib
import os
import sys
from pathlib import Path

import psycopg2

url = os.environ["DATABASE_URL"]
root = Path(__file__).resolve().parent.parent / "docs" / "migrations"

for name in sys.argv[1:]:
    path = root / name
    sql = path.read_text()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    conn = psycopg2.connect(url)
    try:
        # Artifacts that carry their own BEGIN/COMMIT run verbatim in autocommit mode.
        conn.autocommit = "\nBEGIN;" in sql
        with conn.cursor() as cur:
            cur.execute(sql)
        if not conn.autocommit:
            conn.commit()
        print(f"APPLIED  {name}  sha256={digest}")
    except Exception as exc:
        if not conn.autocommit:
            conn.rollback()
        print(f"FAILED   {name}: {str(exc).strip()[:300]}")
        sys.exit(1)
    finally:
        conn.close()
