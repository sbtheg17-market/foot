-- PROVIDER_APPLICATION_REJECTION_REASON_V1.sql
-- Provider onboarding recovery — closes a frozen-artifact gap found by the
-- onboarding schema audit: provider_applications.rejection_reason is defined
-- in lib/db/src/schema/provider-applications.ts and selected by the
-- /providers/application* routes, but no frozen migration artifact captured
-- it (recorded OPEN in docs/TODO-LEDGER.md on 2026-08-28). On a database
-- without it, the owner application/status/completion reads fail 42703 → 500.
-- ADDITIVE ONLY: one new nullable text column. No existing table, enum,
-- index, or row is modified or removed. No backfill required (NULL means "no
-- rejection recorded"). No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

ALTER TABLE "provider_applications" ADD COLUMN "rejection_reason" text;
