import { db, preventedBookingRecordsTable } from "@workspace/db";
import { logger } from "./logger.js";
import { DEFAULT_MARKETPLACE_ID } from "./marketplace-defaults.js";

/**
 * Durable recording of prevented duplicate bookings — Analytics Step 2,
 * Part 1 (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md §4, operator-
 * approved packet v2).
 *
 * Approved counting rule (verbatim):
 *   One prevented-booking event = one booking request that reaches the API
 *   and returns HTTP 409 with a numeric bookingId.
 *
 * Contract:
 *  - OWN-TRANSACTION recording: a single-row autocommit INSERT — the
 *    rolled-back booking transaction on the index_violation branch is never
 *    reused.
 *  - ONE bounded retry on failure, reusing the SAME correlation_id.
 *  - IDEMPOTENT: ON CONFLICT (correlation_id) DO NOTHING — the unique index
 *    makes replay (Part 2 job) and stray double-calls duplicate-proof.
 *  - STRUCTURED RECONCILIATION LOGGING: on double failure, one log line
 *    (`evt: "prevented_booking_record_failed"`) carries the COMPLETE event
 *    payload so the separately-reviewed Part 2 replay job can re-insert it
 *    by correlation_id with zero reconstruction.
 *  - FAILURE ISOLATION: this function NEVER throws and never delays the
 *    caller beyond the bounded insert + one retry. The client's 409 response
 *    (message + bookingId) is byte-identical whether recording succeeds or
 *    fails.
 *  - PRIVACY: ids + timestamps + the path discriminator only. The caller
 *    never passes the raw database error here, so SQLSTATE codes, constraint
 *    names, and database internals can never leak into rows or logs.
 *
 * Labeling rule: until the Part 2 reconciliation replay job is implemented
 * and independently verified, any number derived from these records must be
 * labeled "best-effort telemetry that may undercount API 409 responses".
 */

export type PreventedBookingPath = "preflight" | "index_violation";

export type PreventedBookingEvent = {
  /** Server-generated request UUID (app.ts genReqId) — the idempotency key. */
  correlationId: string;
  /** Requesting client whose duplicate attempt was prevented. */
  actorUserId: number;
  /** The winning active booking id returned in the 409 body. */
  subjectBookingId: number;
  providerId: number;
  serviceId: number;
  scheduledAt: Date;
  path: PreventedBookingPath;
};

export async function recordPreventedBooking(
  event: PreventedBookingEvent,
): Promise<void> {
  const row = {
    marketplaceId: DEFAULT_MARKETPLACE_ID,
    correlationId: event.correlationId,
    occurredAt: new Date(),
    actorUserId: event.actorUserId,
    subjectBookingId: event.subjectBookingId,
    providerId: event.providerId,
    serviceId: event.serviceId,
    scheduledAt: event.scheduledAt,
    path: event.path,
  };

  // Single-row autocommit INSERT in its own (implicit) transaction.
  const insertOnce = async (): Promise<void> => {
    await db
      .insert(preventedBookingRecordsTable)
      .values(row)
      .onConflictDoNothing({
        target: preventedBookingRecordsTable.correlationId,
      });
  };

  try {
    await insertOnce();
    return;
  } catch {
    try {
      // One bounded retry — same correlation_id, still idempotent.
      await insertOnce();
      return;
    } catch {
      // Structured reconciliation log: COMPLETE payload for the Part 2
      // replay job. Logging itself must never throw either.
      try {
        logger.error(
          {
            evt: "prevented_booking_record_failed",
            payload: {
              ...row,
              occurredAt: row.occurredAt.toISOString(),
              scheduledAt: row.scheduledAt.toISOString(),
            },
          },
          "prevented-booking record write failed after bounded retry — queued for reconciliation replay",
        );
      } catch {
        /* never throw from the isolation boundary */
      }
    }
  }
}
