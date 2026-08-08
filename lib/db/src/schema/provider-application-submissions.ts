import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { providerApplicationsTable } from "./provider-applications";
import { usersTable } from "./users";

/**
 * Immutable per-cycle history of provider application submissions.
 *
 * A row is written whenever a submission cycle closes on the main
 * `provider_applications` row — currently only via the owner-driven
 * `rejected → draft` reset transition. Rows are append-only: they are never
 * updated or deleted by application code. The main table keeps the current
 * open cycle; this table preserves what happened during prior cycles so
 * reviewers and providers retain audit context after a reset.
 *
 * Private reviewer material (`reviewerNotes`) is stored here but must never
 * be surfaced to non-admin API responses. The provider-visible
 * `rejectionReason` is safe to expose to the owner of the application.
 */
export const providerApplicationSubmissionOutcomeEnum = pgEnum(
  "provider_application_submission_outcome",
  ["rejected"],
);

export const providerApplicationSubmissionsTable = pgTable(
  "provider_application_submissions",
  {
    id: serial("id").primaryKey(),
    providerApplicationId: integer("provider_application_id")
      .notNull()
      .references(() => providerApplicationsTable.id, { onDelete: "cascade" }),
    outcome:
      providerApplicationSubmissionOutcomeEnum("outcome").notNull(),
    submittedAt: timestamp("submitted_at").notNull(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    reviewerNotes: text("reviewer_notes"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Composite index tuned for the owner-scoped submission-history query
    // (WHERE provider_application_id = ? ORDER BY created_at DESC, id DESC),
    // matching the MC5 keyset pagination. The leading equality column also
    // serves the ascending owner lookup in getOwnApplication, so the former
    // single-column `provider_application_submissions_app_idx` is redundant
    // and intentionally removed.
    index("provider_application_submissions_app_created_id_idx").on(
      table.providerApplicationId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);

export type ProviderApplicationSubmission =
  typeof providerApplicationSubmissionsTable.$inferSelect;
export type InsertProviderApplicationSubmission =
  typeof providerApplicationSubmissionsTable.$inferInsert;
