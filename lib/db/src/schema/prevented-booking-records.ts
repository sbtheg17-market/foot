import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { providerProfilesTable } from "./providers";
import { servicesTable } from "./services";
import { bookingsTable } from "./bookings";

/**
 * Prevented duplicate-booking records — Analytics Step 2, Part 1
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md, operator-approved
 * Option B: dedicated append-only table; the closed marketplace_events
 * event_type enum is NOT extended).
 *
 * Approved counting rule (verbatim):
 *   One prevented-booking event = one booking request that reaches the API
 *   and returns HTTP 409 with a numeric bookingId.
 *
 * Invariants:
 *  - Append-only: rows are inserted at the API 409 decision point and never
 *    updated or deleted by application code.
 *  - Idempotency: `correlation_id` is a SERVER-GENERATED UUID (never client
 *    input) and is UNIQUE — replay/duplicate calls can never double-count.
 *  - Privacy: IDs + timestamps + a typed path enum ONLY. Never PII (names,
 *    addresses, notes), never SQLSTATE/constraint names/database internals.
 *    User references use ON DELETE SET NULL so erasure anonymizes the row
 *    while the count survives (matches marketplace_events precedent).
 *  - Reporting only: this table is a rebuildable analytics source. It is
 *    never the booking source of truth and never participates in booking
 *    authorization or transaction decisions.
 *  - Labeling: until the Part 2 reconciliation replay job is implemented and
 *    independently verified, numbers derived from this table must be labeled
 *    "best-effort telemetry that may undercount API 409 responses".
 *
 * Tenancy:
 *  - `marketplace_id` is explicit and NOT NULL from the first row. No FK yet:
 *    the `marketplaces` table does not exist until Blueprint Step 2; its
 *    additive migration MUST seed the default marketplace with
 *    DEFAULT_MARKETPLACE_ID = 1 (slug `oncall-foot`) so historical rows join
 *    cleanly, and MAY then add the FK in its own reviewed migration.
 *
 * DDL boundary (operator-approved approval boundaries):
 *  - This file is the schema DECLARATION only (boundary B1).
 *  - The live DDL ships as a separately reviewed frozen migration artifact
 *    `docs/migrations/PREVENTED_BOOKING_RECORDS_V1.sql` (boundary B2, NOT part
 *    of the Part 1 commit) — additive-only: CREATE TYPE + CREATE TABLE +
 *    indexes; zero statements touching `bookings` or the Race-Proof index.
 *  - Managed-database application requires explicit Gate B authorization in
 *    its own session (boundary B3). Never applied via blind `drizzle-kit
 *    push` (schema-drift review required). Local scratch databases may apply
 *    the DDL freely for tests.
 */

/** How the duplicate was caught. Internal analytics dimension only — never surfaced to clients. */
export const preventedBookingPathEnum = pgEnum("prevented_booking_path", [
  "preflight",
  "index_violation",
]);

export const preventedBookingRecordsTable = pgTable(
  "prevented_booking_records",
  {
    id: serial("id").primaryKey(),

    // Tenancy — explicit, never in metadata (operator-required correction).
    marketplaceId: integer("marketplace_id").notNull(),

    // Idempotency key — server-generated UUID (see app.ts genReqId).
    correlationId: text("correlation_id").notNull(),

    // When the API made the 409 decision / when the row landed.
    occurredAt: timestamp("occurred_at").notNull(),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),

    // Actor: the client whose duplicate request was prevented.
    // SET NULL on user delete → erasure anonymizes without dropping the count.
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),

    // The winning active booking whose id was returned in the 409 body.
    subjectBookingId: integer("subject_booking_id").references(
      () => bookingsTable.id,
      { onDelete: "set null" },
    ),

    // Contested slot dimensions.
    providerId: integer("provider_id").references(
      () => providerProfilesTable.id,
      { onDelete: "set null" },
    ),
    serviceId: integer("service_id").references(() => servicesTable.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at").notNull(),

    // Which guard caught it: sequential preflight or the database race index.
    path: preventedBookingPathEnum("path").notNull(),
  },
  (table) => [
    // Idempotency: one record per request, replay-safe (ON CONFLICT DO NOTHING).
    uniqueIndex("prevented_booking_records_correlation_unique_idx").on(
      table.correlationId,
    ),
    // Future projection reads: per-tenant per-provider time windows.
    index("prevented_booking_records_marketplace_provider_occurred_idx").on(
      table.marketplaceId,
      table.providerId,
      table.occurredAt.desc(),
    ),
  ],
);

export type PreventedBookingRecord =
  typeof preventedBookingRecordsTable.$inferSelect;
export type InsertPreventedBookingRecord =
  typeof preventedBookingRecordsTable.$inferInsert;
