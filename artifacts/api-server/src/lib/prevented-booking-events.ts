import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
 *  - LOCAL DLQ FALLBACK (Part 2): the same complete payload is ALSO appended
 *    best-effort to a local append-only NDJSON dead-letter file
 *    (`var/reconciliation/prevented-booking-dlq.ndjson`, overridable via
 *    `PREVENTED_BOOKING_DLQ_PATH`) so the replay job has a machine-readable
 *    source independent of platform log retention. Bounded synchronous
 *    single-line append, executed ONLY on the (rare) double-failure path;
 *    it NEVER throws, never delays or alters the client's 409 contract, and
 *    the structured log line above is always kept as fallback. HONEST
 *    LIMIT: container-local storage is NOT durable across container
 *    replacement — the DLQ narrows, but cannot eliminate, the
 *    platform-log-retention dependency.
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

/**
 * The COMPLETE reconciliation payload emitted on double failure — shared
 * schema between the structured log line, the local DLQ file, and the Part 2
 * replay job (single definition; no duplicate schemas). IDs + timestamps +
 * path discriminator ONLY — never PII, never raw database errors.
 */
export type PreventedBookingFailurePayload = {
  marketplaceId: number;
  correlationId: string;
  /** ISO-8601 */
  occurredAt: string;
  actorUserId: number;
  subjectBookingId: number;
  providerId: number;
  serviceId: number;
  /** ISO-8601 */
  scheduledAt: string;
  path: PreventedBookingPath;
};

/** Wire event name shared by the log line, the DLQ file, and the replay job. */
export const PREVENTED_BOOKING_FAILURE_EVT = "prevented_booking_record_failed";

const DEFAULT_DLQ_PATH = "var/reconciliation/prevented-booking-dlq.ndjson";

/**
 * Best-effort local dead-letter append (Part 2 durability fallback).
 *
 *  - Called ONLY on the double-failure path (insert + one bounded retry both
 *    failed), so it can never affect the hot path.
 *  - Bounded: one synchronous single-line append of an already-serialized
 *    payload; deterministic directory creation (`mkdir -p` semantics).
 *  - NEVER throws — any filesystem error is swallowed inside the isolation
 *    boundary; the structured log line remains the fallback of record.
 *  - Payload is the same PII-free, ids-only reconciliation payload as the
 *    log line; raw database errors never reach this function.
 *  - NOT durable across container replacement (container-local storage);
 *    documented honestly in the module header.
 */
function appendToDlqBestEffort(payload: PreventedBookingFailurePayload): void {
  try {
    const dlqPath =
      process.env["PREVENTED_BOOKING_DLQ_PATH"] ?? DEFAULT_DLQ_PATH;
    mkdirSync(dirname(dlqPath), { recursive: true });
    appendFileSync(
      dlqPath,
      `${JSON.stringify({ evt: PREVENTED_BOOKING_FAILURE_EVT, payload })}\n`,
      "utf8",
    );
  } catch {
    /* best-effort only — never throw across the isolation boundary */
  }
}

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
      // Double failure: hand the COMPLETE payload to the reconciliation
      // channels — structured log line (always) + best-effort local DLQ
      // file (Part 2). Neither may ever throw.
      const failurePayload: PreventedBookingFailurePayload = {
        ...row,
        occurredAt: row.occurredAt.toISOString(),
        scheduledAt: row.scheduledAt.toISOString(),
      };
      try {
        logger.error(
          {
            evt: PREVENTED_BOOKING_FAILURE_EVT,
            payload: failurePayload,
          },
          "prevented-booking record write failed after bounded retry — queued for reconciliation replay",
        );
      } catch {
        /* never throw from the isolation boundary */
      }
      appendToDlqBestEffort(failurePayload);
    }
  }
}
