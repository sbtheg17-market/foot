-- PROVIDER_SERVICE_AREAS_V1.sql
-- Roadmap item #12 — provider service-area eligibility (Canada-first FSA
-- prefix coverage) and travel/setup-buffer enforcement support.
-- ADDITIVE ONLY: two new tables with their indexes. No existing table,
-- column, enum, index, or row is modified or removed. Existing providers
-- have NO rows here by default and remain safely unconfigured (marketplace
-- behavior unchanged; public booking-page eligibility reports `unavailable`
-- until setup is complete). The travel/setup buffer is centrally managed in
-- application configuration (default 30 minutes) — no schema is required
-- for it in this release. No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TABLE "provider_service_areas" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL UNIQUE
    REFERENCES "provider_profiles"("id") ON DELETE CASCADE,
  "country_code" text DEFAULT 'CA' NOT NULL,
  "province_code" text DEFAULT '' NOT NULL,
  "city" text,
  "public_description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "provider_coverage_areas" (
  "id" serial PRIMARY KEY,
  "provider_id" integer NOT NULL
    REFERENCES "provider_profiles"("id") ON DELETE CASCADE,
  "country_code" text DEFAULT 'CA' NOT NULL,
  "prefix" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Unique ACTIVE normalized coverage entry per provider (removed prefixes
-- are deactivated, not destroyed, and may be re-added later).
CREATE UNIQUE INDEX "provider_coverage_areas_active_prefix_unique_idx"
  ON "provider_coverage_areas" ("provider_id", "country_code", "prefix")
  WHERE is_active = true;

-- Fast public eligibility lookup: all active coverage for one provider.
CREATE INDEX "provider_coverage_areas_provider_active_idx"
  ON "provider_coverage_areas" ("provider_id", "is_active");
