import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import {
  providerApplicationEventsTable,
  providerApplicationEventTypeEnum,
} from "./provider-application-events";
import { usersTable } from "./users";

/**
 * In-app, provider-facing notifications (MC8-lite Commit 3).
 *
 * Each row is created in the SAME transaction as the lifecycle event it
 * references (`provider_application_events`), so a notification exists iff the
 * transition committed. `UNIQUE(user_id, event_id)` makes creation idempotent
 * under at-least-once semantics — a retried transition never double-notifies.
 *
 * Content is server-rendered and event-keyed; `link` is a provider-safe
 * relative path. No reviewer-private material is ever stored here. Covered
 * event types: `submitted`, `reset_to_draft`, `approved`, `rejected`. Push
 * and email delivery, outbox/retry, and reviewer/admin notifications remain
 * out of scope for this line.
 */
export const providerNotificationsTable = pgTable(
  "provider_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => providerApplicationEventsTable.id, {
        onDelete: "cascade",
      }),
    type: providerApplicationEventTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Owner-scoped, newest-first listing (created_at DESC, id DESC).
    index("provider_notifications_user_created_id_idx").on(
      table.userId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    // Idempotency: one notification per (recipient, lifecycle event).
    unique("provider_notifications_user_event_unique").on(
      table.userId,
      table.eventId,
    ),
  ],
);

export type ProviderNotification =
  typeof providerNotificationsTable.$inferSelect;
export type InsertProviderNotification =
  typeof providerNotificationsTable.$inferInsert;
