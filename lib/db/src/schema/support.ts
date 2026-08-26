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
import { bookingsTable } from "./bookings";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  subject: text("subject").notNull(),
  // Roadmap #13: additive, nullable booking link for cancellation/no-show
  // escalations. Plain support tickets keep it null. No cascade delete —
  // booking history is never removed by ticket lifecycle.
  bookingId: integer("booking_id").references(() => bookingsTable.id),
  status: ticketStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable
).omit({ id: true, status: true, bookingId: true, createdAt: true, updatedAt: true });

export const insertSupportMessageSchema = createInsertSchema(
  supportMessagesTable
).omit({ id: true, createdAt: true });

export type InsertSupportTicket = typeof supportTicketsTable.$inferInsert;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type InsertSupportMessage = typeof supportMessagesTable.$inferInsert;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
