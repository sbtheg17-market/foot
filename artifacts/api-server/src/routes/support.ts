import { Router, type Request, type Response } from "express";
import { eq, and, desc, ne } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingOutcomeHistoryTable,
  providerProfilesTable,
  supportTicketsTable,
  supportMessagesTable,
  usersTable,
} from "@workspace/db";
import {
  requireAuth,
  requireApprovedProviderIfProvider,
  requireRole,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { getSupportContact } from "../lib/support-contact.js";
import type { BookingStatus } from "../lib/booking-state-machine.js";

/**
 * Minimal support workflow (roadmap #13, docs/cancellation-no-show-policy.md).
 *
 * API-first by design: no dedicated support dashboard exists. Either party of
 * a terminal booking can escalate it into a support ticket; admins resolve
 * via the support-role endpoints below. Support data is internal-only —
 * regular clients/providers can never read another party's escalations,
 * private reason snapshots, or admin notes.
 *
 * Every support-role access is audit-logged (structured pino log lines).
 */

const router = Router();

const TERMINAL_STATUSES: BookingStatus[] = ["cancelled", "no_show", "completed"];

const ESCALATION_NOT_AVAILABLE_MESSAGE =
  "Support escalation is available once a booking is completed, cancelled, or marked as a no-show.";

const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];

// ── GET /support/contact — public support contact (pilot readiness) ──────────
//
// Env-configured (SUPPORT_CONTACT_URL > SUPPORT_CONTACT_EMAIL > documented
// placeholder). Public by design: the booking page footer and portal footers
// render it for signed-out visitors too. Invalid env values throw → 500.

router.get("/contact", (_req: Request, res: Response): void => {
  res.json({ contact: getSupportContact() });
});

/** Party-safe ticket projection — never leaks admin notes or other users. */
function toSafeTicket(ticket: typeof supportTicketsTable.$inferSelect) {
  return {
    id: ticket.id,
    bookingId: ticket.bookingId,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

// ── POST /support/escalations — either party escalates a terminal booking ────

router.post(
  "/escalations",
  requireAuth,
  requireRole("client", "provider"),
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const role = req.authz!.activeRole;
    const body = (req.body ?? {}) as { bookingId?: unknown; message?: unknown };

    const bookingId = Number(body.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      res.status(400).json({ error: "bookingId is required." });
      return;
    }
    if (body.message !== undefined && typeof body.message !== "string") {
      res.status(400).json({ error: "message must be a string." });
      return;
    }
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    // Non-leaking: missing and unowned bookings are indistinguishable.
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    if (role === "client" && booking.clientId !== user.sub) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    if (role === "provider") {
      const [profile] = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, user.sub))
        .limit(1);
      if (!profile || booking.providerId !== profile.id) {
        res.status(404).json({ error: "Booking not found." });
        return;
      }
    }

    if (!TERMINAL_STATUSES.includes(booking.status as BookingStatus)) {
      res.status(409).json({ error: ESCALATION_NOT_AVAILABLE_MESSAGE });
      return;
    }

    // Duplicate-submit protection: one unresolved escalation per booking per
    // user. A retry returns the SAME ticket — never a second row.
    const [existing] = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.userId, user.sub),
          eq(supportTicketsTable.bookingId, bookingId),
          ne(supportTicketsTable.status, "resolved"),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(200).json({ ticket: toSafeTicket(existing), created: false });
      return;
    }

    const ticket = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(supportTicketsTable)
        .values({
          userId: user.sub,
          bookingId,
          subject: `Booking dispute — booking #${bookingId}`,
        })
        .returning();
      if (!row) throw new Error("Escalation insert did not return a row.");
      if (message.length > 0) {
        await tx.insert(supportMessagesTable).values({
          ticketId: row.id,
          userId: user.sub,
          message,
        });
      }
      return row;
    });

    logger.info(
      { event: "support_escalation_created", ticketId: ticket.id, bookingId, actorUserId: user.sub, actorRole: role },
      "support escalation created",
    );
    res.status(201).json({ ticket: toSafeTicket(ticket), created: true });
  },
);

