import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { bookingsTable, bookingStatusEnum } from "./bookings";
import { accountRoleEnum } from "./account-roles";

/**
 * Cancellation/no-show outcome history (roadmap #13, docs/cancellation-no-show-policy.md).
 *
 * APPEND-ONLY: application code must never UPDATE or DELETE rows in this
 * table. Every cancellation, no-show marking, and support correction appends
 * exactly one row in the same transaction as the booking write, mirroring
 * the booking_reschedule_history pattern (roadmap item 9).
 *
 * Privacy: `reason_snapshot` holds private free-text (support/admin-visible
 * only). Cross-party responses expose only the allowlisted `reason_category`.
 */

export const bookingOutcomeActionEnum = pgEnum("booking_outcome_action", [
  "cancelled",
  "no_show",
  "support_corrected",
]);

export const bookingOutcomeHistoryTable = pgTable(
  "booking_outcome_history",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookingsTable.id),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => usersTable.id),
    actorRole: accountRoleEnum("actor_role").notNull(),
    action: bookingOutcomeActionEnum("action").notNull(),
    // Server-computed policy category (allowlisted, e.g. client_cancelled_early,
    // client_cancelled_late, provider_cancelled, cancelled_by_support). Null for
    // actions that carry no category (no_show marking).
    category: text("category"),
    // Allowlisted structured reason shared across parties (provider cancels).
    reasonCategory: text("reason_category"),
    // Private free-text snapshot — support/admin-visible only, never cross-party.
    reasonSnapshot: text("reason_snapshot"),
    previousStatus: bookingStatusEnum("previous_status").notNull(),
    newStatus: bookingStatusEnum("new_status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("booking_outcome_history_booking_created_idx").on(
      table.bookingId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export type BookingOutcomeHistoryRow = typeof bookingOutcomeHistoryTable.$inferSelect;
export type InsertBookingOutcomeHistoryRow = typeof bookingOutcomeHistoryTable.$inferInsert;
