import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { providerProfilesTable } from "./providers";
import { bookingsTable } from "./bookings";

export const reviewsTable = pgTable("reviews", {
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
  // 1–5
  rating: integer("rating").notNull(),
  comment: text("comment"),
  // Admin can hide a review
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  isVisible: true,
  createdAt: true,
});

export type InsertReview = typeof reviewsTable.$inferInsert;
export type Review = typeof reviewsTable.$inferSelect;