// ── Support-role (admin) endpoints — internal only, audit-logged ─────────────

router.use(requireAuth, requireRole("admin"));

// GET /support/bookings/:bookingId/escalations — tickets + full outcome history

router.get(
  "/bookings/:bookingId/escalations",
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = Number(req.params["bookingId"]);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      res.status(400).json({ error: "Invalid booking ID." });
      return;
    }

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    const [tickets, history] = await Promise.all([
      db
        .select()
        .from(supportTicketsTable)
        .where(eq(supportTicketsTable.bookingId, bookingId))
        .orderBy(desc(supportTicketsTable.id)),
      db
        .select()
        .from(bookingOutcomeHistoryTable)
        .where(eq(bookingOutcomeHistoryTable.bookingId, bookingId))
        .orderBy(desc(bookingOutcomeHistoryTable.id)),
    ]);

    logger.info(
      { event: "support_escalation_viewed", bookingId, actorUserId: req.user!.sub },
      "support viewed booking escalations",
    );

    res.json({
      booking: {
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt.toISOString(),
        cancellationCategory: booking.cancellationCategory,
        cancellationReason: booking.cancellationReason,
        noShowMarkedAt: booking.noShowMarkedAt?.toISOString() ?? null,
      },
      tickets: tickets.map((t) => ({
        ...toSafeTicket(t),
        userId: t.userId,
      })),
      // Support view is FULL: includes private reason snapshots and actor ids.
      history: history.map((h) => ({
        id: h.id,
        bookingId: h.bookingId,
        actorUserId: h.actorUserId,
        actorRole: h.actorRole,
        action: h.action,
        category: h.category,
        reasonCategory: h.reasonCategory,
        reasonSnapshot: h.reasonSnapshot,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  },
);

// PATCH /support/escalations/:ticketId — state, mediation outcome, correction, suspension

router.patch(
  "/escalations/:ticketId",
  async (req: Request, res: Response): Promise<void> => {
    const ticketId = Number(req.params["ticketId"]);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({ error: "Invalid ticket ID." });
      return;
    }

    const body = (req.body ?? {}) as {
      status?: unknown;
      resolutionNote?: unknown;
      correction?: unknown;
      suspendUserId?: unknown;
    };

    if (
      body.status !== undefined &&
      !TICKET_STATUSES.includes(body.status as TicketStatus)
    ) {
      res.status(400).json({ error: "status must be open, in_progress, or resolved." });
      return;
    }
    if (body.resolutionNote !== undefined && typeof body.resolutionNote !== "string") {
      res.status(400).json({ error: "resolutionNote must be a string." });
      return;
    }

    // Optional booking outcome correction — recorded outcome, not full chat.
    let correction: { status: "completed" | "cancelled"; reason: string } | null = null;
    if (body.correction !== undefined) {
      const c = body.correction as { status?: unknown; reason?: unknown };
      if (
        (c.status !== "completed" && c.status !== "cancelled") ||
        typeof c.reason !== "string" ||
        c.reason.trim().length === 0
      ) {
        res.status(400).json({
          error: "correction requires status (completed or cancelled) and a non-empty reason.",
        });
        return;
      }
      correction = { status: c.status, reason: c.reason.trim() };
    }

    let suspendUserId: number | null = null;
    if (body.suspendUserId !== undefined) {
      suspendUserId = Number(body.suspendUserId);
      if (!Number.isInteger(suspendUserId) || suspendUserId <= 0) {
        res.status(400).json({ error: "suspendUserId must be a positive integer." });
        return;
      }
    }

    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, ticketId))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    if ((correction || suspendUserId) && !ticket.bookingId) {
      res.status(409).json({ error: "This ticket is not linked to a booking." });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        // Correction: lock the booking row, validate the source state, apply,
        // and append the support_corrected history row atomically.
        let correctedBooking: typeof bookingsTable.$inferSelect | null = null;
        if (correction && ticket.bookingId) {
          const rows = await tx
            .select()
            .from(bookingsTable)
            .where(eq(bookingsTable.id, ticket.bookingId))
            .for("update")
            .limit(1);
          const booking = rows[0];
          if (!booking) {
            throw Object.assign(new Error("NOT_FOUND"), {
              statusCode: 404,
              userMessage: "Booking not found.",
            });
          }
          // Corrections apply to disputed terminal outcomes only; they never
          // invent new bookings or times, and never touch active bookings.
          if (!["cancelled", "no_show"].includes(booking.status)) {
            throw Object.assign(new Error("INVALID_CORRECTION"), {
              statusCode: 409,
              userMessage:
                "Only cancelled or no-show bookings can be corrected by support.",
            });
          }
          const updates: Partial<typeof bookingsTable.$inferInsert> = {
            status: correction.status,
            updatedAt: new Date(),
          };
          if (correction.status === "cancelled") {
            updates.cancellationCategory = "cancelled_by_support";
            updates.cancelledBy = req.user!.sub;
          }
          const [updated] = await tx
            .update(bookingsTable)
            .set(updates)
            .where(eq(bookingsTable.id, booking.id))
            .returning();
          if (!updated) throw new Error("Correction update did not return a row.");
          correctedBooking = updated;

          const [historyRow] = await tx
            .insert(bookingOutcomeHistoryTable)
            .values({
              bookingId: booking.id,
              actorUserId: req.user!.sub,
              actorRole: "admin",
              action: "support_corrected",
              category: correction.status === "cancelled" ? "cancelled_by_support" : null,
              reasonSnapshot: correction.reason,
              previousStatus: booking.status,
              newStatus: correction.status,
            })
            .returning({ id: bookingOutcomeHistoryTable.id });
          if (!historyRow) throw new Error("Outcome history insert did not return a row.");
        }

        // Suspension: reuse the existing users.is_active mechanism — an
        // inactive user fails authorization on every subsequent request.
        // The target must be a party to the linked booking.
        if (suspendUserId && ticket.bookingId) {
          const [booking] = await tx
            .select({
              clientId: bookingsTable.clientId,
              providerId: bookingsTable.providerId,
            })
            .from(bookingsTable)
            .where(eq(bookingsTable.id, ticket.bookingId))
            .limit(1);
          const [providerProfile] = booking
            ? await tx
                .select({ userId: providerProfilesTable.userId })
                .from(providerProfilesTable)
                .where(eq(providerProfilesTable.id, booking.providerId))
                .limit(1)
            : [];
          const partyUserIds = booking
            ? [booking.clientId, providerProfile?.userId].filter(
                (id): id is number => typeof id === "number",
              )
            : [];
          if (!partyUserIds.includes(suspendUserId)) {
            throw Object.assign(new Error("INVALID_SUSPENSION"), {
              statusCode: 409,
              userMessage: "suspendUserId must be a party to the linked booking.",
            });
          }
          await tx
            .update(usersTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(usersTable.id, suspendUserId));
        }

        // Mediation outcome note — recorded as a support message (outcome,
        // not full chat), attributed to the acting admin.
        const note = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
        if (note.length > 0) {
          await tx.insert(supportMessagesTable).values({
            ticketId,
            userId: req.user!.sub,
            message: note.slice(0, 2000),
          });
        }

        const [updatedTicket] = await tx
          .update(supportTicketsTable)
          .set({
            ...(body.status !== undefined ? { status: body.status as TicketStatus } : {}),
            updatedAt: new Date(),
          })
          .where(eq(supportTicketsTable.id, ticketId))
          .returning();
        if (!updatedTicket) throw new Error("Ticket update did not return a row.");

        return { updatedTicket, correctedBooking };
      });

      logger.info(
        {
          event: "support_escalation_updated",
          ticketId,
          bookingId: ticket.bookingId,
          actorUserId: req.user!.sub,
          status: body.status,
          corrected: Boolean(correction),
          suspendedUserId: suspendUserId ?? undefined,
        },
        "support escalation updated",
      );

      res.json({
        ticket: toSafeTicket(result.updatedTicket),
        ...(result.correctedBooking
          ? {
              booking: {
                id: result.correctedBooking.id,
                status: result.correctedBooking.status,
                cancellationCategory: result.correctedBooking.cancellationCategory,
              },
            }
          : {}),
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
