/**
 * Public provider booking pages (roadmap #11) — GET /booking-pages/:slug.
 *
 * One canonical, provider-owned public booking surface per provider at
 * /book/:slug (web route). This endpoint derives EVERYTHING from the same
 * source-of-truth tables used by marketplace discovery and booking — no
 * duplicated profile, service, availability, or booking logic.
 *
 * Non-leaking fallback: missing, unpublished, unapproved, and format-invalid
 * slugs all return the SAME generic 404 body, so page existence and provider
 * state are never enumerable. No user/account ids, email, phone, care notes,
 * verification documents, or internal state are ever exposed.
 */
import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  providerProfilesTable,
  servicesTable,
  availabilityTable,
  usersTable,
} from "@workspace/db";
import { getMarketplaceTimezone } from "../lib/availability.js";
import { isValidBookingPageSlug } from "../lib/booking-page.js";

const router = Router();

const NOT_FOUND_BODY = { error: "Booking page not found." } as const;

router.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");

  // Format validation happens before any database work; invalid input gets
  // the same non-leaking 404 as a missing page.
  if (!isValidBookingPageSlug(slug)) {
    res.status(404).json(NOT_FOUND_BODY);
    return;
  }

  // Public-safe allow-list projection. providerProfiles.id is the same public
  // identifier already used by marketplace discovery; userId is NOT included.
  const rows = await db
    .select({
      id: providerProfilesTable.id,
      title: providerProfilesTable.title,
      bio: providerProfilesTable.bio,
      city: providerProfilesTable.city,
      serviceAreaNotes: providerProfilesTable.serviceAreaNotes,
      verificationStatus: providerProfilesTable.verificationStatus,
      rating: providerProfilesTable.rating,
      reviewCount: providerProfilesTable.reviewCount,
      yearsExperience: providerProfilesTable.yearsExperience,
      acceptsNewClients: providerProfilesTable.acceptsNewClients,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(providerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, providerProfilesTable.userId))
    .where(
      and(
        eq(providerProfilesTable.publicSlug, slug),
        eq(providerProfilesTable.bookingPagePublished, true),
        // Inactive/unapproved providers are indistinguishable from missing.
        eq(providerProfilesTable.verificationStatus, "approved"),
      ),
    )
    .limit(1);

  const provider = rows[0];
  if (!provider) {
    res.status(404).json(NOT_FOUND_BODY);
    return;
  }

  const timezone = getMarketplaceTimezone();

  const [services, windows] = await Promise.all([
    db
      .select({
        id: servicesTable.id,
        title: servicesTable.title,
        description: servicesTable.description,
        durationMinutes: servicesTable.durationMinutes,
        priceCents: servicesTable.priceCents,
        category: servicesTable.category,
        eligibilityNotes: servicesTable.eligibilityNotes,
      })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.providerId, provider.id),
          eq(servicesTable.isActive, true),
        ),
      )
      .orderBy(servicesTable.id),
    db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, provider.id))
      .orderBy(availabilityTable.dayOfWeek, availabilityTable.startTime),
  ]);

  res.json({
    page: {
      slug,
      provider,
      services,
      availability: { timezone, windows },
    },
  });
});

export default router;
