-- ADMIN_AUDIT_LOG_V1.sql
-- Data quality (Phase 4, part 2): one append-only record per administrator
-- action so every admin decision is reviewable later (who, what, on which
-- record, summarised before/after, when). Today admin actions are traceable
-- only where a domain table happens to keep history (provider_application_events,
-- booking_outcome_history); credential reviews, support-ticket status changes
-- and demo purges leave no reviewable trail.
-- ADDITIVE ONLY: one new table with an actor FK to users and two indexes. No
-- existing table, enum, index, or row is modified or removed. No cascade
-- delete: audit rows never follow or destroy the records they describe (the
-- target is referenced by type + id, not by FK, so a purged target keeps its
-- audit history). No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- before_summary / after_summary hold SHORT allowlisted projections written by
-- the API (never full rows, never reviewer-private notes, never e-mail bodies).
-- Apply only per the managed database release gate. Syntax-validated only;
-- rehearse against a disposable local PostgreSQL before any managed apply.

CREATE TABLE "admin_audit_log" (
  "id" serial PRIMARY KEY,
  "actor_user_id" integer NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" integer,
  "before_summary" jsonb,
  "after_summary" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_audit_log_action_not_blank" CHECK (length(btrim("action")) > 0),
  CONSTRAINT "admin_audit_log_target_type_not_blank" CHECK (length(btrim("target_type")) > 0)
);

CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" ("created_at" DESC, "id" DESC);

CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" ("target_type", "target_id");
