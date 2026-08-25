import { Router, type Request, type Response } from "express";
import { eq, and, sql, lt, desc, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  providerProfilesTable,
  servicesTable,
  availabilityTable,
  rescheduleProposalsTable,
  rescheduleHistoryTable,
  type RescheduleProposal,
} from "@workspace/db";
import {
  getMarketplaceTimezone,
  isWithinAvailability,
  type AvailabilityWindow,
} from "../lib/availability.js";
import {
  requireAuth,
  requireApprovedProviderIfProvider,
} from "../middlewares/auth.js";
import { sendPushToUser } from "../lib/push-notifications.js";
import {
  computeProposalDeadline,
  getProviderProposalLimit,
} from "../lib/reschedule-policy.js";
import {
  TRAVEL_BUFFER_CONFLICT_MESSAGE,
  RESCHEDULE_OUTSIDE_SERVICE_AREA_MESSAGE,
  evaluateBookingLocation,
  getTravelSetupBufferMinutes,
  loadProviderCoverage,
} from "../lib/service-area.js";

/**
 * Consent-first provider rescheduling (docs/rescheduling-policy.md).
 *
 * A provider proposal NEVER changes bookings.scheduled_at. The confirmed
 * appointment stays authoritative until the client accepts. Accepting
 * re-validates the proposed time under the same locks the booking status
 * endpoint uses, applies the time, and appends an immutable history row —
 * all in one transaction. Notifications are best-effort AFTER commit.
 */

const router = Router();

type BookingRow = typeof bookingsTable.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const DUPLICATE_MESSAGE =
  "You already have an active request for this provider, service, and time.";
const UNAVAILABLE_MESSAGE =
  "This time overlaps another appointment for this provider. Please choose a different time.";
const SUPPORT_MESSAGE =
  "The original appointment time is no longer available. Please contact support or agree on a new time with the other party.";

function httpError(statusCode: number, userMessage: string): Error {
  return Object.assign(new Error(userMessage), { statusCode, userMessage });
}

/** Public projection — never expose user IDs or internal keys. */
function toPublicProposal(p: RescheduleProposal) {
  return {
    id: p.id,
    bookingId: p.bookingId,
    requesterRole: p.requesterRole,
    originalScheduledAt: p.originalScheduledAt.toISOString(),
    proposedScheduledAt: p.proposedScheduledAt.toISOString(),
    reason: p.reason,
    status: p.status,
    deadlineAt: p.deadlineAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
  };
}

/**
 * Resolve booking access for the caller. Inaccessible bookings return 404
 * (never confirm existence to non-owners).
 */
async function loadOwnedBooking(
  tx: Tx,
  bookingId: number,
  userId: number,
  role: string,
  opts: { lock?: boolean } = {},
): Promise<{ booking: BookingRow; callerProviderProfileId: number | null }> {
  let query = tx.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  const rows = opts.lock ? await query.for("update") : await query;
  const booking = rows[0];
  if (!booking) throw httpError(404, "Booking not found.");

  let callerProviderProfileId: number | null = null;
  if (role === "client") {
    if (booking.clientId !== userId) throw httpError(404, "Booking not found.");
  } else if (role === "provider") {
    const profile = await tx
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, userId))
      .limit(1);
    if (!profile[0] || booking.providerId !== profile[0].id) {
      throw httpError(404, "Booking not found.");
    }
    callerProviderProfileId = profile[0].id;
  }
  // admin: unrestricted
  return { booking, callerProviderProfileId };
}

/**
 * The same safety rules a reschedule must pass (mirrors the booking status
 * endpoint): future instant, active service, availability-window fit in the
 * marketplace timezone, provider serialization, no same-client duplicate,
 * no cross-client overlap. Runs INSIDE the caller's transaction.
 */
