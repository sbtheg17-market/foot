-- PILOT_PROVIDER_RETENTION_V1.sql
-- Pilot Operations Dashboard (Part 1) — admin-recorded provider retention
-- intent, one row per provider (lib/db/src/schema/pilot-retention.ts).
-- ADDITIVE ONLY: one new enum and one new table with a unique provider FK
-- and an admin-actor FK. No existing table, enum, index, or row is modified
-- or removed. No cascade delete: retention rows never destroy or follow
-- unrelated history. No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TYPE "pilot_retention_intent" AS ENUM ('yes', 'no', 'unknown');

CREATE TABLE "pilot_provider_retention" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL UNIQUE REFERENCES "provider_profiles"("id"),
  "retention_intent" "pilot_retention_intent" DEFAULT 'unknown' NOT NULL,
  "updated_by" integer NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now() NOT NULL
);
