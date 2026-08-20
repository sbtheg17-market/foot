import {
  check,
  date,
  integer,
  pgTable,
  serial,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Prevented duplicate-booking daily projection — Analytics Step 2, Part 3.
 *
 * Read-optimized DAILY AGGREGATE projection over `prevented_booking_records`
 * (the ONLY source — this table is never written by request paths, only by
 * the rebuild script
 * `artifacts/api-server/src/scripts/rebuild-prevented-bookings-daily.ts`;
 * procedure: docs/projection-rebuild-runbook.md).
 *
 * Grain: (marketplace_id, provider_id, service_id, day_utc) — one row per
 * tenant/provider/service/UTC-day combination. `service_id` is retained as a
 * first-class dimension.
 *
 * Invariants:
 *  - PROJECTION ONLY: rebuildable at any time from the source table; never a
 *    source of truth; never read in booking authorization or transaction
 *    decision paths.
 *  - NULLABLE DIMENSIONS: `provider_id` / `service_id` are nullable because
 *    the source anonymizes those references via ON DELETE SET NULL. A NULL
 *    dimension means "anonymized", and rows sharing the anonymized grain
 *    aggregate together — uniqueness uses NULLS NOT DISTINCT so at most one
 *    row per grain can ever exist, NULLs included.
 *  - TENANCY: `marketplace_id` is NOT NULL. Verified source invariant
 *    (lib/db/src/schema/prevented-booking-records.ts and
 *    docs/migrations/PREVENTED_BOOKING_RECORDS_V1.sql): the source column is
 *    NOT NULL with no FK and no SET NULL path — anonymization can only null
 *    the actor/subject/provider/service dimensions, never the tenant.
 *  - METRICS AS COLUMNS: `attempts_total`, `preflight_count`,
 *    `index_violation_count`, with the database-enforced CHECK
 *    attempts_total = preflight_count + index_violation_count.
 *  - NO DISTINCT-CORRELATION COLUMN: the source is unique by
 *    `correlation_id` by construction, so a per-row distinct count would
 *    always equal attempts_total. The rebuild script asserts
 *    COUNT(*) = COUNT(DISTINCT correlation_id) over the rebuilt range as a
 *    reconciliation tripwire instead of storing a redundant column.
 *  - PRIVACY: per-path counts (`preflight_count`, `index_violation_count`)
 *    are internal analytics dimensions and are NEVER exposed to ordinary
 *    clients. Any future client-facing endpoint may surface
 *    `attempts_total` only.
 *  - NO FOREIGN KEYS: deliberately none to provider/service tables — the
 *    projection must survive dimension-row deletion exactly like its source
 *    and is replaced wholesale by rebuilds.
 *  - DAY BOUNDARIES: `day_utc` is the fixed UTC calendar day of the source
 *    `occurred_at` (timestamp without time zone, stored as UTC). The rebuild
 *    session pins SET TIME ZONE 'UTC' so day bucketing can never drift with
 *    process or session timezone.
 *  - LABELING: numbers derived from this projection inherit the source
 *    label — "best-effort telemetry that may undercount API 409 responses" —
 *    until the source reliability verification completes.
 *
 * Surrogate key decision (recorded, not silent):
 *  - `id serial PRIMARY KEY` is RETAINED. The logical grain cannot be the
 *    PRIMARY KEY because PostgreSQL primary keys forbid nullable columns and
 *    `provider_id`/`service_id` are nullable by design; the alternative is a
 *    table with no primary key at all. The surrogate keeps Drizzle and admin
 *    tooling ergonomics (row identity, `.returning`, future REPLICA
 *    IDENTITY) at zero risk: it is rebuild-generation-local, carries no
 *    meaning, and is never exposed through any API. Grain uniqueness is
 *    enforced independently by the UNIQUE NULLS NOT DISTINCT constraint.
 *
 * DDL boundary (operator-approved approval boundaries):
 *  - This file is the schema DECLARATION only (boundary B1).
 *  - The live DDL ships as the separately reviewed frozen migration artifact
 *    `docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql` (boundary B2) —
 *    additive-only: one CREATE TABLE; zero statements touching any existing
 *    object. Requires PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT).
 *  - Managed-database application requires explicit Gate B authorization in
 *    its own session (boundary B3). Never applied via blind `drizzle-kit
 *    push` (schema-drift review required). Local scratch databases may apply
 *    the DDL freely for tests.
 *  - KNOWN TOOLING GAP (documented, harmless): drizzle-kit 0.31.x database
 *    introspection reports unique constraints without their NULLS NOT
 *    DISTINCT flag, so a local scratch `db:push` re-creates this constraint
 *    (with the identical definition) on every run — the same benign churn
 *    the repository already shows for four truncated FK constraint names.
 *    The managed database is never pushed (B3 apply-once only), so the gap
 *    has no production surface.
 */
export const preventedBookingsDailyTable = pgTable(
  "prevented_bookings_daily",
  {
    id: serial("id").primaryKey(),

    // Tenancy — NOT NULL is safe: verified source invariant (see header).
    marketplaceId: integer("marketplace_id").notNull(),

    // Anonymizable dimensions — NULL means the source row was anonymized.
    providerId: integer("provider_id"),
    serviceId: integer("service_id"),

    // Fixed UTC calendar day of the source occurred_at.
    dayUtc: date("day_utc").notNull(),

    // Metrics — per-path counts are never surfaced to ordinary clients.
    attemptsTotal: integer("attempts_total").notNull(),
    preflightCount: integer("preflight_count").notNull(),
    indexViolationCount: integer("index_violation_count").notNull(),
  },
  (table) => [
    // At most one row per grain, anonymized (NULL) dimensions included.
    unique("prevented_bookings_daily_grain_unique")
      .on(table.marketplaceId, table.providerId, table.serviceId, table.dayUtc)
      .nullsNotDistinct(),
    // Path counts must always account for every attempt.
    check(
      "prevented_bookings_daily_path_sum_check",
      sql`${table.attemptsTotal} = ${table.preflightCount} + ${table.indexViolationCount}`,
    ),
  ],
);

export type PreventedBookingsDaily =
  typeof preventedBookingsDailyTable.$inferSelect;
export type InsertPreventedBookingsDaily =
  typeof preventedBookingsDailyTable.$inferInsert;
