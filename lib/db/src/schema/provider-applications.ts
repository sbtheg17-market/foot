import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { providerProfilesTable } from "./providers";
import { usersTable } from "./users";

/**
 * Provider onboarding and review state.
 *
 * This table is intentionally separate from provider business data and from
 * authorization. An approved application will later be required for provider
 * operations; creating or editing an application does not grant that access.
 */
export const providerApplicationStatusEnum = pgEnum(
  "provider_application_status",
  ["draft", "under_review", "approved", "rejected", "suspended"],
);

export const providerApplicationStepEnum = pgEnum(
  "provider_application_step",
  ["profile", "services", "availability", "verification", "submitted"],
);

export const providerApplicationsTable = pgTable(
  "provider_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    providerProfileId: integer("provider_profile_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    status: providerApplicationStatusEnum("status").notNull().default("draft"),
    currentStep: providerApplicationStepEnum("current_step")
      .notNull()
      .default("profile"),
    submittedAt: timestamp("submitted_at"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    reviewerNotes: text("reviewer_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("provider_applications_user_id_idx").on(table.userId),
    index("provider_applications_status_idx").on(table.status),
    unique("provider_applications_user_unique").on(table.userId),
    unique("provider_applications_profile_unique").on(table.providerProfileId),
  ],
);

export type ProviderApplication = typeof providerApplicationsTable.$inferSelect;
export type InsertProviderApplication =
  typeof providerApplicationsTable.$inferInsert;