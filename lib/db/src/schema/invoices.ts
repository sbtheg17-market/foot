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
import { bookingsTable } from "./bookings";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "cancelled",
]);

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .unique()
    .references(() => bookingsTable.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => usersTable.id),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providerProfilesTable.id),
  // Amount in cents (CAD)
  amountCents: integer("amount_cents").notNull(),
  status: invoiceStatusEnum("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  // Future Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  paidAt: true,
  stripePaymentIntentId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type Invoice = typeof invoicesTable.$inferSelect;
