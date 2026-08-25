-- PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql
-- Roadmap item #11 — provider-owned public booking pages and share links.
-- ADDITIVE ONLY: four new nullable/defaulted columns and one partial-free
-- unique index. No existing table, enum, index, or row is modified or
-- removed. Existing providers default to unpublished with no slug (safe
-- backfill-free default). No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

ALTER TABLE "provider_profiles" ADD COLUMN "public_slug" text;
ALTER TABLE "provider_profiles" ADD COLUMN "booking_page_published" boolean DEFAULT false NOT NULL;
ALTER TABLE "provider_profiles" ADD COLUMN "booking_page_published_at" timestamp;

CREATE UNIQUE INDEX "provider_profiles_public_slug_unique_idx"
  ON "provider_profiles" ("public_slug");

-- Privacy-safe, allowlisted acquisition-source attribution on bookings
-- (values: instagram, qr-card, text, facebook, website; anything else is
-- dropped at the API boundary and never stored).
ALTER TABLE "bookings" ADD COLUMN "source" text;