async function validateProposedTime(
  tx: Tx,
  booking: BookingRow,
  proposedDate: Date,
): Promise<void> {
  if (Number.isNaN(proposedDate.getTime())) {
    throw httpError(400, "proposedScheduledAt must be a valid date-time.");
  }
  if (proposedDate.getTime() <= Date.now()) {
    throw httpError(400, "proposedScheduledAt must be in the future.");
  }
  if (proposedDate.getTime() === booking.scheduledAt.getTime()) {
    throw httpError(400, "The proposed time is the current appointment time. Pick a different time.");
  }

  const [service] = await tx
    .select({
      durationMinutes: servicesTable.durationMinutes,
      isActive: servicesTable.isActive,
    })
    .from(servicesTable)
    .where(eq(servicesTable.id, booking.serviceId))
    .limit(1);
  if (!service || !service.isActive) {
    throw httpError(
      409,
      "This booking's service is no longer offered, so it cannot be rescheduled. Please cancel and book an available service.",
    );
  }

  // Service-area revalidation (roadmap #12): the booking's stored location
  // must pass the provider's CURRENT active coverage both when a proposal
  // is created AND again at consent time (this helper runs on both paths).
  // The existing confirmed appointment stays valid — only the change is
  // blocked. Providers with no active coverage keep existing behavior.
  const coverage = await loadProviderCoverage(tx, booking.providerId);
  const locationCheck = evaluateBookingLocation(coverage, booking.postalCode);
  if (locationCheck.enforced && locationCheck.result.status !== "eligible") {
    throw httpError(409, RESCHEDULE_OUTSIDE_SERVICE_AREA_MESSAGE);
  }

  const windows = (await tx
    .select({
      dayOfWeek: availabilityTable.dayOfWeek,
      startTime: availabilityTable.startTime,
      endTime: availabilityTable.endTime,
    })
    .from(availabilityTable)
    .where(eq(availabilityTable.providerId, booking.providerId))) as AvailabilityWindow[];
  if (
    !isWithinAvailability({
      scheduledAt: proposedDate,
      durationMinutes: service.durationMinutes,
      windows,
      tz: getMarketplaceTimezone(),
    })
  ) {
    throw httpError(400, "The selected time is outside this provider's availability.");
  }

  // Serialize with POST /bookings and reschedule writes for this provider.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(42001, ${booking.providerId})`);

  const [duplicate] = await tx
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        sql`${bookingsTable.id} <> ${booking.id}`,
        eq(bookingsTable.clientId, booking.clientId),
        eq(bookingsTable.providerId, booking.providerId),
        eq(bookingsTable.serviceId, booking.serviceId),
        eq(bookingsTable.scheduledAt, proposedDate),
        inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
      ),
    )
    .limit(1);
  if (duplicate) throw httpError(409, DUPLICATE_MESSAGE);

  const proposedEnd = new Date(proposedDate.getTime() + service.durationMinutes * 60000);
  const [conflict] = await tx
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
    .where(
      and(
        eq(bookingsTable.providerId, booking.providerId),
        inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
        sql`${bookingsTable.id} <> ${booking.id}`,
        sql`${bookingsTable.clientId} <> ${booking.clientId}`,
        sql`${bookingsTable.scheduledAt} < ${proposedEnd}`,
        sql`${proposedDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes})`,
      ),
    )
    .limit(1);
  if (conflict) throw httpError(409, UNAVAILABLE_MESSAGE);

  // Travel/setup buffer (roadmap #12): the proposed interval, expanded by
  // the centrally managed buffer, must not touch any OTHER active
  // appointment for this provider. Revalidated at proposal creation AND at
  // consent time (both paths call this helper). The booking being
  // rescheduled never blocks itself.
  const bufferMinutes = getTravelSetupBufferMinutes();
  if (bufferMinutes > 0) {
    const bufferedEnd = new Date(
      proposedEnd.getTime() + bufferMinutes * 60000,
    );
    const [nearMiss] = await tx
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
      .where(
        and(
          eq(bookingsTable.providerId, booking.providerId),
          inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
          sql`${bookingsTable.id} <> ${booking.id}`,
          sql`${bookingsTable.scheduledAt} < ${bufferedEnd}`,
          sql`${proposedDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes} + ${bufferMinutes})`,
        ),
      )
      .limit(1);
    if (nearMiss) throw httpError(409, TRAVEL_BUFFER_CONFLICT_MESSAGE);
  }
}

