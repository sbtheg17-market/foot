-- USERS_IS_DEMO_BACKFILL_V1.sql
-- Data quality (Phase 4, part 1b): mark the FIXED seed allowlist as demo.
-- DML ONLY (no DDL). Requires USERS_IS_DEMO_V1.sql to be applied first.
-- The allowlist is byte-for-byte the one in
-- artifacts/api-server/src/lib/demo-data.ts (DEMO_EMAILS) plus the seed admin
-- account; it is a fixed list, never a pattern, so no real account can be
-- caught by accident. Idempotent: re-running changes nothing.
-- The final SELECT is a verification read for the operator's transcript.
-- Apply only per the managed database release gate.

BEGIN;

UPDATE "users"
SET "is_demo" = true
WHERE "email" IN (
  'admin@oncallfoot.com',
  'sarah@oncallfoot.com',
  'mike@oncallfoot.com',
  'jane@oncallfoot.com',
  'tom@oncallfoot.com',
  'qa.provider@oncallfoot.test'
)
AND "is_demo" = false;

SELECT "id", "email", "role", "is_demo" FROM "users" WHERE "is_demo" = true ORDER BY "id";

COMMIT;
