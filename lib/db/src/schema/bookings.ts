import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { providerProfilesTable } from "./providers";
import { servicesTable } from "./services";

export const bookingStatusEnum = pgEnum("booking_status", [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show",
]);

export const bookingsTable = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => usersTable.id),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id),
    serviceId: integer("service_id")
      .notNull()
      .references(() => servicesTable.id),
    status: bookingStatusEnum("status").notNull().default("requested"),
    scheduledAt: timestamp("scheduled_at").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    careNotes: text("care_notes"),
    clientNotes: text("client_notes"),
    cancelledBy: integer("cancelled_by").references(() => usersTable.id),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    /**
     * Mirror of the LIVE database index applied 2026-08-12 (Session 073),
     * byte-for-byte per the approved frozen packet
     * (SQL SHA-256 aece832e2356eb8c70f33bacaab3e7153fcfb4637788ba85eead9348d3594612):
     *
     *   CREATE UNIQUE INDEX bookings_active_booking_unique_idx
     *   ON public.bookings (client_id, provider_id, service_id, scheduled_at)
     *   WHERE status IN ('requested','confirmed','rescheduled');
     *
     * Declaration-only mirror: no migration is generated or run by this file.
     * Do NOT rename or remove without a separately approved schema task.
     * If any future drizzle-kit push proposes DROP INDEX or DROP/CREATE for
     * this index, STOP: it requires a separately reviewed migration.
     */
    uniqueIndex("bookings_active_booking_unique_idx")
      .on(table.clientId, table.providerId, table.serviceId, table.scheduledAt)
      .where(sql`status IN ('requested','confirmed','rescheduled')`),
  ],
);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  status: true,
  cancelledBy: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = typeof bookingsTable.$inferInsert;
export type Booking = typeof bookingsTable.$inferSelect;
