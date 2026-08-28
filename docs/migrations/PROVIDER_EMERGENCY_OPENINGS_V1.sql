-- PROVIDER_EMERGENCY_OPENINGS_V1.sql
-- Emergency openings — one-off extra availability windows outside the weekly
-- schedule (docs/emergency-openings-policy.md).
-- ADDITIVE ONLY: one new table with its index. No existing table, column,
-- enum, index, or row is modified or removed. Existing providers have NO
-- rows here by default and behavior is unchanged until a provider creates an
-- opening. "date" is a calendar date (YYYY-MM-DD) in the effective
-- marketplace timezone; times are wall-clock "HH:MM" exactly like the weekly
-- "availability" table. "service_ids" NULL/empty means every active service.
-- "urgent_only" is a client-facing label only — the booking flow is
-- unchanged. No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TABLE "provider_emergency_openings" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL
    REFERENCES "provider_profiles"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "service_ids" integer[],
  "urgent_only" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Fast lookup: openings for one provider on one date (slot generation and
-- booking enforcement both query by (provider_id, date)).
CREATE INDEX "provider_emergency_openings_provider_date_idx"
  ON "provider_emergency_openings" ("provider_id", "date");
