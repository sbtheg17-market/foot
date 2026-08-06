import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  reviewsTable,
  bookingsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { sql } from "drizzle-orm";
import { CreateReviewBody } from "@workspace/api-zod";

const router = Router();

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
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
    candidate.code === "23505" ||
    text.includes("duplicate key") ||
    text.includes("reviews_booking_id_unique") ||
    isUniqueViolation(candidate.cause) ||
    isUniqueViolation(candidate.originalError)
  );
}

// ── POST /reviews — submit review (client only, completed booking) ─────────────

router.post(
  "/",
  requireAuth,
  requireRole("client"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "bookingId and rating are required and must be valid." });
      return;
    }

    const { bookingId, rating: ratingNum, comment } = parsed.data;
    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
      res.status(400).json({ error: "bookingId must be a positive integer." });
      return;
    }
    const normalizedComment = comment?.trim() ?? null;
    if (normalizedComment && normalizedComment.length > 1000) {
      res.status(400).json({ error: "comment must be 1000 characters or fewer." });
      return;
    }

    const bookingRows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    const booking = bookingRows[0];
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    if (booking.clientId !== req.user!.sub) {
      res.status(403).json({ error: "You can only review your own bookings." });
      return;
    }
    if (booking.status !== "completed") {
      res.status(400).json({ error: "Reviews can only be submitted for completed bookings." });
      return;
    }

    // Fast-path duplicate check; the unique booking_id constraint below is the
    // authoritative guard for concurrent submissions.
    const existing = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(eq(reviewsTable.bookingId, bookingId))
      .limit(1);

    if (existing[0]) {
      res.status(409).json({ error: "A review for this booking already exists." });
      return;
    }

    let review: typeof reviewsTable.$inferSelect;
    try {
      review = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(reviewsTable)
          .values({
            bookingId,
            clientId: req.user!.sub,
            providerId: booking.providerId,
            rating: ratingNum,
            comment: normalizedComment,
          })
          .returning();

        if (!created) {
          throw new Error("Review was not created.");
        }

        // This expression is atomic for concurrent reviews on the same
        // provider, while the review insert remains guarded by booking_id.
        await tx
          .update(providerProfilesTable)
          .set({
            reviewCount: sql`${providerProfilesTable.reviewCount} + 1`,
            rating: sql`(
              (${providerProfilesTable.rating}::numeric * ${providerProfilesTable.reviewCount}) + ${ratingNum}
            ) / (${providerProfilesTable.reviewCount} + 1)`,
            updatedAt: new Date(),
          })
          .where(eq(providerProfilesTable.id, booking.providerId));

        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "A review for this booking already exists." });
        return;
      }
      throw error;
    }

    // Return review with client first name
    const clientRows = await db
      .select({ firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, review.clientId))
      .limit(1);

    res.status(201).json({ review: { ...review, clientFirstName: clientRows[0]?.firstName ?? "" } });
  }
);

// ── GET /reviews/booking/:bookingId — client-owned review lookup ───────────────

router.get(
  "/booking/:bookingId",
  requireAuth,
  requireRole("client"),
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = Number(req.params["bookingId"]);
    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
      res.status(404).json({ error: "Review not found." });
      return;
    }

    const rows = await db
      .select({
        id: reviewsTable.id,
        bookingId: reviewsTable.bookingId,
        clientId: reviewsTable.clientId,
        providerId: reviewsTable.providerId,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        isVisible: reviewsTable.isVisible,
        createdAt: reviewsTable.createdAt,
        clientFirstName: usersTable.firstName,
      })
      .from(reviewsTable)
      .innerJoin(usersTable, eq(usersTable.id, reviewsTable.clientId))
      .innerJoin(bookingsTable, eq(bookingsTable.id, reviewsTable.bookingId))
      .where(
        and(
          eq(reviewsTable.bookingId, bookingId),
          eq(bookingsTable.clientId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Review not found." });
      return;
    }

    res.json({ review: rows[0] });
  },
);

// ── GET /reviews/:reviewId — detail ───────────────────────────────────────────

router.get(
  "/:reviewId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const reviewId = Number(req.params["reviewId"]);

    const rows = await db
      .select({
        id: reviewsTable.id,
        bookingId: reviewsTable.bookingId,
        clientId: reviewsTable.clientId,
        providerId: reviewsTable.providerId,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        isVisible: reviewsTable.isVisible,
        createdAt: reviewsTable.createdAt,
        clientFirstName: usersTable.firstName,
      })
      .from(reviewsTable)
      .innerJoin(usersTable, eq(usersTable.id, reviewsTable.clientId))
      .where(eq(reviewsTable.id, reviewId))
      .limit(1);

    const review = rows[0];
    if (!review) {
      res.status(404).json({ error: "Review not found." });
      return;
    }

    // Only visible reviews are public; admins can see hidden ones
    if (!review.isVisible && user.role !== "admin") {
      // Check if requester is the client or the provider
      const isOwner = review.clientId === user.sub;
      if (!isOwner) {
        res.status(404).json({ error: "Review not found." });
        return;
      }
    }

    res.json({ review });
  }
);

export default router;
