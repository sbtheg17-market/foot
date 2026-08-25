import { Router, type Request, type Response } from "express";
import { eq, and, or, sql, getTableColumns, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  providerProfilesTable,
  servicesTable,
  invoicesTable,
  usersTable,
  availabilityTable,
  rescheduleProposalsTable,
  rescheduleHistoryTable,
} from "@workspace/db";
import {
  getMarketplaceTimezone,
  isWithinAvailability,
  type AvailabilityWindow,
} from "../lib/availability.js";
import {
  requireAuth,
  requireApprovedProviderIfProvider,
  requireRole,
} from "../middlewares/auth.js";
import {
  isTransitionAllowed,
  type BookingStatus,
} from "../lib/booking-state-machine.js";
import { emitNewBooking } from "../lib/notification-bus.js";
import { sendPushToUser } from "../lib/push-notifications.js";
import { recordPreventedBooking } from "../lib/prevented-booking-events.js";
import { normalizeBookingSource } from "../lib/booking-page.js";
import {
  SERVICE_AREA_MESSAGES,
  TRAVEL_BUFFER_CONFLICT_MESSAGE,
  RESCHEDULE_OUTSIDE_SERVICE_AREA_MESSAGE,
  evaluateBookingLocation,
  getTravelSetupBufferMinutes,
  loadProviderCoverage,
} from "../lib/service-area.js";

const router = Router();

type BookingRow = typeof bookingsTable.$inferSelect;

/**
 * Client booking responses must never expose provider-private clinical notes.
 * Keep this projection at the API boundary so future client consumers cannot
 * accidentally serialize the full database row.
 */
function toClientSafeBooking(booking: BookingRow) {
  const { careNotes: _careNotes, ...safeBooking } = booking;
  return safeBooking;
}

// ── GET /bookings — list own bookings ─────────────────────────────────────────

router.get(
  "/",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
    const offset = Number(req.query["offset"] ?? 0);
    const statusFilter = req.query["status"] as BookingStatus | undefined;

    // Scope by role
    let ownershipClause;
    const role = req.authz!.activeRole;
    if (role === "client") {
      ownershipClause = eq(bookingsTable.clientId, user.sub);
    } else if (role === "provider") {
      // Find own provider profile id
      const profile = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, user.sub))
        .limit(1);
      if (!profile[0]) {
        res.json({ bookings: [], total: 0, limit, offset });
        return;
      }
      ownershipClause = eq(bookingsTable.providerId, profile[0].id);
    } else {
      // admin: see all
      ownershipClause = undefined;
    }

    const whereClause = ownershipClause
      ? statusFilter
        ? and(ownershipClause, eq(bookingsTable.status, statusFilter))
        : ownershipClause
      : statusFilter
        ? eq(bookingsTable.status, statusFilter)
        : undefined;

    const [bookings, countRows] = await Promise.all([
      db
        .select({
          ...getTableColumns(bookingsTable),
          clientFirstName: usersTable.firstName,
          clientLastName: usersTable.lastName,
          clientPhone: usersTable.phone,
        })
        .from(bookingsTable)
        .leftJoin(usersTable, eq(usersTable.id, bookingsTable.clientId))
        .where(whereClause)
        .orderBy(sql`${bookingsTable.scheduledAt} desc`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingsTable)
        .where(whereClause),
    ]);

    res.json({
      bookings: role === "client" ? bookings.map(toClientSafeBooking) : bookings,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  }
);

// ── GET /bookings/history — bounded client-safe care history ──────────────────

router.get(
  "/history",
  requireAuth,
  requireRole("client"),
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 20), 1), 50);
    const offset = Math.max(Number(req.query["offset"] ?? 0), 0);
    const historyStatuses: BookingStatus[] = ["completed", "no_show", "cancelled"];
    const ownershipClause = eq(bookingsTable.clientId, req.user!.sub);
    const historyClause = and(ownershipClause, inArray(bookingsTable.status, historyStatuses));

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: bookingsTable.id,
          providerId: bookingsTable.providerId,
          serviceId: bookingsTable.serviceId,
          status: bookingsTable.status,
          scheduledAt: bookingsTable.scheduledAt,
          address: bookingsTable.address,
          city: bookingsTable.city,
          postalCode: bookingsTable.postalCode,
          clientNotes: bookingsTable.clientNotes,
          cancellationReason: bookingsTable.cancellationReason,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
          provider: {
            id: providerProfilesTable.id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            avatarUrl: usersTable.avatarUrl,
            title: providerProfilesTable.title,
            city: providerProfilesTable.city,
          },
          service: {
            id: servicesTable.id,
            title: servicesTable.title,
            durationMinutes: servicesTable.durationMinutes,
            category: servicesTable.category,
            priceCents: servicesTable.priceCents,
          },
        })
        .from(bookingsTable)
        .innerJoin(providerProfilesTable, eq(providerProfilesTable.id, bookingsTable.providerId))
        .innerJoin(usersTable, eq(usersTable.id, providerProfilesTable.userId))
        .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
        .where(historyClause)
        .orderBy(sql`${bookingsTable.updatedAt} desc`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingsTable)
        .where(historyClause),
    ]);

    res.json({
      history: rows,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  },
);

