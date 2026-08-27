import { pgTable, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { providerProfilesTable } from "./providers";

/**
 * Pilot provider retention intent (Pilot Operations Dashboard, Part 1).
 *
 * One row per provider, recorded by an admin after a provider conversation
 * ("do you intend to keep using the platform after the pilot?"). Vertical-
 * neutral: this is an operator signal, not a clinical or ranking value.
 *
 * Privacy: admin-only read/write through /admin/pilot routes; never exposed
 * to providers, clients, or public endpoints.
 */

export const pilotRetentionIntentEnum = pgEnum("pilot_retention_intent", [
  "yes",
  "no",
  "unknown",
]);

export const pilotProviderRetentionTable = pgTable("pilot_provider_retention", {
  id: serial("id").primaryKey(),
  // One row per provider (unique). No cascade delete: retention history must
  // not silently disappear with unrelated lifecycle operations.
  providerId: integer("provider_id")
    .notNull()
    .unique()
    .references(() => providerProfilesTable.id),
  retentionIntent: pilotRetentionIntentEnum("retention_intent")
    .notNull()
    .default("unknown"),
  // Admin actor who recorded the intent (audit).
  updatedBy: integer("updated_by")
    .notNull()
    .references(() => usersTable.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPilotProviderRetentionSchema = createInsertSchema(
  pilotProviderRetentionTable
).omit({ id: true, updatedAt: true });

export type InsertPilotProviderRetention =
  typeof pilotProviderRetentionTable.$inferInsert;
export type PilotProviderRetention =
  typeof pilotProviderRetentionTable.$inferSelect;
