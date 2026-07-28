import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

export const providerProfilesTable = pgTable("provider_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  bio: text("bio"),
  city: text("city").notNull().default(""),
  serviceAreaNotes: text("service_area_notes"),
  verificationStatus: verificationStatusEnum("verification_status")
    .notNull()
    .default("pending"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  profileComplete: boolean("profile_complete").notNull().default(false),
  yearsExperience: integer("years_experience"),
  acceptsNewClients: boolean("accepts_new_clients").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProviderProfileSchema = createInsertSchema(
  providerProfilesTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertProviderProfile = typeof providerProfilesTable.$inferInsert;
export type ProviderProfile = typeof providerProfilesTable.$inferSelect;

// ── Travel Zones ──────────────────────────────────────────────────────────────

export const travelZonesTable = pgTable("travel_zones", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
  zoneName: text("zone_name").notNull(),
  city: text("city").notNull(),
  notes: text("notes"),
});

export const insertTravelZoneSchema = createInsertSchema(
  travelZonesTable
).omit({ id: true });

export type InsertTravelZone = typeof travelZonesTable.$inferInsert;
export type TravelZone = typeof travelZonesTable.$inferSelect;

// ── Availability ──────────────────────────────────────────────────────────────

export const availabilityTable = pgTable("availability", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
  // 0 = Sunday … 6 = Saturday
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(), // "HH:MM" 24h
  endTime: text("end_time").notNull(), // "HH:MM" 24h
});

export const insertAvailabilitySchema = createInsertSchema(
  availabilityTable
).omit({ id: true });

export type InsertAvailability = typeof availabilityTable.$inferInsert;
export type Availability = typeof availabilityTable.$inferSelect;

// ── Verification Documents ────────────────────────────────────────────────────

export const verificationDocStatusEnum = pgEnum("verification_doc_status", [
  "pending",
  "approved",
  "rejected",
]);

export const verificationDocsTable = pgTable("verification_docs", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(), // e.g. "license", "insurance"
  fileName: text("file_name").notNull(),
  status: verificationDocStatusEnum("status").notNull().default("pending"),
  reviewerNotes: text("reviewer_notes"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertVerificationDocSchema = createInsertSchema(
  verificationDocsTable
).omit({ id: true, submittedAt: true, reviewedAt: true });

export type InsertVerificationDoc = typeof verificationDocsTable.$inferInsert;
export type VerificationDoc = typeof verificationDocsTable.$inferSelect;
