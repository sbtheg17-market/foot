-- ============================================================================
-- PREVENTED_BOOKINGS_DAILY_V1.sql — frozen additive migration artifact (B2)
-- Analytics Step 2, Part 3 — prevented duplicate-booking daily projection
-- Declaration source (B1): lib/db/src/schema/prevented-bookings-daily.ts
-- ============================================================================
-- DO NOT APPLY without explicit Gate B authorization (B3). Never via drizzle-kit push.
-- ============================================================================
--
-- B2 ARTIFACT STATUS:
--   This file is the reviewed, frozen DDL artifact for the
--   prevented_bookings_daily projection table. Committing this file to the
--   repository (boundary B2) does NOT authorize applying it to any database.
--   Managed-database application is a separate, explicitly authorized step.
--
-- PROJECTION SEMANTICS:
--   prevented_bookings_daily is a rebuildable read-side aggregate over
--   prevented_booking_records (its ONLY source). It is never a source of
--   truth, is never written by request paths, and never participates in
--   booking authorization. It is replaced transactionally by
--   artifacts/api-server/src/scripts/rebuild-prevented-bookings-daily.ts
--   (procedure: docs/projection-rebuild-runbook.md).
--
-- ADDITIVE-ONLY SCOPE:
--   Exactly one CREATE TABLE statement, wrapped in a single transaction.
--   No statement alters or drops any existing object. Nothing here touches
--   prevented_booking_records, the bookings table, or the Race-Proof unique
--   index. The grain UNIQUE constraint and the path-sum CHECK are declared
--   inline within the single CREATE TABLE.
--
-- NO DOWN BY DESIGN:
--   This artifact intentionally contains no DOWN / rollback section. The
--   projection is rebuildable from its source at any time; recovery from a
--   bad apply is a reviewed, manual operation — never an automated reverse
--   migration.
--
-- NO "IF NOT EXISTS":
--   Deliberately absent from every executable statement. If any target
--   object already exists, the transaction must fail loudly so schema drift
--   is investigated rather than silently skipped.
--
-- REQUIRES POSTGRESQL 15+:
--   UNIQUE NULLS NOT DISTINCT needs PostgreSQL 15 or later. provider_id and
--   service_id are nullable (source anonymization via ON DELETE SET NULL),
--   and NULLS NOT DISTINCT guarantees at most one projection row per grain
--   even when dimensions are anonymized.
--
-- B3 APPLY PROCEDURE (hash-verified, apply-once):
--   1. Confirm explicit Gate B authorization for this exact artifact.
--   2. Recompute this file's SHA-256 and verify it equals the operator-
--      frozen hash recorded in the approved publication record.
--   3. Preflight: confirm the target table does not exist in the target
--      database.
--   4. Apply exactly once via psql with ON_ERROR_STOP, single transaction.
--   5. Verify the resulting catalog and record the apply in the ledger.
--
-- MANAGED-DATABASE SEPARATION:
--   Local scratch databases may apply this DDL freely for tests. The managed
--   database is applied only under Gate B (B3) — never via drizzle-kit push.
BEGIN;

CREATE TABLE prevented_bookings_daily (
    id serial PRIMARY KEY,
    marketplace_id integer NOT NULL,
    provider_id integer,
    service_id integer,
    day_utc date NOT NULL,
    attempts_total integer NOT NULL,
    preflight_count integer NOT NULL,
    index_violation_count integer NOT NULL,
    CONSTRAINT prevented_bookings_daily_path_sum_check
        CHECK (attempts_total = preflight_count + index_violation_count),
    CONSTRAINT prevented_bookings_daily_grain_unique
        UNIQUE NULLS NOT DISTINCT (marketplace_id, provider_id, service_id, day_utc)
);

COMMIT;
