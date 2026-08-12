import { Router, type Request, type Response } from "express";
import { eq, and, or, sql, getTableColumns, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  providerProfilesTable,
  servicesTable,
  invoicesTable,
  usersTable,
} from "@workspace/db";
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
    const { providerId, serviceId, scheduledAt, address, city, postalCode, careNotes, clientNotes } =
      req.body as Record<string, unknown>;

    if (!providerId || !serviceId || !scheduledAt || !address || !city) {
      res.status(400).json({
        error: "providerId, serviceId, scheduledAt, address, and city are required.",
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
      .select({ id: servicesTable.id, priceCents: servicesTable.priceCents })
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
      res.status(409).json({
        error: DUPLICATE_BOOKING_MESSAGE,
        bookingId: duplicate.id,
      });
      return;
    }

    // Single-statement insert (auto-commit): PostgreSQL statement atomicity
    // guarantees a rejected insert persists nothing — no explicit transaction
    // or rollback handling is required on this path.
    const insertBookingRow = async () => {
      const [row] = await db
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
        })
        .returning();
      return row;
    };

    let booking: Awaited<ReturnType<typeof insertBookingRow>>;
    try {
      booking = await insertBookingRow();
    } catch (error) {
      if (!isActiveBookingDuplicateViolation(error)) {
        throw error;
      }
      // The database race guard rejected a concurrent duplicate. Map it to the
      // SAME friendly 409 contract as the preflight — never expose PostgreSQL
      // error text, SQLSTATE codes, or index names to the client (the raw
      // error reaches only the server logger via the global handler when
      // rethrown, and is not rethrown here).
      const [winner] = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(activeDuplicateWhere)
        .limit(1);

      if (winner) {
        res.status(409).json({
          error: DUPLICATE_BOOKING_MESSAGE,
          bookingId: winner.id,
        });
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
      data: { screen: "bookings", bookingId: booking!.id },
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

        const updates: Partial<typeof bookingsTable.$inferInsert> = {
          status: newStatus,
          updatedAt: new Date(),
        };
        if (newStatus === "cancelled") {
          updates.cancelledBy = user.sub;
          if (cancellationReason) updates.cancellationReason = cancellationReason;
        }
        if (newStatus === "rescheduled" && scheduledAt) {
          updates.scheduledAt = new Date(scheduledAt);
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

        return { updatedBooking, originalBooking: booking };
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; userMessage?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({ error: e.userMessage });
        return;
      }
      throw err; // unexpected — propagate to Express error handler
    }

    const { updatedBooking, originalBooking } = txResult;

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
        data: { screen: "bookings", bookingId },
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
            data: { screen: "bookings", bookingId },
          });
        }
      } else if (role === "provider") {
        // Provider cancelled — notify the client
        void sendPushToUser(originalBooking.clientId, {
          title: "Booking cancelled",
          body: "Your appointment was cancelled by the provider",
          data: { screen: "bookings", bookingId },
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
          void sendPushToUser(provProfile[0].userId, {
            title: "Booking rescheduled",
            body: `Client requested a new time: ${newDateStr}`,
            data: { screen: "bookings", bookingId },
          });
        }
      } else {
        // Provider rescheduled — notify the client
        void sendPushToUser(originalBooking.clientId, {
          title: "Booking rescheduled",
          body: `New time: ${newDateStr}`,
          data: { screen: "bookings", bookingId },
        });
      }
    }

    res.json({
      booking: role === "client" ? toClientSafeBooking(updatedBooking) : updatedBooking,
    });
  }
);

export default router;
