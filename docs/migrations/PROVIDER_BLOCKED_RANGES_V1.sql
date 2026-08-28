-- PROVIDER_BLOCKED_RANGES_V1.sql
-- Blocked ranges (vacation / time off) — date-range blocks during which a
-- provider offers NO bookable time (docs/availability-exceptions-policy.md).
-- ADDITIVE ONLY: one new table with its index. No existing table, column,
-- enum, index, or row is modified or removed. Existing providers have NO
-- rows here by default and behavior is unchanged until a provider blocks a
-- range. "start_date" and "end_date" are inclusive calendar dates
-- (YYYY-MM-DD) in the effective marketplace timezone. "reason" is a private
-- provider-only note, never rendered on client-facing surfaces. No DOWN
-- migration is provided by policy (docs/managed-db-release-gate.md):
-- rollback is restore-based. Apply only per the managed database release
-- gate. Tested against a disposable local PostgreSQL only.

CREATE TABLE "provider_blocked_ranges" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL
    REFERENCES "provider_profiles"("id") ON DELETE CASCADE,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Fast lookup: ranges covering one date (slot generation and booking
-- enforcement filter by provider_id + end_date >= date, then start_date).
CREATE INDEX "provider_blocked_ranges_provider_end_idx"
  ON "provider_blocked_ranges" ("provider_id", "end_date");
