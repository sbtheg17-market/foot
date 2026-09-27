-- USERS_IS_DEMO_V1.sql
-- Data quality (Phase 4, part 1): an explicit, queryable demo flag on users so
-- seed/demo accounts can never masquerade as real providers or clients in
-- admin counts, pilot metrics or scorecards. Replaces the interim code-side
-- e-mail allowlist (artifacts/api-server/src/lib/demo-data.ts DEMO_EMAILS).
-- ADDITIVE ONLY: one nullable-free boolean column with a constant default and
-- one partial index. Existing rows read false (no rewrite on PostgreSQL >= 11:
-- a constant DEFAULT is stored in the catalog). No existing table, enum,
-- index, or row is modified or removed. No DOWN migration is provided by
-- policy (docs/managed-db-release-gate.md): rollback is restore-based.
-- Backfill of the current seed identities is a SEPARATE reviewed DML step
-- (USERS_IS_DEMO_BACKFILL_V1.sql) — this artifact flags nobody.
-- Apply only per the managed database release gate. Syntax-validated only;
-- rehearse against a disposable local PostgreSQL before any managed apply.

ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;

CREATE INDEX "users_is_demo_idx" ON "users" ("is_demo") WHERE "is_demo" = true;
