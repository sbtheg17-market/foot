import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

export const providerProfilesTable = pgTable(
  "provider_profiles",
  {
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
    // Provider-owned public booking page (roadmap #11). The slug is assigned
    // at first publish and is NOT provider-editable afterwards (a rename
    // requires a future redirect/history policy). Providers stay unpublished
    // until they intentionally publish.
    publicSlug: text("public_slug"),
    bookingPagePublished: boolean("booking_page_published")
      .notNull()
      .default(false),
    bookingPagePublishedAt: timestamp("booking_page_published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Global slug uniqueness (NULLs excluded by PostgreSQL semantics).
    uniqueIndex("provider_profiles_public_slug_unique_idx").on(table.publicSlug),
  ],
);

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

// ── Availability Exceptions (Phase B — blocked dates) ────────────────────────
// Date-scoped overrides of the weekly schedule. `date` is a "YYYY-MM-DD"
// marketplace-local calendar date (same wall-clock semantics as the weekly
// windows). The enum leaves room for a future 'emergency_open' value.
// Policy: docs/availability-exceptions-policy.md.

export const availabilityExceptionTypeEnum = pgEnum(
  "availability_exception_type",
  ["blocked"],
);

export const availabilityExceptionsTable = pgTable(
  "provider_availability_exceptions",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "YYYY-MM-DD" marketplace-local
    type: availabilityExceptionTypeEnum("type").notNull().default("blocked"),
    reason: text("reason"), // provider-private, never exposed publicly
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "provider_availability_exceptions_provider_date_unique_idx",
    ).on(table.providerId, table.date),
  ],
);

export const insertAvailabilityExceptionSchema = createInsertSchema(
  availabilityExceptionsTable
).omit({ id: true, createdAt: true });

export type InsertAvailabilityException =
  typeof availabilityExceptionsTable.$inferInsert;
export type AvailabilityException =
  typeof availabilityExceptionsTable.$inferSelect;

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