/** True when the booking's CURRENT time is still feasible (future + fits an availability window). */
async function isOriginalTimeFeasible(tx: Tx, booking: BookingRow): Promise<boolean> {
  if (booking.scheduledAt.getTime() <= Date.now()) return false;
  const [service] = await tx
    .select({
      durationMinutes: servicesTable.durationMinutes,
      isActive: servicesTable.isActive,
    })
    .from(servicesTable)
    .where(eq(servicesTable.id, booking.serviceId))
    .limit(1);
  if (!service || !service.isActive) return false;
  const windows = (await tx
    .select({
      dayOfWeek: availabilityTable.dayOfWeek,
      startTime: availabilityTable.startTime,
      endTime: availabilityTable.endTime,
    })
    .from(availabilityTable)
    .where(eq(availabilityTable.providerId, booking.providerId))) as AvailabilityWindow[];
  return isWithinAvailability({
    scheduledAt: booking.scheduledAt,
    durationMinutes: service.durationMinutes,
    windows,
    tz: getMarketplaceTimezone(),
  });
}

/**
 * Lazy expiry: a pending proposal past its deadline becomes `expired` when
 * the original appointment remains feasible, or `unresolved` (support/provider
 * resolution path) when it does not. Never auto-accepts, never moves or
 * cancels the appointment. Must run with the booking row already locked.
 */
async function expireIfPastDeadline(
  tx: Tx,
  proposal: RescheduleProposal,
  booking: BookingRow,
): Promise<RescheduleProposal> {
  if (proposal.status !== "pending") return proposal;
  if (proposal.deadlineAt.getTime() > Date.now()) return proposal;
  const feasible = await isOriginalTimeFeasible(tx, booking);
  const [updated] = await tx
    .update(rescheduleProposalsTable)
    .set({
      status: feasible ? "expired" : "unresolved",
      resolvedAt: new Date(),
      version: sql`${rescheduleProposalsTable.version} + 1`,
    })
    .where(
      and(
        eq(rescheduleProposalsTable.id, proposal.id),
        eq(rescheduleProposalsTable.status, "pending"),
      ),
    )
    .returning();
  return updated ?? proposal;
}

/** Best-effort post-commit push; records the coarse outcome on the proposal. */
function notifyAndRecord(proposalId: number, userId: number, title: string, body: string, bookingId: number): void {
  void sendPushToUser(userId, { title, body, data: { screen: "booking", bookingId } })
    .then(() =>
      db
        .update(rescheduleProposalsTable)
        .set({ notificationOutcome: "sent" })
        .where(eq(rescheduleProposalsTable.id, proposalId)),
    )
    .catch(() =>
      db
        .update(rescheduleProposalsTable)
        .set({ notificationOutcome: "failed" })
        .where(eq(rescheduleProposalsTable.id, proposalId))
        .catch(() => undefined),
    );
}

function isUniqueViolationOn(error: unknown, indexName: string): boolean {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  return code === "23505" && constraint === indexName;
}

// ── POST /bookings/:bookingId/reschedule-requests — provider proposes ────────

