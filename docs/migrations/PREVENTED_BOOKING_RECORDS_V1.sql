-- ============================================================================
-- PREVENTED_BOOKING_RECORDS_V1.sql — frozen additive migration artifact (B2)
-- Analytics Step 2, Part 1 — prevented duplicate-booking records
-- Declaration source (B1): lib/db/src/schema/prevented-booking-records.ts
-- ============================================================================
-- DO NOT APPLY without explicit Gate B authorization (B3). Never via drizzle-kit push.
-- ============================================================================
--
-- B2 ARTIFACT STATUS:
--   This file is the reviewed, frozen DDL artifact for the
--   prevented_booking_records analytics table. Committing this file to the
--   repository (boundary B2) does NOT authorize applying it to any database.
--   Managed-database application is a separate, explicitly authorized step.
--
-- ADDITIVE-ONLY SCOPE:
--   Exactly one CREATE TYPE, one CREATE TABLE, and two CREATE INDEX
--   statements, wrapped in a single transaction. No statement alters or
--   drops any existing object. Nothing here touches the bookings table or
--   the Race-Proof unique index.
--
-- NO DOWN BY DESIGN:
--   This artifact intentionally contains no DOWN / rollback section. The
--   table is an append-only analytics source; recovery from a bad apply is
--   a reviewed, manual operation — never an automated reverse migration.
--
-- NO "IF NOT EXISTS":
--   Deliberately absent from every executable statement. If any target
--   object already exists, the transaction must fail loudly so schema drift
--   is investigated rather than silently skipped.
--
-- B3 APPLY PROCEDURE (hash-verified, apply-once):
--   1. Confirm explicit Gate B authorization for this exact artifact.
--   2. Recompute this file's SHA-256 and verify it equals the operator-
--      frozen hash recorded in the approved publication record.
--   3. Preflight: confirm none of the target objects exist in the target
--      database (enum type, table, indexes).
--   4. Apply exactly once via psql with ON_ERROR_STOP, single transaction.
--   5. Verify the resulting catalog and record the apply in the ledger.
--
-- MANAGED-DATABASE SEPARATION:
--   Local scratch databases may apply this DDL freely for tests. The managed
--   database is applied only under Gate B (B3) — never via drizzle-kit push.
BEGIN;

CREATE TYPE prevented_booking_path AS ENUM ('preflight', 'index_violation');

CREATE TABLE prevented_booking_records (
    id serial PRIMARY KEY,
    marketplace_id integer NOT NULL,
    correlation_id text NOT NULL,
    occurred_at timestamp NOT NULL,
    recorded_at timestamp NOT NULL DEFAULT now(),
    actor_user_id integer,
    subject_booking_id integer,
    provider_id integer,
    service_id integer,
    scheduled_at timestamp NOT NULL,
    path prevented_booking_path NOT NULL,
    CONSTRAINT prevented_booking_records_actor_user_id_users_id_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT prevented_booking_records_subject_booking_id_bookings_id_fk
        FOREIGN KEY (subject_booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT prevented_booking_records_provider_id_provider_profiles_id_fk
        FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE SET NULL,
    CONSTRAINT prevented_booking_records_service_id_services_id_fk
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX prevented_booking_records_correlation_unique_idx
    ON prevented_booking_records (correlation_id);

CREATE INDEX prevented_booking_records_marketplace_provider_occurred_idx
    ON prevented_booking_records (marketplace_id, provider_id, occurred_at DESC NULLS LAST);

COMMIT;
