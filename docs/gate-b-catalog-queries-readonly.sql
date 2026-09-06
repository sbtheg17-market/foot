-- ============================================================================
-- gate-b-catalog-queries-readonly.sql — DRAFT, READ-ONLY PREFLIGHT QUERIES
-- ============================================================================
-- Purpose: Gate-B preflight evidence for the managed database. Every statement
-- is a SELECT (or WITH … SELECT). Most read only pg_catalog. Sections §1.4–§1.7
-- additionally read the platform-owned table storage.migrations — metadata
-- columns (name, executed_at) and count(*) only — so the file is READ-ONLY but
-- NOT literally catalog-only. No statement reads application rows.
--
-- This file NEVER:
--   * runs CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE/GRANT/REVOKE/
--     VACUUM/ANALYZE/CALL/DO/COPY/SET;
--   * reads provider, client, booking, payment, or other application rows;
--   * uses SELECT *;
--   * exposes host, port, user, password, or connection details.
--
-- EXECUTION RULE: never run the whole file. Run ONE section at a time in the
-- VS Code PostgreSQL extension (select the section, Run Query), never from a
-- shell. Confirm the connection indicator shows the intended database before
-- each run. Stop on any unexpected result.
--
-- REQUIRED ORDER (core classification):
--   §0    target descriptors           -> stop if database unexpected or major < 15
--   §1.1  locate "migrations" relation -> expect storage.migrations only
--   §1.2  its columns                  -> expect id, name, hash, executed_at
--   §1.4  row count (one integer)
--   §2    base tables                  -> stop if any of the six is false
--   §3.2  per-artifact rollup FIRST    -> stop on any 'PARTIAL - HARD STOP'
--   §3.1  per-object detail (optional after §3.2)
--   §4.1–§4.5 one at a time, ONLY if §3.2 has no PARTIAL rows
--
-- DEFERRED (not needed for classification; run later only for the operator's
-- evidence record, if at all): §1.3, §1.4a, §1.5, §1.6, §1.7, §1.8, §4.6,
-- §4.7, §4.7b, §5.
--
-- A MATCH in §4 is evidence only. It is never permission to apply an artifact.
-- This file is NOT a migration and must never be placed in docs/migrations/.
--
-- Expected object names come from the ten frozen artifacts in docs/migrations/
-- at approved SHA 9710454ef0b864071bcba387b5cf56f0d79ae36d (names only).
-- The only non-catalog relation referenced anywhere in this file is
-- storage.migrations (metadata columns name / executed_at, plus count(*)).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- §0  Non-secret target descriptors (for the release record)
--     Reads: database name and server version settings only.
-- ----------------------------------------------------------------------------
SELECT current_database()                                   AS database_name,
       current_setting('server_version')                    AS server_version,
       current_setting('server_version_num')::int / 10000   AS server_major_version,
       current_setting('server_version_num')::int >= 150000 AS meets_pg15_for_prevented_bookings_daily;


-- ----------------------------------------------------------------------------
-- §1  storage.migrations — metadata only (corroborating evidence, NOT the
--     authoritative Gate-B test; the repository does not define this relation).
--     NOTE: §1.4–§1.7 read this platform-owned table (name, executed_at,
--     count(*) only) and are therefore read-only but not catalog-only.
--     Core order runs only §1.1, §1.2, §1.4; the rest are DEFERRED.
-- ----------------------------------------------------------------------------

-- §1.1 Every relation named "migrations" in any schema (there may be more than one).
SELECT n.nspname            AS schema_name,
       c.relname            AS relation_name,
       c.relkind            AS relation_kind,
       c.reltuples::bigint  AS planner_row_estimate
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'migrations'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY n.nspname;

-- §1.2 Column definitions of storage.migrations (catalog only).
SELECT a.attnum                                          AS ordinal_position,
       a.attname                                         AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod)   AS data_type,
       a.attnotnull                                      AS not_null,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid)        AS default_expression
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c        ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n    ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'storage'
  AND c.relname = 'migrations'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- §1.3 DEFERRED — Constraints and indexes on storage.migrations (tells us whether "name"
--      is unique, i.e. whether the relation behaves like a journal).
SELECT 'constraint' AS kind, con.conname AS name,
       pg_catalog.pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c     ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relname = 'migrations'