router.post(
  "/bookings/:bookingId/reschedule-requests",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const bookingId = Number(req.params["bookingId"]);
    const { proposedScheduledAt, reason, idempotencyKey } = req.body as {
      proposedScheduledAt?: string;
      reason?: string;
      idempotencyKey?: string;
    };

    if (!proposedScheduledAt || typeof proposedScheduledAt !== "string") {
      res.status(400).json({ error: "proposedScheduledAt is required." });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 128) {
      res.status(400).json({ error: "idempotencyKey is required (max 128 characters)." });
      return;
    }
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
      res.status(400).json({ error: "reason must be a string of at most 500 characters." });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const { booking } = await loadOwnedBooking(tx, bookingId, user.sub, role, { lock: true });

        if (role === "client") {
          throw httpError(
            403,
            "Clients reschedule directly from the booking — pick a new time from the reschedule screen.",
          );
        }

        // Idempotent retry: same requester + key returns the original proposal.
        const [existing] = await tx
          .select()
          .from(rescheduleProposalsTable)
          .where(
            and(
              eq(rescheduleProposalsTable.requesterUserId, user.sub),
              eq(rescheduleProposalsTable.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1);
        if (existing) return { proposal: existing, created: false };

        if (booking.status !== "confirmed") {
          throw httpError(
            409,
            "Only a confirmed booking can receive a reschedule proposal. Please refresh and try again.",
          );
        }

        const [pending] = await tx
          .select({ id: rescheduleProposalsTable.id })
          .from(rescheduleProposalsTable)
          .where(
            and(
              eq(rescheduleProposalsTable.bookingId, bookingId),
              eq(rescheduleProposalsTable.status, "pending"),
            ),
          )
          .limit(1);
        if (pending) {
          throw httpError(
            409,
            "A reschedule proposal is already awaiting the client's response for this booking.",
          );
        }

        // Manual-review threshold (documented, configurable — never hidden).
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(rescheduleProposalsTable)
          .where(
            and(
              eq(rescheduleProposalsTable.bookingId, bookingId),
              eq(rescheduleProposalsTable.requesterRole, "provider"),
            ),
          );
        if ((countRow?.count ?? 0) >= getProviderProposalLimit()) {
          throw httpError(
            409,
            "This booking has reached the limit of provider time-change proposals. Please contact support to arrange further changes.",
          );
        }

        const proposedDate = new Date(proposedScheduledAt);
        await validateProposedTime(tx, booking, proposedDate);

        const [proposal] = await tx
          .insert(rescheduleProposalsTable)
          .values({
            bookingId,
            requesterUserId: user.sub,
            requesterRole: role as "provider" | "admin",
            originalScheduledAt: booking.scheduledAt,
            proposedScheduledAt: proposedDate,
            reason: reason?.trim() ? reason.trim() : null,
            status: "pending",
            deadlineAt: computeProposalDeadline(new Date(), booking.scheduledAt),
            idempotencyKey,
          })
          .returning();
        if (!proposal) throw new Error("Proposal insert did not return a row.");
        return { proposal, created: true, clientId: booking.clientId };
      });

      if (result.created && result.clientId) {
        const dateStr = result.proposal.proposedScheduledAt.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        notifyAndRecord(
          result.proposal.id,
          result.clientId,
          "New time proposed 📅",
          `Your provider proposed ${dateStr}. Your current appointment stays until you respond.`,
          bookingId,
        );
      }

      res.status(result.created ? 201 : 200).json({ proposal: toPublicProposal(result.proposal) });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      if (isUniqueViolationOn(err, "reschedule_proposals_requester_idempotency_idx")) {
        const [existing] = await db
          .select()
          .from(rescheduleProposalsTable)
          .where(
            and(
              eq(rescheduleProposalsTable.requesterUserId, user.sub),
              eq(rescheduleProposalsTable.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1);
        if (existing) {
          res.status(200).json({ proposal: toPublicProposal(existing) });
          return;
        }
      }
      if (isUniqueViolationOn(err, "reschedule_proposals_single_pending_idx")) {
        res.status(409).json({
          error: "A reschedule proposal is already awaiting the client's response for this booking.",
        });
        return;
      }
      throw err;
    }
  },
);

// ── GET /bookings/:bookingId/reschedule-requests — list (owner only) ─────────

router.get(
  "/bookings/:bookingId/reschedule-requests",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const bookingId = Number(req.params["bookingId"]);

    try {
      const proposals = await db.transaction(async (tx) => {
        const { booking } = await loadOwnedBooking(tx, bookingId, user.sub, role, { lock: true });
        const rows = await tx
          .select()
          .from(rescheduleProposalsTable)
          .where(eq(rescheduleProposalsTable.bookingId, bookingId))
          .orderBy(desc(rescheduleProposalsTable.createdAt), desc(rescheduleProposalsTable.id))
          .limit(20);
        const out: RescheduleProposal[] = [];
        for (const row of rows) out.push(await expireIfPastDeadline(tx, row, booking));
        return out;
      });
      res.json({ proposals: proposals.map(toPublicProposal) });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      throw err;
    }
  },
);

// ── POST /reschedule-requests/:requestId/accept — client consents ────────────

