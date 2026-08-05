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

const router = Router();

// ── POST /reviews — submit review (client only, completed booking) ─────────────

router.post(
  "/",
  requireAuth,
  requireRole("client"),
  async (req: Request, res: Response): Promise<void> => {
    const { bookingId, rating, comment } = req.body as Record<string, unknown>;

    if (!bookingId || rating === undefined) {
      res.status(400).json({ error: "bookingId and rating are required." });
      return;
    }

    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      res.status(400).json({ error: "rating must be an integer between 1 and 5." });
      return;
    }

    // Verify booking exists, is completed, and belongs to this client
    const bookingRows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, Number(bookingId)))
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

    // Check for duplicate review
    const existing = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(eq(reviewsTable.bookingId, Number(bookingId)))
      .limit(1);

    if (existing[0]) {
      res.status(409).json({ error: "A review for this booking already exists." });
      return;
    }

    const [review] = await db
      .insert(reviewsTable)
      .values({
        bookingId: Number(bookingId),
        clientId: req.user!.sub,
        providerId: booking.providerId,
        rating: ratingNum,
        comment: comment !== undefined ? String(comment) : null,
      })
      .returning();

    // Update provider's rating and review count
    await db
      .update(providerProfilesTable)
      .set({
        reviewCount: sql`${providerProfilesTable.reviewCount} + 1`,
        rating: sql`(
          (${providerProfilesTable.rating}::numeric * ${providerProfilesTable.reviewCount}) + ${ratingNum}
        ) / (${providerProfilesTable.reviewCount} + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(providerProfilesTable.id, booking.providerId));

    // Return review with client first name
    const clientRows = await db
      .select({ firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, review.clientId))
      .limit(1);

    res.status(201).json({
      review: { ...review, clientFirstName: clientRows[0]?.firstName ?? "" },
    });
  }
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
