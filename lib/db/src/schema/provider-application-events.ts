import {
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import {
  providerApplicationsTable,
  providerApplicationStatusEnum,
} from "./provider-applications";
import { usersTable } from "./users";

/**
 * Append-only lifecycle event log for provider applications (MC8).
 *
 * A row records a meaningful application status transition at the moment it
 * happens, inside the same transaction as the state change. Rows are
 * append-only: never updated or deleted by application code.
 *
 * Honesty boundary (MC9): the recorded transitions are exactly the ones with
 * a server code path —
 *   - `submitted`      : draft → under_review        (POST /providers/application/submit, owner)
 *   - `reset_to_draft` : rejected → draft            (POST /providers/application/reset, owner)
 *   - `approved`       : under_review → approved     (POST /admin/provider-applications/:id/approve, reviewer)
 *   - `rejected`       : under_review → rejected     (POST /admin/provider-applications/:id/reject, reviewer)
 * Other transitions (e.g. suspension) are NOT recorded until a later
 * checkpoint adds their code paths. Consumers must not present this as a
 * complete lifecycle history beyond these events.
 */
export const providerApplicationEventTypeEnum = pgEnum(
  "provider_application_event_type",
  ["submitted", "reset_to_draft", "approved", "rejected"],
);

export const providerApplicationEventsTable = pgTable(
  "provider_application_events",
  {
    id: serial("id").primaryKey(),
    providerApplicationId: integer("provider_application_id")
      .notNull()
      .references(() => providerApplicationsTable.id, { onDelete: "cascade" }),
    // The provider user the event belongs to (owner of the application).
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: providerApplicationEventTypeEnum("type").notNull(),
    fromStatus: providerApplicationStatusEnum("from_status").notNull(),
    toStatus: providerApplicationStatusEnum("to_status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("provider_application_events_app_created_idx").on(
      table.providerApplicationId,
      table.createdAt,
    ),
  ],
);

export type ProviderApplicationEvent =
  typeof providerApplicationEventsTable.$inferSelect;
export type InsertProviderApplicationEvent =
  typeof providerApplicationEventsTable.$inferInsert;