// ── POST /bookings — create booking (client only) ─────────────────────────────

/**
 * Identity of the live database race guard (applied Session 073, mirrored in
 * lib/db/src/schema/bookings.ts Session 074): partial unique index over
 * (client_id, provider_id, service_id, scheduled_at) for ACTIVE statuses.
 */
const ACTIVE_BOOKING_UNIQUE_INDEX = "bookings_active_booking_unique_idx";

/**
 * Friendly duplicate-booking message — must stay byte-identical between the
 * sequential preflight fast path and the database race path, matching the
 * OpenAPI DuplicateBookingConflictResponse contract.
 */
const DUPLICATE_BOOKING_MESSAGE =
  "You already have an active request for this provider, service, and time. Check your bookings before submitting again.";

/**
 * Friendly provider-unavailable message — the requested interval overlaps an
 * existing active booking for the same provider. No booking or client ids are
 * ever leaked in this response.
 */
const PROVIDER_UNAVAILABLE_MESSAGE =
  "That time overlaps another appointment for this provider. Please choose another available time.";

/**
 * True only for a unique violation raised by ACTIVE_BOOKING_UNIQUE_INDEX.
 *
 * Per .agents/memory/drizzle-unique-error-wrapping.md, drizzle may wrap the
 * node-postgres error so the top-level `code` is lost; the index name survives
 * in the message/constraint/detail of the error or a nested cause. Identity is
 * the index NAME — bare SQLSTATE 23505 or generic "duplicate key" text from
 * any OTHER constraint must NOT be converted into a duplicate-booking 409.
 */
export function isActiveBookingDuplicateViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    message?: unknown;
    constraint?: unknown;
    detail?: unknown;
    cause?: unknown;
    originalError?: unknown;
  };
  const text = [candidate.message, candidate.constraint, candidate.detail]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return (
    text.includes(ACTIVE_BOOKING_UNIQUE_INDEX) ||
    isActiveBookingDuplicateViolation(candidate.cause) ||
    isActiveBookingDuplicateViolation(candidate.originalError)
  );
}

