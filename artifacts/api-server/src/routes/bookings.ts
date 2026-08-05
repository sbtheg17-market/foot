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

    // Ownership check
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

    // Validate transition
    if (!isTransitionAllowed(booking.status as BookingStatus, newStatus, user.role)) {
      res.status(400).json({
        error: `Transition from '${booking.status}' to '${newStatus}' is not allowed for role '${user.role}'.`,
      });
      return;
    }

    // Validate extras
    if (newStatus === "cancelled" && !cancellationReason && user.role !== "admin") {
      res.status(400).json({ error: "cancellationReason is required when cancelling." });
      return;
    }
    if (newStatus === "rescheduled" && !scheduledAt) {
      res.status(400).json({ error: "scheduledAt is required when rescheduling." });
      return;
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

    const [updated] = await db
      .update(bookingsTable)
      .set(updates)
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // Auto-create invoice when booking is confirmed
    if (newStatus === "confirmed") {
      const service = await db
        .select({ priceCents: servicesTable.priceCents })
        .from(servicesTable)
        .where(eq(servicesTable.id, booking.serviceId))
        .limit(1);

      if (service[0]) {
        // Check if invoice already exists (idempotent)
        const existing = await db
          .select({ id: invoicesTable.id })
          .from(invoicesTable)
          .where(eq(invoicesTable.bookingId, bookingId))
          .limit(1);

        if (!existing[0]) {
          await db.insert(invoicesTable).values({
            bookingId,
            clientId: booking.clientId,
            providerId: booking.providerId,
            amountCents: service[0].priceCents,
            status: "pending",
          });
        }
      }
    }

    // ── Push notifications for key status transitions ────────────────────────
    if (newStatus === "confirmed") {
      // Notify the client their booking is confirmed
      void sendPushToUser(booking.clientId, {
        title: "Booking confirmed! 🎉",
        body: `Your appointment is set for ${new Date(booking.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
        data: { screen: "bookings", bookingId },
      });
    } else if (newStatus === "cancelled") {
      if (user.role === "client") {
        // Client cancelled — notify the provider
        const provProfile = await db
          .select({ userId: providerProfilesTable.userId })
          .from(providerProfilesTable)
          .where(eq(providerProfilesTable.id, booking.providerId))
          .limit(1);
        if (provProfile[0]) {
          void sendPushToUser(provProfile[0].userId, {
            title: "Booking cancelled",
            body: `A client cancelled their ${new Date(booking.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} appointment`,
            data: { screen: "bookings", bookingId },
          });
        }
      } else if (user.role === "provider") {
        // Provider cancelled — notify the client
        void sendPushToUser(booking.clientId, {
          title: "Booking cancelled",
          body: "Your appointment was cancelled by the provider",
          data: { screen: "bookings", bookingId },
        });
      }
    } else if (newStatus === "rescheduled" && scheduledAt) {
      // Notify the client of the rescheduled time
      void sendPushToUser(booking.clientId, {
        title: "Booking rescheduled",
        body: `New time: ${new Date(scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        data: { screen: "bookings", bookingId },
      });
    }

    res.json({ booking: updated });
  }
);

export default router;
