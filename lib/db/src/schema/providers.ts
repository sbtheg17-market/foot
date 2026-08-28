import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
  index,
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

// ── Emergency Openings (one-off extra slots) ──────────────────────────────────
//
// Date-specific EXTRA availability outside the weekly windows
// (docs/emergency-openings-policy.md). Additive to the existing availability
// model: openings never modify the recurring schedule and are consumed by the
// SAME slot/enforcement engine. `date` is a calendar date (YYYY-MM-DD) in the
// effective marketplace timezone; times are wall-clock "HH:MM" like the
// weekly `availability` table. `service_ids` NULL/empty = all active
// services. `urgent_only` is a client-facing label only — the booking flow is
// unchanged.

export const providerEmergencyOpeningsTable = pgTable(
  "provider_emergency_openings",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "YYYY-MM-DD" (marketplace timezone)
    startTime: text("start_time").notNull(), // "HH:MM" 24h
    endTime: text("end_time").notNull(), // "HH:MM" 24h
    serviceIds: integer("service_ids").array(),
    urgentOnly: boolean("urgent_only").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("provider_emergency_openings_provider_date_idx").on(
      table.providerId,
      table.date,
    ),
  ],
);

export const insertEmergencyOpeningSchema = createInsertSchema(
  providerEmergencyOpeningsTable
).omit({ id: true, createdAt: true });

export type InsertEmergencyOpening =
  typeof providerEmergencyOpeningsTable.$inferInsert;
export type EmergencyOpening = typeof providerEmergencyOpeningsTable.$inferSelect;