router.post(
  "/reschedule-requests/:requestId/accept",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const requestId = Number(req.params["requestId"]);

    try {
      const result = await db.transaction(async (tx) => {
        const [peek] = await tx
          .select({ bookingId: rescheduleProposalsTable.bookingId })
          .from(rescheduleProposalsTable)
          .where(eq(rescheduleProposalsTable.id, requestId))
          .limit(1);
        if (!peek) throw httpError(404, "Reschedule request not found.");

        // Lock order matches the booking status endpoint: booking row first.
        const { booking } = await loadOwnedBooking(tx, peek.bookingId, user.sub, role, { lock: true });
        if (role === "provider") {
          throw httpError(403, "Only the client can accept a proposed time.");
        }

        const [locked] = await tx
          .select()
          .from(rescheduleProposalsTable)
          .where(eq(rescheduleProposalsTable.id, requestId))
          .for("update")
          .limit(1);
        if (!locked) throw httpError(404, "Reschedule request not found.");

        const proposal = await expireIfPastDeadline(tx, locked, booking);

        // Idempotent replay of a successful accept by the same user.
        if (proposal.status === "accepted" && proposal.respondedByUserId === user.sub) {
          return { booking, proposal, replay: true };
        }
        if (proposal.status !== "pending") {
          throw httpError(
            409,
            `This proposal is no longer pending (${proposal.status}). Please refresh.`,
          );
        }
        if (booking.status !== "confirmed") {
          throw httpError(409, "This booking can no longer accept the proposal. Please refresh.");
        }
        // Stale proposal: the confirmed time moved since it was created.
        if (booking.scheduledAt.getTime() !== proposal.originalScheduledAt.getTime()) {
          await tx
            .update(rescheduleProposalsTable)
            .set({
              status: "cancelled",
              resolvedAt: new Date(),
              version: sql`${rescheduleProposalsTable.version} + 1`,
            })
            .where(eq(rescheduleProposalsTable.id, proposal.id));
          throw httpError(409, "The appointment changed after this proposal was made. Please refresh.");
        }

        // The proposed time must STILL pass every safety rule at consent time.
        await validateProposedTime(tx, booking, proposal.proposedScheduledAt);

        const [updatedBooking] = await tx
          .update(bookingsTable)
          .set({ scheduledAt: proposal.proposedScheduledAt, updatedAt: new Date() })
          .where(eq(bookingsTable.id, booking.id))
          .returning();
        if (!updatedBooking) throw new Error("Booking update did not return a row.");

        const [historyRow] = await tx
          .insert(rescheduleHistoryTable)
          .values({
            bookingId: booking.id,
            proposalId: proposal.id,
            originalScheduledAt: proposal.originalScheduledAt,
            newScheduledAt: proposal.proposedScheduledAt,
            requesterUserId: proposal.requesterUserId,
            requesterRole: proposal.requesterRole,
            respondedByUserId: user.sub,
            reason: proposal.reason,
            previousStatus: "confirmed",
            newStatus: "confirmed",
            idempotencyKey: proposal.idempotencyKey,
          })
          .returning();
        if (!historyRow) throw new Error("History insert did not return a row — rolling back.");

        const [resolved] = await tx
          .update(rescheduleProposalsTable)
          .set({
            status: "accepted",
            respondedByUserId: user.sub,
            resolvedAt: new Date(),
            version: sql`${rescheduleProposalsTable.version} + 1`,
          })
          .where(eq(rescheduleProposalsTable.id, proposal.id))
          .returning();

        return { booking: updatedBooking, proposal: resolved ?? proposal, replay: false };
      });

      if (!result.replay) {
        const dateStr = result.proposal.proposedScheduledAt.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        notifyAndRecord(
          result.proposal.id,
          result.proposal.requesterUserId,
          "New time accepted 🎉",
          `The client accepted ${dateStr}.`,
          result.booking.id,
        );
      }

      const { careNotes: _careNotes, ...safeBooking } = result.booking;
      res.json({ booking: safeBooking, proposal: toPublicProposal(result.proposal) });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      throw err;
    }
  },
);

// ── POST /reschedule-requests/:requestId/decline — client declines / proposer withdraws ──

