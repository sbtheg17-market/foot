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
import { getCancellationPolicySummary } from "../lib/cancellation-policy.js";
import {
  SERVICE_AREA_MESSAGES,
  evaluateServiceAreaEligibility,
  isCoverageConfigured,
  loadProviderCoverage,
} from "../lib/service-area.js";

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

  const [services, windows, coverage] = await Promise.all([
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
    loadProviderCoverage(db, provider.id),
  ]);

  res.json({
    page: {
      slug,
      provider,
      services,
      availability: { timezone, windows },
      // Public service-area summary (roadmap #12) — safe fields ONLY. Raw
      // coverage entries (FSA prefixes) are NEVER exposed publicly; clients
      // check eligibility via POST /booking-pages/:slug/service-area-check.
      serviceArea: {
        configured: isCoverageConfigured(coverage),
        description: coverage.config?.publicDescription ?? null,
        countryCode: coverage.config?.countryCode ?? null,
        provinceCode: coverage.config?.provinceCode ?? null,
        city: coverage.config?.city ?? null,
      },
      // Public cancellation policy summary (roadmap #13) — safe fields ONLY:
      // the notice window and approved plain-language copy. Internal state
      // identifiers, categories, and history are never exposed publicly.
      cancellationPolicy: getCancellationPolicySummary(),
    },
  });
});

/**
 * POST /booking-pages/:slug/service-area-check — public eligibility check
 * for the provider-owned booking page (roadmap #12).
 *
 * Server-authoritative and non-leaking: missing, unpublished, unapproved,
 * and format-invalid slugs return the SAME generic 404 as the page itself.
 * The response contains ONLY a safe eligibility state, the approved public
 * message, and an allowlisted reason code — never coverage entries, never
 * provider-private data. Client location input is validated minimally and
 * NOT retained.
 */
router.post(
  "/:slug/service-area-check",
  async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params["slug"] ?? "");
    if (!isValidBookingPageSlug(slug)) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }

    const [provider] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(
        and(
          eq(providerProfilesTable.publicSlug, slug),
          eq(providerProfilesTable.bookingPagePublished, true),
          eq(providerProfilesTable.verificationStatus, "approved"),
        ),
      )
      .limit(1);

    if (!provider) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const coverage = await loadProviderCoverage(db, provider.id);
    const result = evaluateServiceAreaEligibility(coverage, {
      country: body["country"],
      province: body["province"],
      city: body["city"],
      postalCode: body["postalCode"],
    });

    res.json({
      eligibility: {
        status: result.status,
        reason: result.reason,
        message: SERVICE_AREA_MESSAGES[result.status],
      },
    });
  },
);

export default router;