router.post(
  "/",
  requireAuth,
  requireRole("client"),
  async (req: Request, res: Response): Promise<void> => {
    const { providerId, serviceId, scheduledAt, address, city, postalCode, careNotes, clientNotes, source } =
      req.body as Record<string, unknown>;

    if (!providerId || !serviceId || !scheduledAt || !address || !city) {
      res.status(400).json({
        error: "providerId, serviceId, scheduledAt, address, and city are required.",
        reason: "invalid_request",
      });
      return;
    }

    // Verify provider exists and accepts new clients
    const provider = await db
      .select({
        id: providerProfilesTable.id,
        userId: providerProfilesTable.userId,
        acceptsNewClients: providerProfilesTable.acceptsNewClients,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, Number(providerId)))
      .limit(1);

    if (!provider[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    // Verify service belongs to this provider and is active
    const service = await db
      .select({
        id: servicesTable.id,
        priceCents: servicesTable.priceCents,
        durationMinutes: servicesTable.durationMinutes,
      })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, Number(serviceId)),
          eq(servicesTable.providerId, Number(providerId)),
          eq(servicesTable.isActive, true)
        )
      )
      .limit(1);

    if (!service[0]) {
      res.status(404).json({ error: "Service not found or inactive." });
      return;
    }

    const scheduledAtDate = new Date(String(scheduledAt));

    // Reject malformed or past instants before any availability work.
    if (Number.isNaN(scheduledAtDate.getTime())) {
      res.status(400).json({
        error: "scheduledAt must be a valid date-time.",
        reason: "invalid_request",
      });
      return;
    }
    if (scheduledAtDate.getTime() <= Date.now()) {
      res.status(400).json({
        error: "scheduledAt must be in the future.",
        reason: "invalid_request",
      });
      return;
    }

    const durationMinutes = service[0].durationMinutes;

    // Duplicate-submit protection, two layers:
    //  1. Sequential fast path (this preflight SELECT): catches double-taps,
    //     back-button resubmits, and parallel tabs with a friendly 409 before
    //     any insert is attempted.
    //  2. Authoritative concurrent guard: the LIVE partial unique index
    //     bookings_active_booking_unique_idx (applied Session 073, mirrored in
    //     the Drizzle schema Session 074) makes a double-booking impossible at
    //     the database level even when two requests pass this preflight
    //     simultaneously; its rejection is mapped to the same 409 below.
    // Cancelled / completed / no-show bookings never block a re-request.
    const activeDuplicateWhere = and(
      eq(bookingsTable.clientId, req.user!.sub),
      eq(bookingsTable.providerId, Number(providerId)),
      eq(bookingsTable.serviceId, Number(serviceId)),
      eq(bookingsTable.scheduledAt, scheduledAtDate),
      inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"])
    );

    const [duplicate] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(activeDuplicateWhere)
      .limit(1);

    if (duplicate) {
      // Analytics Step 2 (Session 080): record the prevented duplicate under
      // the approved counting rule (one event per API 409 with bookingId).
      // The helper never throws and never alters the response below.
      await recordPreventedBooking({
        correlationId: String(req.id),
        actorUserId: req.user!.sub,
        subjectBookingId: duplicate.id,
        providerId: Number(providerId),
        serviceId: Number(serviceId),
        scheduledAt: scheduledAtDate,
        path: "preflight",
      });
      res.status(409).json({
        error: DUPLICATE_BOOKING_MESSAGE,
        bookingId: duplicate.id,
        reason: "duplicate_booking",
      });
      return;
    }

    // ── Service-area eligibility enforcement (roadmap #12) ──────────────────
    // Server-authoritative: applies whenever THIS provider has active
    // coverage configuration, regardless of which surface (marketplace or
    // /book/:slug) submitted the request. Any client-asserted eligibility in
    // the payload is ignored — evaluation always runs from the raw postal
    // code against the provider's CURRENT active coverage. Providers with no
    // active configuration keep the existing marketplace behavior
    // (documented in docs/service-area-travel-policy.md).
    const coverage = await loadProviderCoverage(db, Number(providerId));
    const locationCheck = evaluateBookingLocation(coverage, postalCode);
    if (locationCheck.enforced && locationCheck.result.status !== "eligible") {
      const status = locationCheck.result.status;
      res.status(400).json({
        error: SERVICE_AREA_MESSAGES[status],
        reason:
          status === "ineligible" ? "outside_service_area" : "invalid_location",
      });
      return;
    }

    // ── Availability enforcement ─────────────────────────────────────────────
    // The whole service duration must fit inside a single availability window
    // (wall-clock in the effective marketplace timezone). Intervals that fall
    // outside a window or cross a boundary are rejected before any lock/insert.
    const marketplaceTimezone = getMarketplaceTimezone();
    const windows = (await db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, Number(providerId)))) as AvailabilityWindow[];

    if (
      !isWithinAvailability({
        scheduledAt: scheduledAtDate,
        durationMinutes,
        windows,
        tz: marketplaceTimezone,
      })
    ) {
      res.status(400).json({
        error: "The selected time is outside this provider's availability.",
        reason: "outside_availability",
      });
      return;
    }

    // ── Concurrency-safe insert ──────────────────────────────────────────────
    // One transaction: (1) acquire a provider-keyed advisory transaction lock so
    // all booking writes for this provider serialize; (2) reject an active
    // provider overlap; (3) insert while the lock is still held. The live
    // partial unique index remains the final exact-duplicate safeguard.
    const requestedEnd = new Date(
      scheduledAtDate.getTime() + durationMinutes * 60000,
    );

    class ProviderUnavailableError extends Error {}
    class TravelBufferConflictError extends Error {}
    class DuplicateUnderLockError extends Error {
      constructor(readonly winnerId: number) {
        super("DUPLICATE_UNDER_LOCK");
      }
    }

    const insertBookingRow = async () => {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(42001, ${Number(providerId)})`,
        );

        // Same-client exact duplicate, re-checked under the lock — preserves the
        // existing duplicate path when a concurrent request slipped past the
        // preflight. Reported as duplicate_booking (with the winner id), never
        // as a provider overlap.
        const [dupUnderLock] = await tx
          .select({ id: bookingsTable.id })
          .from(bookingsTable)
          .where(activeDuplicateWhere)
          .limit(1);
        if (dupUnderLock) {
          throw new DuplicateUnderLockError(dupUnderLock.id);
        }

        // Provider-level overlap against any OTHER client's active booking.
        // A same-client exact duplicate is handled above (and by the partial
        // unique index); a client never blocks themselves via this path.
        const [conflict] = await tx
          .select({ id: bookingsTable.id })
          .from(bookingsTable)
          .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
          .where(
            and(
              eq(bookingsTable.providerId, Number(providerId)),
              inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
              sql`${bookingsTable.clientId} <> ${req.user!.sub}`,
              sql`${bookingsTable.scheduledAt} < ${requestedEnd}`,
              sql`${scheduledAtDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes})`,
            ),
          )
          .limit(1);

        if (conflict) {
          throw new ProviderUnavailableError();
        }

        // ── Travel/setup buffer (roadmap #12) ────────────────────────────
        // The interval, EXPANDED by the centrally managed buffer, must not
        // touch any other active appointment for this provider — including
        // the same client's other bookings at a different time (exact
        // same-tuple duplicates were already reported as duplicate_booking
        // above). Service duration stays separate from buffer duration.
        const bufferMinutes = getTravelSetupBufferMinutes();
        if (bufferMinutes > 0) {
          const bufferedEnd = new Date(
            requestedEnd.getTime() + bufferMinutes * 60000,
          );
          const [nearMiss] = await tx
            .select({ id: bookingsTable.id })
            .from(bookingsTable)
            .innerJoin(
              servicesTable,
              eq(servicesTable.id, bookingsTable.serviceId),
            )
            .where(
              and(
                eq(bookingsTable.providerId, Number(providerId)),
                inArray(bookingsTable.status, [
                  "requested",
                  "confirmed",
                  "rescheduled",
                ]),
                sql`${bookingsTable.scheduledAt} < ${bufferedEnd}`,
                sql`${scheduledAtDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes} + ${bufferMinutes})`,
              ),
            )
            .limit(1);
          if (nearMiss) {
            throw new TravelBufferConflictError();
          }
        }

        const [row] = await tx
          .insert(bookingsTable)
          .values({
            clientId: req.user!.sub,
            providerId: Number(providerId),
            serviceId: Number(serviceId),
            status: "requested",
            scheduledAt: scheduledAtDate,
            address: String(address),
            city: String(city),
            postalCode: postalCode !== undefined ? String(postalCode) : null,
            careNotes: careNotes !== undefined ? String(careNotes) : null,
            clientNotes: clientNotes !== undefined ? String(clientNotes) : null,
            // Allowlisted attribution only; unknown values are dropped, never
            // stored, and never block the booking.
            source: normalizeBookingSource(source),
          })
          .returning();
        return row;
      });
    };

    const recordDuplicateAndRespond = async (winnerId: number) => {
      await recordPreventedBooking({
        correlationId: String(req.id),
        actorUserId: req.user!.sub,
        subjectBookingId: winnerId,
        providerId: Number(providerId),
        serviceId: Number(serviceId),
        scheduledAt: scheduledAtDate,
        path: "index_violation",
      });
      res.status(409).json({
        error: DUPLICATE_BOOKING_MESSAGE,
        bookingId: winnerId,
        reason: "duplicate_booking",
      });
    };

    let booking: Awaited<ReturnType<typeof insertBookingRow>>;
    try {
      booking = await insertBookingRow();
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        res.status(409).json({
          error: PROVIDER_UNAVAILABLE_MESSAGE,
          reason: "provider_unavailable",
        });
        return;
      }
      if (error instanceof TravelBufferConflictError) {
        res.status(409).json({
          error: TRAVEL_BUFFER_CONFLICT_MESSAGE,
          reason: "travel_buffer_conflict",
        });
        return;
      }
      if (error instanceof DuplicateUnderLockError) {
        await recordDuplicateAndRespond(error.winnerId);
        return;
      }
      if (!isActiveBookingDuplicateViolation(error)) {
        throw error;
      }
      // The database partial unique index rejected a concurrent same-client
      // duplicate. Map it to the SAME friendly duplicate 409 contract — never
      // expose PostgreSQL error text, SQLSTATE codes, or index names.
      const [winner] = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(activeDuplicateWhere)
        .limit(1);

      if (winner) {
        await recordDuplicateAndRespond(winner.id);
        return;
      }

      // Winner vanished before re-selection (e.g. cancelled within
      // microseconds): the slot is genuinely free again. Retry the insert
      // exactly once and re-enter the normal success path ONLY on a
      // successful insert — a failed attempt never emits notifications and
      // never fabricates a 409. If this retry throws (any error, including
      // another race), it propagates honestly to the global error handler.
      booking = await insertBookingRow();
    }

    // Guard: if the DB insert did not return a row the write did not persist.
    // Throw so the JSON error handler returns 500 — never lie to the client.
    if (!booking) {
      throw new Error("Booking insert did not return a row — write may not have persisted.");
    }

    const providerUserId = provider[0].userId;
    const bookingCity = String(city);
    const bookingAt = booking.scheduledAt.toISOString();

    // Notify provider via SSE (web portal — real-time while open)
    emitNewBooking({
      providerId: Number(providerId),
      bookingId: booking!.id,
      city: bookingCity,
      scheduledAt: bookingAt,
    });

    // Notify provider via push (phone — works when app is closed)
    const dateStr = new Date(bookingAt).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    void sendPushToUser(providerUserId, {
      title: "New booking request 📅",
      body: `${bookingCity} · ${dateStr}`,
      data: { screen: "booking", bookingId: booking!.id },
    });

    res.status(201).json({ booking: toClientSafeBooking(booking) });
  }
);

// ── GET /bookings/:bookingId — detail (own only) ──────────────────────────────

router.get(
  "/:bookingId",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const bookingId = Number(req.params["bookingId"]);

    const rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    const booking = rows[0];
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    // Access control: client owns it, or provider owns it, or admin
    const role = req.authz!.activeRole;
    if (role !== "admin") {
      if (role === "client" && booking.clientId !== user.sub) {
        res.status(403).json({ error: "You do not have access to this booking." });
        return;
      }
      if (role === "provider") {
        const profile = await db
          .select({ id: providerProfilesTable.id })
          .from(providerProfilesTable)
          .where(eq(providerProfilesTable.userId, user.sub))
          .limit(1);
        if (!profile[0] || booking.providerId !== profile[0].id) {
          res.status(403).json({ error: "You do not have access to this booking." });
          return;
        }
      }
    }

    res.json({ booking: role === "client" ? toClientSafeBooking(booking) : booking });
  }
);

// ── PATCH /bookings/:bookingId/status — status transition ─────────────────────
//
// Concurrency strategy:
//   1. Provider-profile lookup (outside tx — profiles are stable).
//   2. db.transaction() with SELECT … FOR UPDATE to lock the booking row.
//      Two simultaneous requests for the same booking serialize; only the
//      first can apply a valid transition. The second re-reads the updated
//      status inside the lock and fails isTransitionAllowed → 400.
//   3. Invoice insert uses the DB-level UNIQUE constraint on booking_id as
//      the final safety net. A unique-violation (pg error 23505) is silently
//      swallowed — the invoice already exists, which is the desired state.
//   4. Push notifications are sent OUTSIDE the transaction so a failed push
//      never rolls back a successful status change.

router.patch(
  "/:bookingId/status",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const bookingId = Number(req.params["bookingId"]);
    const { status: newStatus, cancellationReason, scheduledAt } =
      req.body as {
        status?: BookingStatus;
        cancellationReason?: string;
        scheduledAt?: string;
      };

    if (!newStatus) {
      res.status(400).json({ error: "status is required." });
      return;
    }

    // ── 1. Resolve provider profile BEFORE the transaction ───────────────────
    // Profiles are stable — no need to hold a lock while querying them.
    let callerProviderProfileId: number | null = null;
    const role = req.authz!.activeRole;
    if (role === "provider") {
      const profileRows = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, user.sub))
        .limit(1);
      if (!profileRows[0]) {
        res.status(403).json({ error: "Provider profile not found." });
        return;
      }
      callerProviderProfileId = profileRows[0].id;
    }

    // ── 2. Transaction: lock row → validate → update → invoice ───────────────
    interface TxResult {
      updatedBooking: typeof bookingsTable.$inferSelect;
      originalBooking: typeof bookingsTable.$inferSelect;
      rescheduleHistoryId: number | null;
    }

    let txResult: TxResult;
    try {
      txResult = await db.transaction(async (tx) => {
        // Lock this booking row so concurrent requests serialize here.
        const rows = await tx
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, bookingId))
          .for("update")
          .limit(1);

        const booking = rows[0];

        if (!booking) {
          throw Object.assign(new Error("NOT_FOUND"), {
            statusCode: 404,
            userMessage: "Booking not found.",
          });
        }

        // Ownership
        if (role === "client" && booking.clientId !== user.sub) {
          throw Object.assign(new Error("FORBIDDEN"), {
            statusCode: 403,
            userMessage: "You do not have access to this booking.",
          });
        }
        if (role === "provider" && booking.providerId !== callerProviderProfileId) {
          throw Object.assign(new Error("FORBIDDEN"), {
            statusCode: 403,
            userMessage: "You do not have access to this booking.",
          });
        }

        // Consent-first policy (docs/rescheduling-policy.md): a provider can
        // no longer overwrite the client's confirmed time. Give a precise
        // pointer to the proposal workflow instead of a generic 409.
        if (
          role === "provider" &&
          newStatus === "rescheduled" &&
          booking.status === "confirmed"
        ) {
          throw Object.assign(new Error("CONSENT_REQUIRED"), {
            statusCode: 409,
            userMessage:
              "Provider time changes require client consent. Propose a new time instead — the client will be asked to confirm it.",
          });
        }

        // State-machine transition check — runs against the LOCKED current status,
        // so a concurrent confirm cannot race past a concurrent cancel.
        if (!isTransitionAllowed(booking.status as BookingStatus, newStatus, role)) {
          throw Object.assign(new Error("INVALID_TRANSITION"), {
            statusCode: 409,
            userMessage: `Cannot move booking from '${booking.status}' to '${newStatus}' — the status may have changed. Please refresh and try again.`,
          });
        }

        // Extra validation
        if (newStatus === "cancelled" && !cancellationReason && role !== "admin") {
          throw Object.assign(new Error("VALIDATION"), {
            statusCode: 400,
            userMessage: "cancellationReason is required when cancelling.",
          });
        }
        if (newStatus === "rescheduled" && !scheduledAt) {
          throw Object.assign(new Error("VALIDATION"), {
            statusCode: 400,
            userMessage: "scheduledAt is required when rescheduling.",
          });
        }

        // ── Rescheduling enforcement ─────────────────────────────────────────
        // A rescheduled booking must obey the SAME safety rules as a new
        // booking: valid future instant, active service, availability-window
        // fit, no provider overlap, and no active duplicate. All checks run
        // inside this transaction, and booking writes for the provider are
        // serialized via the same advisory lock POST /bookings uses, so a
        // reschedule can never race a concurrent insert into a double-booking.
        let rescheduleDate: Date | null = null;
        if (newStatus === "rescheduled" && scheduledAt) {
          rescheduleDate = new Date(scheduledAt);

          // Reject malformed or past instants before any availability work —
          // same wording as booking creation.
          if (Number.isNaN(rescheduleDate.getTime())) {
            throw Object.assign(new Error("VALIDATION"), {
              statusCode: 400,
              userMessage: "scheduledAt must be a valid date-time.",
            });
          }
          if (rescheduleDate.getTime() <= Date.now()) {
            throw Object.assign(new Error("VALIDATION"), {
              statusCode: 400,
              userMessage: "scheduledAt must be in the future.",
            });
          }

          // The booking's service must still exist and be active — inactive
          // services are never silently carried into a new time.
          const [service] = await tx
            .select({
              durationMinutes: servicesTable.durationMinutes,
              isActive: servicesTable.isActive,
            })
            .from(servicesTable)
            .where(eq(servicesTable.id, booking.serviceId))
            .limit(1);
          if (!service || !service.isActive) {
            throw Object.assign(new Error("SERVICE_INACTIVE"), {
              statusCode: 409,
              userMessage:
                "This booking's service is no longer offered, so it cannot be rescheduled. Please cancel and book an available service.",
            });
          }

          // ── Service-area revalidation (roadmap #12) ──────────────────────
          // Coverage changes apply to FUTURE reschedules: the booking's
          // stored location must pass the provider's CURRENT active
          // coverage before its time can move. The existing confirmed
          // appointment itself stays valid — only the change is blocked.
          const rescheduleCoverage = await loadProviderCoverage(
            tx,
            booking.providerId,
          );
          const rescheduleLocation = evaluateBookingLocation(
            rescheduleCoverage,
            booking.postalCode,
          );
          if (
            rescheduleLocation.enforced &&
            rescheduleLocation.result.status !== "eligible"
          ) {
            throw Object.assign(new Error("OUTSIDE_SERVICE_AREA"), {
              statusCode: 409,
              userMessage: RESCHEDULE_OUTSIDE_SERVICE_AREA_MESSAGE,
              reason: "outside_service_area",
            });
          }

          // The whole service duration must fit inside one availability
          // window (wall-clock in the marketplace timezone) — same rule and
          // wording as booking creation.
          const windows = (await tx
            .select({
              dayOfWeek: availabilityTable.dayOfWeek,
              startTime: availabilityTable.startTime,
              endTime: availabilityTable.endTime,
            })
            .from(availabilityTable)
            .where(
              eq(availabilityTable.providerId, booking.providerId),
            )) as AvailabilityWindow[];
          if (
            !isWithinAvailability({
              scheduledAt: rescheduleDate,
              durationMinutes: service.durationMinutes,
              windows,
              tz: getMarketplaceTimezone(),
            })
          ) {
            throw Object.assign(new Error("VALIDATION"), {
              statusCode: 400,
              userMessage:
                "The selected time is outside this provider's availability.",
            });
          }

          // Serialize with POST /bookings inserts for this provider so the
          // overlap/duplicate checks below cannot race a concurrent booking.
          // Lock order (booking row lock → provider advisory lock) cannot
          // deadlock with POST: booking creation never waits on row locks.
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(42001, ${booking.providerId})`,
          );

          // Same-client exact duplicate at the NEW time: another ACTIVE
          // booking already holds the (client, provider, service, time)
          // tuple. Reported with the friendly duplicate message; the live
          // partial unique index remains the final race safeguard on UPDATE.
          const [duplicate] = await tx
            .select({ id: bookingsTable.id })
            .from(bookingsTable)
            .where(
              and(
                sql`${bookingsTable.id} <> ${bookingId}`,
                eq(bookingsTable.clientId, booking.clientId),
                eq(bookingsTable.providerId, booking.providerId),
                eq(bookingsTable.serviceId, booking.serviceId),
                eq(bookingsTable.scheduledAt, rescheduleDate),
                inArray(bookingsTable.status, [
                  "requested",
                  "confirmed",
                  "rescheduled",
                ]),
              ),
            )
            .limit(1);
          if (duplicate) {
            throw Object.assign(new Error("DUPLICATE_BOOKING"), {
              statusCode: 409,
              userMessage: DUPLICATE_BOOKING_MESSAGE,
            });
          }

          // Provider-level overlap against any OTHER client's active booking
          // — identical interval rule to booking creation. The booking being
          // rescheduled never blocks itself, and (as with creation) a client
          // never blocks themselves via this path.
          const rescheduleEnd = new Date(
            rescheduleDate.getTime() + service.durationMinutes * 60000,
          );
          const [conflict] = await tx
            .select({ id: bookingsTable.id })
            .from(bookingsTable)
            .innerJoin(
              servicesTable,
              eq(servicesTable.id, bookingsTable.serviceId),
            )
            .where(
              and(
                eq(bookingsTable.providerId, booking.providerId),
                inArray(bookingsTable.status, [
                  "requested",
                  "confirmed",
                  "rescheduled",
                ]),
                sql`${bookingsTable.id} <> ${bookingId}`,
                sql`${bookingsTable.clientId} <> ${booking.clientId}`,
                sql`${bookingsTable.scheduledAt} < ${rescheduleEnd}`,
                sql`${rescheduleDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes})`,
              ),
            )
            .limit(1);
          if (conflict) {
            throw Object.assign(new Error("PROVIDER_UNAVAILABLE"), {
              statusCode: 409,
              userMessage: PROVIDER_UNAVAILABLE_MESSAGE,
            });
          }

          // ── Travel/setup buffer (roadmap #12) ────────────────────────────
          // Same rule as booking creation: the rescheduled interval,
          // expanded by the centrally managed buffer, must not touch any
          // OTHER active appointment for this provider. The booking being
          // rescheduled never blocks itself.
          const bufferMinutes = getTravelSetupBufferMinutes();
          if (bufferMinutes > 0) {
            const bufferedEnd = new Date(
              rescheduleEnd.getTime() + bufferMinutes * 60000,
            );
            const [nearMiss] = await tx
              .select({ id: bookingsTable.id })
              .from(bookingsTable)
              .innerJoin(
                servicesTable,
                eq(servicesTable.id, bookingsTable.serviceId),
              )
              .where(
                and(
                  eq(bookingsTable.providerId, booking.providerId),
                  inArray(bookingsTable.status, [
                    "requested",
                    "confirmed",
                    "rescheduled",
                  ]),
                  sql`${bookingsTable.id} <> ${bookingId}`,
                  sql`${bookingsTable.scheduledAt} < ${bufferedEnd}`,
                  sql`${rescheduleDate} < ${bookingsTable.scheduledAt} + make_interval(mins => ${servicesTable.durationMinutes} + ${bufferMinutes})`,
                ),
              )
              .limit(1);
            if (nearMiss) {
              throw Object.assign(new Error("TRAVEL_BUFFER_CONFLICT"), {
                statusCode: 409,
                userMessage: TRAVEL_BUFFER_CONFLICT_MESSAGE,
                reason: "travel_buffer_conflict",
              });
            }
          }
        }

        const updates: Partial<typeof bookingsTable.$inferInsert> = {
          status: newStatus,
          updatedAt: new Date(),
        };
        if (newStatus === "cancelled") {
          updates.cancelledBy = user.sub;
          if (cancellationReason) updates.cancellationReason = cancellationReason;
        }
        if (newStatus === "rescheduled" && rescheduleDate) {
          updates.scheduledAt = rescheduleDate;
        }

        const [updatedBooking] = await tx
          .update(bookingsTable)
          .set(updates)
          .where(eq(bookingsTable.id, bookingId))
          .returning();

        // Guard: the row lock means the row must exist at this point.
        // If returning() is empty the write did not persist — throw so the
        // caller gets 500 (JSON) rather than silently returning stale data.
        if (!updatedBooking) {
          throw new Error(
            "Booking update did not return a row — write may not have persisted."
          );
        }

        // Append-only rescheduling history (same transaction: the time change
        // and its audit row commit or roll back together).
        let rescheduleHistoryId: number | null = null;
        if (newStatus === "rescheduled" && rescheduleDate) {
          const [historyRow] = await tx
            .insert(rescheduleHistoryTable)
            .values({
              bookingId,
              originalScheduledAt: booking.scheduledAt,
              newScheduledAt: rescheduleDate,
              requesterUserId: user.sub,
              requesterRole: role as "client" | "provider" | "admin",
              previousStatus: booking.status as BookingStatus,
              newStatus: "rescheduled",
            })
            .returning({ id: rescheduleHistoryTable.id });
          if (!historyRow) {
            throw new Error("Reschedule history insert did not return a row — rolling back.");
          }
          rescheduleHistoryId = historyRow.id;
        }

        // Any transition away from `confirmed` makes a pending provider
        // proposal stale — resolve it as cancelled in the same transaction.
        if (newStatus !== "confirmed") {
          await tx
            .update(rescheduleProposalsTable)
            .set({
              status: "cancelled",
              resolvedAt: new Date(),
              version: sql`${rescheduleProposalsTable.version} + 1`,
            })
            .where(
              and(
                eq(rescheduleProposalsTable.bookingId, bookingId),
                eq(rescheduleProposalsTable.status, "pending"),
              ),
            );
        }

        // Auto-create invoice when confirmed
        if (newStatus === "confirmed") {
          const serviceRows = await tx
            .select({ priceCents: servicesTable.priceCents })
            .from(servicesTable)
            .where(eq(servicesTable.id, booking.serviceId))
            .limit(1);

          if (serviceRows[0]) {
            // onConflictDoNothing: if an invoice already exists for this
            // booking (e.g. confirmed → rescheduled → re-confirmed), the
            // unique constraint on booking_id fires; we simply skip the
            // duplicate insert and keep the original invoice.
            await tx
              .insert(invoicesTable)
              .values({
                bookingId,
                clientId: booking.clientId,
                providerId: booking.providerId,
                amountCents: serviceRows[0].priceCents,
                status: "pending",
              })
              .onConflictDoNothing();
          }
        }

        return { updatedBooking, originalBooking: booking, rescheduleHistoryId };
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string; reason?: string };
      if (e.statusCode) {
        res
          .status(e.statusCode)
          .json(e.reason ? { error: e.userMessage, reason: e.reason } : { error: e.userMessage });
        return;
      }
      // Race safety net: a concurrent request took the exact duplicate tuple
      // between our in-transaction check and the UPDATE, and the live partial
      // unique index rejected the write. Map it to the SAME friendly 409 —
      // never expose PostgreSQL error text, SQLSTATE codes, or index names.
      if (newStatus === "rescheduled" && isActiveBookingDuplicateViolation(err)) {
        res.status(409).json({ error: DUPLICATE_BOOKING_MESSAGE });
        return;
      }
      throw err; // unexpected — propagate to Express error handler
    }

    const { updatedBooking, originalBooking, rescheduleHistoryId } = txResult;

    // Coarse notification-outcome recording on the history row (post-commit,
    // best effort — never affects the booking write).
    const recordHistoryOutcome = (push: Promise<void>) => {
      if (rescheduleHistoryId === null) return;
      push
        .then(() =>
          db
            .update(rescheduleHistoryTable)
            .set({ notificationOutcome: "sent" })
            .where(eq(rescheduleHistoryTable.id, rescheduleHistoryId)),
        )
        .catch(() =>
          db
            .update(rescheduleHistoryTable)
            .set({ notificationOutcome: "failed" })
            .where(eq(rescheduleHistoryTable.id, rescheduleHistoryId))
            .catch(() => undefined),
        );
    };

    // ── 3. Push notifications — outside the transaction ───────────────────────
    // Fire-and-forget: a failed push never affects booking state.
    const originalDateStr = new Date(originalBooking.scheduledAt).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" }
    );

    if (newStatus === "confirmed") {
      void sendPushToUser(originalBooking.clientId, {
        title: "Booking confirmed! 🎉",
        body: `Your appointment is set for ${originalDateStr}`,
        data: { screen: "booking", bookingId },
      });
    } else if (newStatus === "cancelled") {
      if (role === "client") {
        // Client cancelled — notify the provider
        const provProfile = await db
          .select({ userId: providerProfilesTable.userId })
          .from(providerProfilesTable)
          .where(eq(providerProfilesTable.id, originalBooking.providerId))
          .limit(1);
        if (provProfile[0]) {
          void sendPushToUser(provProfile[0].userId, {
            title: "Booking cancelled",
            body: `A client cancelled their ${originalDateStr} appointment`,
            data: { screen: "booking", bookingId },
          });
        }
      } else if (role === "provider") {
        // Provider cancelled — notify the client
        void sendPushToUser(originalBooking.clientId, {
          title: "Booking cancelled",
          body: "Your appointment was cancelled by the provider",
          data: { screen: "booking", bookingId },
        });
      }
    } else if (newStatus === "rescheduled" && scheduledAt) {
      const newDateStr = new Date(scheduledAt).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
      if (role === "client") {
        // Client rescheduled — notify the provider
        const provProfile = await db
          .select({ userId: providerProfilesTable.userId })
          .from(providerProfilesTable)
          .where(eq(providerProfilesTable.id, originalBooking.providerId))
          .limit(1);
        if (provProfile[0]) {
          recordHistoryOutcome(
            sendPushToUser(provProfile[0].userId, {
              title: "Booking rescheduled",
              body: `Client requested a new time: ${newDateStr}`,
              data: { screen: "booking", bookingId },
            }),
          );
        }
      } else {
        // Admin rescheduled — notify the client
        recordHistoryOutcome(
          sendPushToUser(originalBooking.clientId, {
            title: "Booking rescheduled",
            body: `New time: ${newDateStr}`,
            data: { screen: "booking", bookingId },
          }),
        );
      }
    }

    res.json({
      booking: role === "client" ? toClientSafeBooking(updatedBooking) : updatedBooking,
    });
  }
);

export default router;
