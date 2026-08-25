import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { providerProfilesTable } from "./providers";

// ── Provider service areas (roadmap #12) ─────────────────────────────────────
//
// Canada-first, provider-managed postal-prefix (FSA) coverage. One
// configuration row per provider plus zero or more coverage entries. The
// model is country-aware for future expansion, but only Canadian FSA
// enforcement is functional in this release. NO coordinates, geocoding,
// routing, radius, or polygon data is stored — coverage is an eligibility
// rule, never a drive-time guarantee.
//
// Existing providers have NO row here by default: they remain safely
// unconfigured (marketplace behavior unchanged; public booking-page
// eligibility reports `unavailable` until setup is complete).

export const providerServiceAreasTable = pgTable(
  "provider_service_areas",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .unique()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    // ISO 3166-1 alpha-2. Canada-first: only "CA" is accepted by the API in
    // this release; the column is country-aware for future expansion.
    countryCode: text("country_code").notNull().default("CA"),
    // Canadian province/territory code, e.g. "ON". Validated at the API
    // boundary against the canonical province list.
    provinceCode: text("province_code").notNull().default(""),
    // Optional city context shown publicly (e.g. "Toronto").
    city: text("city"),
    // Plain-language, provider-written public summary shown on the booking
    // page (e.g. "Serving downtown Toronto and East York"). NEVER used as
    // the authoritative eligibility rule.
    publicDescription: text("public_description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const insertProviderServiceAreaSchema = createInsertSchema(
  providerServiceAreasTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertProviderServiceArea =
  typeof providerServiceAreasTable.$inferInsert;
export type ProviderServiceArea = typeof providerServiceAreasTable.$inferSelect;

// ── Coverage entries (normalized FSA prefixes) ───────────────────────────────
//
// One row per covered Canadian postal prefix (FSA — the first three postal
// characters, e.g. "M5V"). Prefixes are normalized (uppercase, no
// whitespace) at the API boundary before insert. Removal deactivates the
// row (is_active = false) so safe audit metadata is retained; the partial
// unique index keeps ACTIVE coverage unique per provider while allowing
// re-adding a previously removed prefix.

export const providerCoverageAreasTable = pgTable(
  "provider_coverage_areas",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull().default("CA"),
    // Normalized Canadian FSA (first three postal-code characters).
    prefix: text("prefix").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Unique ACTIVE normalized coverage entry per provider. Deactivated
    // rows (removed prefixes) are excluded so a prefix can be re-added.
    uniqueIndex("provider_coverage_areas_active_prefix_unique_idx")
      .on(table.providerId, table.countryCode, table.prefix)
      .where(sql`is_active = true`),
    // Fast public eligibility lookup: all active coverage for one provider.
    index("provider_coverage_areas_provider_active_idx").on(
      table.providerId,
      table.isActive,
    ),
  ],
);

export const insertProviderCoverageAreaSchema = createInsertSchema(
  providerCoverageAreasTable,
).omit({ id: true, createdAt: true });

export type InsertProviderCoverageArea =
  typeof providerCoverageAreasTable.$inferInsert;
export type ProviderCoverageArea =
  typeof providerCoverageAreasTable.$inferSelect;
