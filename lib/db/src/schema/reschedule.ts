import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { bookingsTable, bookingStatusEnum } from "./bookings";
import { accountRoleEnum } from "./account-roles";

/**
 * Consent-first provider rescheduling (roadmap item 9, approved policy in
 * docs/rescheduling-policy.md). A provider proposal NEVER changes
 * bookings.scheduled_at — the confirmed time stays authoritative until the
 * client accepts. History rows are append-only: application code must never
 * UPDATE or DELETE them.
 */

export const rescheduleProposalStatusEnum = pgEnum("reschedule_proposal_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
  "unresolved",
]);

export const rescheduleNotificationOutcomeEnum = pgEnum(
  "reschedule_notification_outcome",
  ["not_requested", "sent", "failed"],
);

export const rescheduleProposalsTable = pgTable(
  "booking_reschedule_proposals",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookingsTable.id),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => usersTable.id),
    requesterRole: accountRoleEnum("requester_role").notNull(),
    originalScheduledAt: timestamp("original_scheduled_at").notNull(),
    proposedScheduledAt: timestamp("proposed_scheduled_at").notNull(),
    reason: text("reason"),
    status: rescheduleProposalStatusEnum("status").notNull().default("pending"),
    deadlineAt: timestamp("deadline_at").notNull(),
    respondedByUserId: integer("responded_by_user_id").references(() => usersTable.id),
    resolvedAt: timestamp("resolved_at"),
    idempotencyKey: text("idempotency_key").notNull(),
    version: integer("version").notNull().default(1),
    notificationOutcome: rescheduleNotificationOutcomeEnum("notification_outcome")
      .notNull()
      .default("not_requested"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // One retry with the same key returns the same proposal — never a second row.
    uniqueIndex("reschedule_proposals_requester_idempotency_idx").on(
      table.requesterUserId,
      table.idempotencyKey,
    ),
    // A booking can have at most ONE active proposal (no competing proposals).
    uniqueIndex("reschedule_proposals_single_pending_idx")
      .on(table.bookingId)
      .where(sql`status = 'pending'`),
    index("reschedule_proposals_booking_created_idx").on(
      table.bookingId,
      table.createdAt.desc(),
    ),
  ],
);

export const rescheduleHistoryTable = pgTable(
  "booking_reschedule_history",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookingsTable.id),
    proposalId: integer("proposal_id").references(() => rescheduleProposalsTable.id),
    originalScheduledAt: timestamp("original_scheduled_at").notNull(),
    newScheduledAt: timestamp("new_scheduled_at").notNull(),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => usersTable.id),
    requesterRole: accountRoleEnum("requester_role").notNull(),
    respondedByUserId: integer("responded_by_user_id").references(() => usersTable.id),
    reason: text("reason"),
    previousStatus: bookingStatusEnum("previous_status").notNull(),
    newStatus: bookingStatusEnum("new_status").notNull(),
    idempotencyKey: text("idempotency_key"),
    notificationOutcome: rescheduleNotificationOutcomeEnum("notification_outcome")
      .notNull()
      .default("not_requested"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reschedule_history_booking_created_idx").on(
      table.bookingId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export type RescheduleProposal = typeof rescheduleProposalsTable.$inferSelect;
export type InsertRescheduleProposal = typeof rescheduleProposalsTable.$inferInsert;
export type RescheduleHistoryRow = typeof rescheduleHistoryTable.$inferSelect;
export type InsertRescheduleHistoryRow = typeof rescheduleHistoryTable.$inferInsert;