UNION ALL
SELECT 'index', i.indexname, i.indexdef
FROM pg_catalog.pg_indexes i
WHERE i.schemaname = 'storage' AND i.tablename = 'migrations'
ORDER BY 1, 2;

-- §1.4 Row count of storage.migrations (returns one integer; no row contents).
--      Schema is storage, NOT public — the repository defines no migrations
--      relation of its own in the public schema.
SELECT count(*) AS migration_row_count
FROM storage.migrations;

-- §1.4a DEFERRED — Migration labels, ONLY name and executed_at (no hash, no
--       other columns). Not needed for Gate-B classification; lists every label
--       in a platform-owned journal, so run only if the evidence record needs it.
SELECT m.name        AS migration_label,
       m.executed_at AS executed_at
FROM storage.migrations AS m
ORDER BY m.executed_at NULLS LAST, m.name;

-- §1.5 DEFERRED — Label-convention summary (aggregates only).
SELECT count(*)                                                AS label_count,
       min(m.executed_at)                                      AS first_executed_at,
       max(m.executed_at)                                      AS last_executed_at,
       count(*) FILTER (WHERE m.name ILIKE '%.sql')            AS labels_with_sql_suffix,
       count(*) FILTER (WHERE m.name ~ '^[0-9]')               AS labels_starting_with_digit,
       count(*) FILTER (WHERE m.name ~ '^[A-Z0-9_]+(\.sql)?$') AS labels_upper_snake_case
FROM storage.migrations m;

