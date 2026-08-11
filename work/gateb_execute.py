#!/usr/bin/env python3
"""Gate B migration executor — Option B (operator-approved).

Applies /app/memory/GATE_B_MIGRATION_PLAN.sql byte-for-byte in ONE transaction,
ONLY if its SHA-256 matches the reviewed value. Auto-rollback on any error.
Scope: 18 tables, 14 types, 12 indexes, 34 FKs. Nothing else.
"""
import hashlib
import os
import sys

import psycopg2

PLAN = "/app/memory/GATE_B_MIGRATION_PLAN.sql"
APPROVED_SHA256 = "f765cf97bde2c89bd49c3e33b93c4d8012206bcc9cb42d4569d502e80ec39f67"

sql = open(PLAN, "rb").read()
actual = hashlib.sha256(sql).hexdigest()
if actual != APPROVED_SHA256:
    print(f"ABORT: plan hash mismatch — actual {actual[:16]}… != approved {APPROVED_SHA256[:16]}…")
    sys.exit(2)
print(f"Plan hash verified: {actual} == approved value")

url = os.environ["DATABASE_URL"]
conn = psycopg2.connect(url, connect_timeout=15)
conn.autocommit = False  # single transaction
cur = conn.cursor()
try:
    cur.execute(sql.decode("utf-8"))
    conn.commit()
    print("EXECUTION: COMMITTED — single transaction applied successfully")
except Exception as exc:  # noqa: BLE001
    conn.rollback()
    print(f"EXECUTION: ROLLED BACK — {type(exc).__name__}: {exc}")
    sys.exit(3)
finally:
    cur.close()
    conn.close()
