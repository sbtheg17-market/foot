import { db, providerNotificationsTable } from "@workspace/db";

/**
 * In-app notification creation for provider-application lifecycle events
 * (MC9 Commit 2 — extracted from routes/providers.ts and extended with the
 * reviewer-driven decision events).
 *
 * A notification row is always created inside the SAME transaction as the
 * lifecycle event it references, so a notification exists iff the transition
 * committed. `UNIQUE(user_id, event_id)` + `onConflictDoNothing` make
 * creation idempotent under at-least-once semantics — a retried transition
 * never double-notifies.
 *
 * Content is server-rendered, static, and event-keyed; `link` is a
 * provider-safe relative in-app path. No reviewer-private material
 * (`reviewerNotes`, `reviewedBy`) and no per-decision free text is ever
 * stored here — the status page is the single place that surfaces the
 * provider-visible `rejectionReason`.
 */

// Drizzle transaction handle type, derived from db.transaction's callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ApplicationEventType =
  | "submitted"
  | "reset_to_draft"
  | "approved"
  | "rejected";

export const NOTIFICATION_CONTENT: Record<
  ApplicationEventType,
  { title: string; body: string; link: string }
> = {
  submitted: {
    title: "Application submitted",
    body: "Your provider application was submitted and is now under review.",
    link: "/provider/application-status",
  },
  reset_to_draft: {
    title: "Application reopened",
    body: "Your application was reset to draft. You can update your details and resubmit when ready.",
    link: "/provider/application-status",
  },
  approved: {
    title: "Application approved",
    body: "Congratulations — your provider application was approved. Check your application status for what happens next.",
    link: "/provider/application-status",
  },
  rejected: {
    title: "Application decision",
    body: "Your provider application was reviewed and not approved. View your application status for the reason and next steps.",
    link: "/provider/application-status",
  },
};

/**
 * Create the in-app notification for a lifecycle event, inside the same
 * transaction as the event. Idempotent via UNIQUE(user_id, event_id):
 * onConflictDoNothing means a retried transition never double-notifies.
 */
export async function createApplicationNotification(
  tx: Tx,
  userId: number,
  eventId: number,
  type: ApplicationEventType,
): Promise<void> {
  const content = NOTIFICATION_CONTENT[type];
  await tx
    .insert(providerNotificationsTable)
    .values({
      userId,
      eventId,
      type,
      title: content.title,
      body: content.body,
      link: content.link,
    })
    .onConflictDoNothing({
      target: [
        providerNotificationsTable.userId,
        providerNotificationsTable.eventId,
      ],
    });
}
