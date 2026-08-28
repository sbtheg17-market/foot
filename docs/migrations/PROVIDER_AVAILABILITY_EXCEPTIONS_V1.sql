-- PROVIDER_AVAILABILITY_EXCEPTIONS_V1.sql
-- Phase B (availability exceptions) — blocked dates only.
-- ADDITIVE ONLY: one new enum type and one new table with its unique index.
-- No existing table, column, enum, index, or row is modified or removed.
-- Existing providers have NO rows here by default; behavior is unchanged
-- until a provider blocks a date. Blocked dates never modify existing
-- bookings (docs/availability-exceptions-policy.md §3.3). The enum leaves
-- room for a future 'emergency_open' value (ALTER TYPE ... ADD VALUE) —
-- NOT included in this release. No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TYPE "availability_exception_type" AS ENUM ('blocked');

CREATE TABLE "provider_availability_exceptions" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL
    REFERENCES "provider_profiles"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "type" "availability_exception_type" DEFAULT 'blocked' NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- One exception per provider per marketplace-local calendar date.
CREATE UNIQUE INDEX "provider_availability_exceptions_provider_date_unique_idx"
  ON "provider_availability_exceptions" ("provider_id", "date");
