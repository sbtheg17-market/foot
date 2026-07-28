import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { providerProfilesTable } from "./providers";

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  // Store price in cents (CAD) to avoid float precision issues
  priceCents: integer("price_cents").notNull(),
  // e.g. "foot_care" | "pedicure" | "wellness" | "senior_care" | "diabetic_care"
  category: text("category").notNull().default("foot_care"),
  eligibilityNotes: text("eligibility_notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertService = typeof servicesTable.$inferInsert;
export type Service = typeof servicesTable.$inferSelect;
