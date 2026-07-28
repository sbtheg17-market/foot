import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
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

export const bookingsTable = pgTable("bookings", {
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
});

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