-- §1.6 DEFERRED — Compare storage.migrations labels against the ten expected Gate-B
--      artifact names (case-insensitive, with or without the .sql suffix).
--      Expected outcome: every expected label reports found = false, because
--      this relation is not the application's journal. Any "true" is a review
--      item (it would mean someone recorded a Gate-B label in a foreign journal).
WITH expected(artifact) AS (VALUES
  ('CANCELLATION_NO_SHOW_SUPPORT_V1'),
  ('PILOT_PROVIDER_RETENTION_V1'),
  ('PREVENTED_BOOKING_RECORDS_V1'),
  ('PREVENTED_BOOKINGS_DAILY_V1'),
  ('PROVIDER_APPLICATION_REJECTION_REASON_V1'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1'),
  ('PROVIDER_SERVICE_AREAS_V1'),
  ('PROVIDER_BLOCKED_RANGES_V1'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1')
),
labels AS (
  SELECT lower(regexp_replace(m.name, '\.sql$', '', 'i')) AS norm_label,
         m.name, m.executed_at
  FROM storage.migrations m
)
SELECT e.artifact                                   AS expected_artifact,
       EXISTS (SELECT 1 FROM labels l
               WHERE l.norm_label = lower(e.artifact)) AS found_in_storage_migrations,
       (SELECT min(l.executed_at) FROM labels l
        WHERE l.norm_label = lower(e.artifact))     AS executed_at_if_found
FROM expected e
ORDER BY e.artifact;

-- §1.7 DEFERRED — Labels in storage.migrations that do NOT match any expected Gate-B name
--      (expected: all of them — they belong to another system).
WITH expected(artifact) AS (VALUES
  ('CANCELLATION_NO_SHOW_SUPPORT_V1'),
  ('PILOT_PROVIDER_RETENTION_V1'),
  ('PREVENTED_BOOKING_RECORDS_V1'),
  ('PREVENTED_BOOKINGS_DAILY_V1'),
  ('PROVIDER_APPLICATION_REJECTION_REASON_V1'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1'),
  ('PROVIDER_SERVICE_AREAS_V1'),
  ('PROVIDER_BLOCKED_RANGES_V1'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1')
)
SELECT m.name AS unexpected_label, m.executed_at
FROM storage.migrations m
WHERE lower(regexp_replace(m.name, '\.sql$', '', 'i'))
      NOT IN (SELECT lower(artifact) FROM expected)
ORDER BY m.executed_at, m.name;

-- §1.8 DEFERRED — Any OTHER journal-like relation anywhere (drizzle/flyway/knex/etc.).
--      Expected: only storage.migrations, or additional platform-owned ones.
SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind AS relation_kind
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND (c.relname ILIKE '%migration%'
       OR c.relname ILIKE '%schema_version%'
       OR c.relname ILIKE '%schema_migrations%'
       OR c.relname ILIKE '__drizzle%'
       OR c.relname ILIKE 'flyway%'
       OR c.relname ILIKE 'knex%')
ORDER BY n.nspname, c.relname;


-- ----------------------------------------------------------------------------
-- §2  Base-table prerequisites (every FK / ALTER target in the ten artifacts)
--     Expected: all six present.
-- ----------------------------------------------------------------------------
WITH base(table_name) AS (VALUES
  ('users'), ('bookings'), ('provider_profiles'), ('services'),
  ('support_tickets'), ('provider_applications')
)
SELECT b.table_name,
       EXISTS (SELECT 1 FROM pg_catalog.pg_class c
               JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                 AND c.relname = b.table_name) AS exists_in_public
FROM base b
ORDER BY b.table_name;


-- ----------------------------------------------------------------------------
-- §3  Expected Gate-B object presence — the AUTHORITATIVE state test
-- ----------------------------------------------------------------------------

-- §3.1 Per-object presence (types, tables, indexes, added columns).
--      Optional detail view; run after §3.2 when a per-object breakdown is needed.
WITH expected(artifact, object_kind, object_name) AS (VALUES
  ('PREVENTED_BOOKING_RECORDS_V1',            'type',   'prevented_booking_path'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'table',  'prevented_booking_records'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'index',  'prevented_booking_records_correlation_unique_idx'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'index',  'prevented_booking_records_marketplace_provider_occurred_idx'),
  ('PREVENTED_BOOKINGS_DAILY_V1',             'table',  'prevented_bookings_daily'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'type',   'booking_outcome_action'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'table',  'booking_outcome_history'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'index',  'booking_outcome_history_booking_created_idx'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.cancellation_category'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.no_show_marked_by'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.no_show_marked_at'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'support_tickets.booking_id'),
  ('PILOT_PROVIDER_RETENTION_V1',             'type',   'pilot_retention_intent'),
  ('PILOT_PROVIDER_RETENTION_V1',             'table',  'pilot_provider_retention'),
  ('PROVIDER_APPLICATION_REJECTION_REASON_V1','column', 'provider_applications.rejection_reason'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'index',  'provider_profiles_public_slug_unique_idx'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.public_slug'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.booking_page_published'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.booking_page_published_at'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'bookings.source'),
  ('PROVIDER_SERVICE_AREAS_V1',               'table',  'provider_service_areas'),
  ('PROVIDER_SERVICE_AREAS_V1',               'table',  'provider_coverage_areas'),
  ('PROVIDER_SERVICE_AREAS_V1',               'index',  'provider_coverage_areas_active_prefix_unique_idx'),
  ('PROVIDER_SERVICE_AREAS_V1',               'index',  'provider_coverage_areas_provider_active_idx'),
  ('PROVIDER_BLOCKED_RANGES_V1',              'table',  'provider_blocked_ranges'),
  ('PROVIDER_BLOCKED_RANGES_V1',              'index',  'provider_blocked_ranges_provider_end_idx'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1',          'table',  'provider_emergency_openings'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1',          'index',  'provider_emergency_openings_provider_date_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'type',   'reschedule_proposal_status'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'type',   'reschedule_notification_outcome'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'table',  'booking_reschedule_proposals'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'table',  'booking_reschedule_history'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_single_pending_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_requester_idempotency_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_booking_created_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_history_booking_created_idx')
)
SELECT e.artifact, e.object_kind, e.object_name,
       CASE e.object_kind
         WHEN 'type'   THEN EXISTS (SELECT 1 FROM pg_catalog.pg_type t
                                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                                    WHERE n.nspname = 'public' AND t.typname = e.object_name)
         WHEN 'table'  THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                                    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                                    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                                      AND c.relname = e.object_name)
         WHEN 'index'  THEN EXISTS (SELECT 1 FROM pg_catalog.pg_indexes i
                                    WHERE i.schemaname = 'public' AND i.indexname = e.object_name)
         WHEN 'column' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
                                    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
                                    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                                    WHERE n.nspname = 'public'
                                      AND c.relname = split_part(e.object_name, '.', 1)
                                      AND a.attname = split_part(e.object_name, '.', 2)
                                      AND a.attnum > 0 AND NOT a.attisdropped)
       END AS exists_in_target
FROM expected e
ORDER BY e.artifact, e.object_kind, e.object_name;

-- §3.2 Per-artifact rollup: APPLIED / ABSENT / PARTIAL (PARTIAL = hard stop).
--      RUN THIS BEFORE §3.1 — it is the concise decision table.
--      Expected at this preflight: exactly two APPLIED
--      (PREVENTED_BOOKING_RECORDS_V1, PROVIDER_APPLICATION_REJECTION_REASON_V1),
--      eight ABSENT, zero PARTIAL.
WITH expected(artifact, object_kind, object_name) AS (VALUES
  ('PREVENTED_BOOKING_RECORDS_V1',            'type',   'prevented_booking_path'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'table',  'prevented_booking_records'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'index',  'prevented_booking_records_correlation_unique_idx'),
  ('PREVENTED_BOOKING_RECORDS_V1',            'index',  'prevented_booking_records_marketplace_provider_occurred_idx'),
  ('PREVENTED_BOOKINGS_DAILY_V1',             'table',  'prevented_bookings_daily'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'type',   'booking_outcome_action'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'table',  'booking_outcome_history'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'index',  'booking_outcome_history_booking_created_idx'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.cancellation_category'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.no_show_marked_by'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'bookings.no_show_marked_at'),
  ('CANCELLATION_NO_SHOW_SUPPORT_V1',         'column', 'support_tickets.booking_id'),
  ('PILOT_PROVIDER_RETENTION_V1',             'type',   'pilot_retention_intent'),
  ('PILOT_PROVIDER_RETENTION_V1',             'table',  'pilot_provider_retention'),
  ('PROVIDER_APPLICATION_REJECTION_REASON_V1','column', 'provider_applications.rejection_reason'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'index',  'provider_profiles_public_slug_unique_idx'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.public_slug'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.booking_page_published'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'provider_profiles.booking_page_published_at'),
  ('PROVIDER_PUBLIC_BOOKING_PAGES_V1',        'column', 'bookings.source'),
  ('PROVIDER_SERVICE_AREAS_V1',               'table',  'provider_service_areas'),
  ('PROVIDER_SERVICE_AREAS_V1',               'table',  'provider_coverage_areas'),
  ('PROVIDER_SERVICE_AREAS_V1',               'index',  'provider_coverage_areas_active_prefix_unique_idx'),
  ('PROVIDER_SERVICE_AREAS_V1',               'index',  'provider_coverage_areas_provider_active_idx'),
  ('PROVIDER_BLOCKED_RANGES_V1',              'table',  'provider_blocked_ranges'),
  ('PROVIDER_BLOCKED_RANGES_V1',              'index',  'provider_blocked_ranges_provider_end_idx'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1',          'table',  'provider_emergency_openings'),
  ('PROVIDER_EMERGENCY_OPENINGS_V1',          'index',  'provider_emergency_openings_provider_date_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'type',   'reschedule_proposal_status'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'type',   'reschedule_notification_outcome'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'table',  'booking_reschedule_proposals'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'table',  'booking_reschedule_history'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_single_pending_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_requester_idempotency_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_proposals_booking_created_idx'),
  ('RESCHEDULE_PROPOSALS_HISTORY_V1',         'index',  'reschedule_history_booking_created_idx')
),
presence AS (
  SELECT e.artifact,
         CASE e.object_kind
           WHEN 'type'   THEN EXISTS (SELECT 1 FROM pg_catalog.pg_type t
                                      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                                      WHERE n.nspname = 'public' AND t.typname = e.object_name)
           WHEN 'table'  THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                                      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                                        AND c.relname = e.object_name)
           WHEN 'index'  THEN EXISTS (SELECT 1 FROM pg_catalog.pg_indexes i
                                      WHERE i.schemaname = 'public' AND i.indexname = e.object_name)
           WHEN 'column' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
                                      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
                                      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public'
                                        AND c.relname = split_part(e.object_name, '.', 1)
                                        AND a.attname = split_part(e.object_name, '.', 2)
                                        AND a.attnum > 0 AND NOT a.attisdropped)
         END AS present
  FROM expected e
)
SELECT p.artifact,
       count(*)                          AS expected_objects,
       count(*) FILTER (WHERE p.present) AS present_objects,
       CASE
         WHEN count(*) FILTER (WHERE p.present) = 0        THEN 'ABSENT'
         WHEN count(*) FILTER (WHERE p.present) = count(*) THEN 'APPLIED'
         ELSE 'PARTIAL - HARD STOP'
       END AS artifact_state
FROM presence p
GROUP BY p.artifact
ORDER BY p.artifact;


-- ----------------------------------------------------------------------------
-- §4  Exact-definition comparison for the two artifacts whose objects EXIST
--     Expected values were transcribed by hand from the frozen artifacts at SHA
--     9710454 (PREVENTED_BOOKING_RECORDS_V1.sql sha256 138982a1…f70e29ce;
--     PROVIDER_APPLICATION_REJECTION_REASON_V1.sql sha256 dc978cca…36f06b).
--
--     §4 IS EVIDENCE, NOT AUTHORIZATION. Before any MATCH is treated as final,
--     a human reviewer must re-read the expected VALUES below side by side with
--     the artifact files and docs/managed-db-release-gate.md, because:
--       * the expected lists may be incomplete or mistranscribed;
--       * name/type/nullability/default/constraint/index comparison does not
--         cover ownership, grants, row-level-security policies, triggers,
--         comments, sequence parameters, or storage options (§4.7 surfaces the
--         RLS/policy/trigger/sequence facts for review only);
--       * the artifacts never create policies, grants, or triggers — anything
--         found there indicates a different provenance than the artifact.
--     Any MISMATCH / MISSING / EXTRA is a hard stop.
-- ----------------------------------------------------------------------------

-- §4.1 Enum prevented_booking_path — labels and order.
--      Expected exactly: 1 'preflight', 2 'index_violation'.
WITH expected(sort_order, label) AS (VALUES (1, 'preflight'), (2, 'index_violation')),
actual AS (
  SELECT row_number() OVER (ORDER BY e.enumsortorder) AS sort_order, e.enumlabel AS label
  FROM pg_catalog.pg_enum e
  JOIN pg_catalog.pg_type t      ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'prevented_booking_path'
)
SELECT coalesce(x.sort_order, a.sort_order) AS position,
       x.label AS expected_label,
       a.label AS actual_label,
       CASE WHEN x.label IS NULL THEN 'EXTRA'
            WHEN a.label IS NULL THEN 'MISSING'
            WHEN x.label = a.label THEN 'MATCH'
            ELSE 'MISMATCH' END AS status
FROM expected x
FULL OUTER JOIN actual a ON a.sort_order = x.sort_order
ORDER BY position;

-- §4.2 Table prevented_booking_records — columns (name, order, type,
--      nullability, default). Type names are compared with any leading
--      "public." qualifier removed.
WITH expected(ordinal_position, column_name, data_type, not_null, default_expression) AS (VALUES
  (1,  'id',                 'integer',                     true,  'nextval(''prevented_booking_records_id_seq''::regclass)'),
  (2,  'marketplace_id',     'integer',                     true,  NULL),
  (3,  'correlation_id',     'text',                        true,  NULL),
  (4,  'occurred_at',        'timestamp without time zone', true,  NULL),
  (5,  'recorded_at',        'timestamp without time zone', true,  'now()'),
  (6,  'actor_user_id',      'integer',                     false, NULL),
  (7,  'subject_booking_id', 'integer',                     false, NULL),
  (8,  'provider_id',        'integer',                     false, NULL),
  (9,  'service_id',         'integer',                     false, NULL),
  (10, 'scheduled_at',       'timestamp without time zone', true,  NULL),
  (11, 'path',               'prevented_booking_path',      true,  NULL)
),
actual AS (
  SELECT a.attnum AS ordinal_position,
         a.attname AS column_name,
         regexp_replace(pg_catalog.format_type(a.atttypid, a.atttypmod), '^public\.', '') AS data_type,
         a.attnotnull AS not_null,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c        ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n    ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relname = 'prevented_booking_records'
    AND a.attnum > 0 AND NOT a.attisdropped
)
SELECT coalesce(x.column_name, a.column_name) AS column_name,
       x.ordinal_position   AS expected_position,   a.ordinal_position   AS actual_position,
       x.data_type          AS expected_type,       a.data_type          AS actual_type,
       x.not_null           AS expected_not_null,   a.not_null           AS actual_not_null,
       x.default_expression AS expected_default,    a.default_expression AS actual_default,
       CASE WHEN x.column_name IS NULL THEN 'EXTRA'
            WHEN a.column_name IS NULL THEN 'MISSING'
            WHEN x.ordinal_position = a.ordinal_position
             AND x.data_type = a.data_type
             AND x.not_null = a.not_null
             AND coalesce(x.default_expression, '') = coalesce(a.default_expression, '')
                 THEN 'MATCH'
            ELSE 'MISMATCH' END AS status
FROM expected x
FULL OUTER JOIN actual a ON a.column_name = x.column_name
ORDER BY coalesce(x.ordinal_position, a.ordinal_position);

-- §4.3 Table prevented_booking_records — constraints (PK + four FKs with
--      ON DELETE SET NULL). Definitions are compared to pg_get_constraintdef's
--      canonical text with any "public." qualifier removed; also reports
--      whether each constraint is validated.
WITH expected(constraint_name, definition) AS (VALUES
  ('prevented_booking_records_pkey',
   'PRIMARY KEY (id)'),
  ('prevented_booking_records_actor_user_id_users_id_fk',
   'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL'),
  ('prevented_booking_records_subject_booking_id_bookings_id_fk',
   'FOREIGN KEY (subject_booking_id) REFERENCES bookings(id) ON DELETE SET NULL'),
  ('prevented_booking_records_provider_id_provider_profiles_id_fk',
   'FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE SET NULL'),
  ('prevented_booking_records_service_id_services_id_fk',
   'FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL')
),
actual AS (
  SELECT con.conname AS constraint_name,
         replace(pg_catalog.pg_get_constraintdef(con.oid), 'public.', '') AS definition,
         con.convalidated AS validated
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c     ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'prevented_booking_records'
)
SELECT coalesce(x.constraint_name, a.constraint_name) AS constraint_name,
       x.definition AS expected_definition,
       a.definition AS actual_definition,
       a.validated,
       CASE WHEN x.constraint_name IS NULL THEN 'EXTRA'
            WHEN a.constraint_name IS NULL THEN 'MISSING'
            WHEN x.definition = a.definition AND a.validated THEN 'MATCH'
            ELSE 'MISMATCH' END AS status
FROM expected x
FULL OUTER JOIN actual a ON a.constraint_name = x.constraint_name
ORDER BY constraint_name;

-- §4.4 Table prevented_booking_records — indexes (definition, uniqueness,
--      validity). The PK index is expected in addition to the two artifact
--      indexes. Note "occurred_at DESC NULLS LAST" is non-default for DESC and
--      must appear verbatim. Both sides are compared with the "public." schema
--      qualifier removed. If pg_get_indexdef formatting differs only by
--      whitespace, a human reviewer decides; do not "fix" the database.
WITH expected(index_name, definition, is_unique) AS (VALUES
  ('prevented_booking_records_pkey',
   'CREATE UNIQUE INDEX prevented_booking_records_pkey ON prevented_booking_records USING btree (id)',
   true),
  ('prevented_booking_records_correlation_unique_idx',
   'CREATE UNIQUE INDEX prevented_booking_records_correlation_unique_idx ON prevented_booking_records USING btree (correlation_id)',
   true),
  ('prevented_booking_records_marketplace_provider_occurred_idx',
   'CREATE INDEX prevented_booking_records_marketplace_provider_occurred_idx ON prevented_booking_records USING btree (marketplace_id, provider_id, occurred_at DESC NULLS LAST)',
   false)
),
actual AS (
  SELECT ic.relname AS index_name,
         replace(pg_catalog.pg_get_indexdef(ix.indexrelid), 'public.', '') AS definition,
         ix.indisunique AS is_unique,
         ix.indisvalid  AS is_valid
  FROM pg_catalog.pg_index ix
  JOIN pg_catalog.pg_class ic    ON ic.oid = ix.indexrelid
  JOIN pg_catalog.pg_class tc    ON tc.oid = ix.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = tc.relnamespace
  WHERE n.nspname = 'public' AND tc.relname = 'prevented_booking_records'
)
SELECT coalesce(x.index_name, a.index_name) AS index_name,
       x.definition AS expected_definition,
       a.definition AS actual_definition,
       x.is_unique  AS expected_unique,
       a.is_unique  AS actual_unique,
       a.is_valid,
       CASE WHEN x.index_name IS NULL THEN 'EXTRA'
            WHEN a.index_name IS NULL THEN 'MISSING'
            WHEN x.definition = a.definition AND x.is_unique = a.is_unique AND a.is_valid THEN 'MATCH'
            ELSE 'MISMATCH' END AS status
FROM expected x
FULL OUTER JOIN actual a ON a.index_name = x.index_name
ORDER BY index_name;

-- §4.5 Column provider_applications.rejection_reason — expected: text,
--      nullable, no default (PROVIDER_APPLICATION_REJECTION_REASON_V1).
SELECT a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS actual_type,
       a.attnotnull AS actual_not_null,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS actual_default,
       CASE WHEN pg_catalog.format_type(a.atttypid, a.atttypmod) = 'text'
             AND a.attnotnull = false
             AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) IS NULL
            THEN 'MATCH' ELSE 'MISMATCH' END AS status
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c        ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n    ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relname = 'provider_applications'
  AND a.attname = 'rejection_reason'
  AND a.attnum > 0 AND NOT a.attisdropped;

-- §4.6 DEFERRED — Statistics-view indicators for the existing artifact table (catalog
--      statistics only — no rows are read). PostgreSQL does not record object
--      creation time; provenance must come from operator records.
SELECT s.schemaname, s.relname,
       s.n_live_tup       AS live_tuple_estimate,
       s.n_tup_ins        AS inserts_since_stats_reset,
       s.last_autoanalyze AS last_autoanalyze,
       s.last_analyze     AS last_analyze
FROM pg_catalog.pg_stat_all_tables s
WHERE s.schemaname = 'public' AND s.relname = 'prevented_booking_records';

-- §4.7 DEFERRED — Provenance/semantic facts NOT covered by name/type comparison (review
--      only): row-level security flags, policy names, non-internal trigger
--      names, and the identity sequence of prevented_booking_records. The
--      frozen artifact creates none of RLS/policies/triggers, so
--      rls_enabled = false, zero policies and zero triggers are the values
--      consistent with an artifact-based apply; anything else is a provenance
--      review item. No role names, owners, or grants are printed.
SELECT c.relname                 AS table_name,
       c.relrowsecurity          AS rls_enabled,
       c.relforcerowsecurity     AS rls_forced,
       (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
       (SELECT string_agg(p.polname, ', ' ORDER BY p.polname)
          FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid)               AS policy_names,
       (SELECT count(*) FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = c.oid AND NOT t.tgisinternal)                      AS user_trigger_count,
       (SELECT string_agg(t.tgname, ', ' ORDER BY t.tgname)
          FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = c.oid AND NOT t.tgisinternal)                      AS user_trigger_names
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN ('prevented_booking_records', 'provider_applications')
ORDER BY c.relname;

-- §4.7b DEFERRED — Sequence backing prevented_booking_records.id (expected for SERIAL:
--       integer, start 1, increment 1, owned by that column).
SELECT s.sequencename, s.data_type, s.start_value, s.increment_by,
       pg_catalog.pg_get_serial_sequence('public.prevented_booking_records', 'id') AS owned_by_column_sequence
FROM pg_catalog.pg_sequences s
WHERE s.schemaname = 'public' AND s.sequencename = 'prevented_booking_records_id_seq';


-- ----------------------------------------------------------------------------
-- §5  DEFERRED — Drift scan — tables/enums in public whose names fall in the Gate-B
--     namespaces but are NOT in the expected set. Expected result: zero rows.
-- ----------------------------------------------------------------------------
WITH expected_names(object_name) AS (VALUES
  ('prevented_booking_path'), ('prevented_booking_records'), ('prevented_bookings_daily'),
  ('booking_outcome_action'), ('booking_outcome_history'),
  ('pilot_retention_intent'), ('pilot_provider_retention'),
  ('provider_service_areas'), ('provider_coverage_areas'),
  ('provider_blocked_ranges'), ('provider_emergency_openings'),
  ('reschedule_proposal_status'), ('reschedule_notification_outcome'),
  ('booking_reschedule_proposals'), ('booking_reschedule_history')
),
candidates AS (
  SELECT 'table' AS object_kind, c.relname AS object_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    AND c.relname ~ '^(prevented_|booking_outcome|pilot_|provider_(service_areas|coverage_areas|blocked_ranges|emergency_openings)|booking_reschedule|reschedule_)'
  UNION ALL
  SELECT 'type', t.typname
  FROM pg_catalog.pg_type t
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e'
    AND t.typname ~ '^(prevented_|booking_outcome|pilot_|reschedule_)'
)
SELECT c.object_kind, c.object_name AS unexpected_object
FROM candidates c
WHERE c.object_name NOT IN (SELECT object_name FROM expected_names)
ORDER BY c.object_kind, c.object_name;

-- ============================================================================
-- End of read-only preflight queries. Nothing above changes database state.
-- ============================================================================
