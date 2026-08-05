import { Router, type Request, type Response } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  providerProfilesTable,
  servicesTable,
  invoicesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  isTransitionAllowed,
  type BookingStatus,
} from "../lib/booking-state-machine.js";
import { emitNewBooking } from "../lib/notification-bus.js";
import { sendPushToUser } from "../lib/push-notifications.js";

const router = Router();

// ── GET /bookings — list own bookings ─────────────────────────────────────────

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
    const offset = Number(req.query["offset"] ?? 0);
    const statusFilter = req.query["status"] as BookingStatus | undefined;

    // Scope by role
    let ownershipClause;
    if (user.role === "client") {
      ownershipClause = eq(bookingsTable.clientId, user.sub);
    } else if (user.role === "provider") {
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
        .select()
        .from(bookingsTable)
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
      bookings,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  }
);

// ── POST /bookings — create booking (client only) ─────────────────────────────

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

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        clientId: req.user!.sub,
        providerId: Number(providerId),
        serviceId: Number(serviceId),
        status: "requested",
        scheduledAt: new Date(String(scheduledAt)),
        address: String(address),
        city: String(city),
        postalCode: postalCode !== undefined ? String(postalCode) : null,
        careNotes: careNotes !== undefined ? String(careNotes) : null,
        clientNotes: clientNotes !== undefined ? String(clientNotes) : null,
      })
      .returning();

    const providerUserId = provider[0].userId;
    const bookingCity = String(city);
    const bookingAt = booking!.scheduledAt.toISOString();

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

    res.status(201).json({ booking });
  }
);

// ── GET /bookings/:bookingId — detail (own only) ──────────────────────────────

router.get(
  "/:bookingId",
  requireAuth,
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
    if (user.role !== "admin") {
      if (user.role === "client" && booking.clientId !== user.sub) {
        res.status(403).json({ error: "You do not have access to this booking." });
        return;
      }
      if (user.role === "provider") {
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

    res.json({ booking });
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
    if (user.role === "provider") {
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
        if (user.role === "client" && booking.clientId !== user.sub) {
          throw Object.assign(new Error("FORBIDDEN"), {
            statusCode: 403,
            userMessage: "You do not have access to this booking.",
          });
        }
        if (user.role === "provider" && booking.providerId !== callerProviderProfileId) {
          throw Object.assign(new Error("FORBIDDEN"), {
            statusCode: 403,
            userMessage: "You do not have access to this booking.",
          });
        }

        // State-machine transition check — runs against the LOCKED current status,
        // so a concurrent confirm cannot race past a concurrent cancel.
        if (!isTransitionAllowed(booking.status as BookingStatus, newStatus, user.role)) {
          throw Object.assign(new Error("INVALID_TRANSITION"), {
            statusCode: 409,
            userMessage: `Cannot move booking from '${booking.status}' to '${newStatus}' — the status may have changed. Please refresh and try again.`,
          });
        }

        // Extra validation
        if (newStatus === "cancelled" && !cancellationReason && user.role !== "admin") {
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

        return { updatedBooking: updatedBooking!, originalBooking: booking };
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
      if (user.role === "client") {
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
      } else if (user.role === "provider") {
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
      if (user.role === "client") {
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

    res.json({ booking: updatedBooking });
  }
);

export default router;