router.post(
  "/reschedule-requests/:requestId/decline",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const requestId = Number(req.params["requestId"]);

    try {
      const result = await db.transaction(async (tx) => {
        const [peek] = await tx
          .select({ bookingId: rescheduleProposalsTable.bookingId })
          .from(rescheduleProposalsTable)
          .where(eq(rescheduleProposalsTable.id, requestId))
          .limit(1);
        if (!peek) throw httpError(404, "Reschedule request not found.");

        const { booking } = await loadOwnedBooking(tx, peek.bookingId, user.sub, role, { lock: true });

        const [locked] = await tx
          .select()
          .from(rescheduleProposalsTable)
          .where(eq(rescheduleProposalsTable.id, requestId))
          .for("update")
          .limit(1);
        if (!locked) throw httpError(404, "Reschedule request not found.");

        // The proposer (provider/admin) withdraws; the client declines.
        const isProposer = locked.requesterUserId === user.sub;
        const isClient = role === "client";
        if (!isClient && !isProposer && role !== "admin") {
          throw httpError(403, "You cannot act on this proposal.");
        }
        const targetStatus = isClient ? "declined" : "cancelled";

        const proposal = await expireIfPastDeadline(tx, locked, booking);
        const feasible = await isOriginalTimeFeasible(tx, booking);

        // Idempotent replay by the same actor.
        if (proposal.status === targetStatus && proposal.respondedByUserId === user.sub) {
          return { booking, proposal, feasible, replay: true };
        }
        if (proposal.status !== "pending") {
          throw httpError(
            409,
            `This proposal is no longer pending (${proposal.status}). Please refresh.`,
          );
        }

        const [resolved] = await tx
          .update(rescheduleProposalsTable)
          .set({
            status: targetStatus,
            respondedByUserId: user.sub,
            resolvedAt: new Date(),
            version: sql`${rescheduleProposalsTable.version} + 1`,
          })
          .where(eq(rescheduleProposalsTable.id, proposal.id))
          .returning();

        return { booking, proposal: resolved ?? proposal, feasible, replay: false };
      });

      if (!result.replay && result.proposal.status === "declined") {
        notifyAndRecord(
          result.proposal.id,
          result.proposal.requesterUserId,
          "Proposed time declined",
          "The client declined the proposed time. The original appointment is unchanged.",
          result.booking.id,
        );
      }

      res.json({
        proposal: toPublicProposal(result.proposal),
        originalTimeFeasible: result.feasible,
        ...(result.feasible ? {} : { supportMessage: SUPPORT_MESSAGE }),
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      throw err;
    }
  },
);

// ── GET /bookings/:bookingId/rescheduling-history — append-only audit (owner) ─

router.get(
  "/bookings/:bookingId/rescheduling-history",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const bookingId = Number(req.params["bookingId"]);
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 20) || 20, 1), 50);
    const cursor = req.query["cursor"] !== undefined ? Number(req.query["cursor"]) : undefined;

    try {
      await db.transaction(async (tx) => loadOwnedBooking(tx, bookingId, user.sub, role));

      const where = cursor !== undefined && Number.isFinite(cursor)
        ? and(eq(rescheduleHistoryTable.bookingId, bookingId), lt(rescheduleHistoryTable.id, cursor))
        : eq(rescheduleHistoryTable.bookingId, bookingId);

      const rows = await db
        .select()
        .from(rescheduleHistoryTable)
        .where(where)
        .orderBy(desc(rescheduleHistoryTable.id))
        .limit(limit);

      res.json({
        history: rows.map((h) => ({
          id: h.id,
          bookingId: h.bookingId,
          originalScheduledAt: h.originalScheduledAt.toISOString(),
          newScheduledAt: h.newScheduledAt.toISOString(),
          requesterRole: h.requesterRole,
          reason: h.reason,
          previousStatus: h.previousStatus,
          newStatus: h.newStatus,
          createdAt: h.createdAt.toISOString(),
        })),
        limit,
        nextCursor: rows.length === limit ? rows[rows.length - 1]!.id : null,
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      throw err;
    }
  },
);

export default router;
