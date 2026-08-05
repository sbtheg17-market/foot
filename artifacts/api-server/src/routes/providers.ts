import { Router, type Request, type Response } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import {
  db,
  providerProfilesTable,
  travelZonesTable,
  availabilityTable,
  servicesTable,
  reviewsTable,
  usersTable,
  invoicesTable,
  verificationDocsTable,
  bookingsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch the provider profile row for the currently authenticated provider. */
async function getOwnProfile(userId: number) {
  const rows = await db
    .select()
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Build the public-facing provider object (joins user name + avatar). */
async function buildProviderPublic(profileId: number) {
  const rows = await db
    .select({
      id: providerProfilesTable.id,
      userId: providerProfilesTable.userId,
      title: providerProfilesTable.title,
      bio: providerProfilesTable.bio,
      city: providerProfilesTable.city,
      serviceAreaNotes: providerProfilesTable.serviceAreaNotes,
      verificationStatus: providerProfilesTable.verificationStatus,
      rating: providerProfilesTable.rating,
      reviewCount: providerProfilesTable.reviewCount,
      profileComplete: providerProfilesTable.profileComplete,
      yearsExperience: providerProfilesTable.yearsExperience,
      acceptsNewClients: providerProfilesTable.acceptsNewClients,
      createdAt: providerProfilesTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(providerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, providerProfilesTable.userId))
    .where(eq(providerProfilesTable.id, profileId))
    .limit(1);
  return rows[0] ?? null;
}

// ── Public: Provider Discovery ────────────────────────────────────────────────

/** GET /providers — Browse providers (public) */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
  const offset = Number(req.query["offset"] ?? 0);
  const city = req.query["city"] as string | undefined;
  const verified = req.query["verified"];
  const category = req.query["category"] as string | undefined;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [];

  if (city) {
    conditions.push(ilike(providerProfilesTable.city, `%${city}%`) as ReturnType<typeof eq>);
  }
  if (verified === "true") {
    conditions.push(
      eq(providerProfilesTable.verificationStatus, "approved")
    );
  }

  // If filtering by category, we need providers who have that service
  let providerIds: number[] | null = null;
  if (category) {
    const serviceRows = await db
      .selectDistinct({ providerId: servicesTable.providerId })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.category, category),
          eq(servicesTable.isActive, true)
        )
      );
    providerIds = serviceRows.map((r) => r.providerId);
    if (providerIds.length === 0) {
      res.json({ providers: [], total: 0, limit, offset });
      return;
    }
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: providerProfilesTable.id,
        userId: providerProfilesTable.userId,
        title: providerProfilesTable.title,
        city: providerProfilesTable.city,
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
        providerIds !== null
          ? and(whereClause, sql`${providerProfilesTable.id} = ANY(${providerIds})`)
          : whereClause
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerProfilesTable)
      .where(whereClause),
  ]);

  res.json({
    providers: rows,
    total: countRows[0]?.count ?? 0,
    limit,
    offset,
  });
});

// ── Provider Portal (own profile) — must come BEFORE /:providerId ─────────────

/** GET /providers/me — Own profile */
router.get(
  "/me",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }
    const full = await buildProviderPublic(profile.id);
    res.json({ provider: full });
  }
);

/** PUT /providers/me — Update own profile */
router.put(
  "/me",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { title, bio, city, serviceAreaNotes, yearsExperience, acceptsNewClients } =
      req.body as Record<string, unknown>;

    const updates: Partial<typeof providerProfilesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (title !== undefined) updates.title = String(title);
    if (bio !== undefined) updates.bio = String(bio);
    if (city !== undefined) updates.city = String(city);
    if (serviceAreaNotes !== undefined) updates.serviceAreaNotes = String(serviceAreaNotes);
    if (yearsExperience !== undefined) updates.yearsExperience = Number(yearsExperience);
    if (acceptsNewClients !== undefined) updates.acceptsNewClients = Boolean(acceptsNewClients);

    // Mark profile as complete if key fields are filled
    const merged = { ...profile, ...updates };
    updates.profileComplete =
      !!merged.title && !!merged.city && !!merged.bio;

    await db
      .update(providerProfilesTable)
      .set(updates)
      .where(eq(providerProfilesTable.id, profile.id));

    const full = await buildProviderPublic(profile.id);
    res.json({ provider: full });
  }
);

/** GET /providers/me/services — List own services */
router.get(
  "/me/services",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const services = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.providerId, profile.id));

    res.json({ services });
  }
);

/** POST /providers/me/services — Add a service */
router.post(
  "/me/services",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { title, description, durationMinutes, priceCents, category, eligibilityNotes, isActive } =
      req.body as Record<string, unknown>;

    if (!title || !durationMinutes || priceCents === undefined) {
      res.status(400).json({ error: "title, durationMinutes, and priceCents are required." });
      return;
    }

    const [service] = await db
      .insert(servicesTable)
      .values({
        providerId: profile.id,
        title: String(title),
        description: description !== undefined ? String(description) : null,
        durationMinutes: Number(durationMinutes),
        priceCents: Number(priceCents),
        category: category !== undefined ? String(category) : "foot_care",
        eligibilityNotes: eligibilityNotes !== undefined ? String(eligibilityNotes) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning();

    res.status(201).json({ service });
  }
);

/** PUT /providers/me/services/:serviceId — Update a service */
router.put(
  "/me/services/:serviceId",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const serviceId = Number(req.params["serviceId"]);
    const existing = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.providerId, profile.id)))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Service not found." });
      return;
    }

    const { title, description, durationMinutes, priceCents, category, eligibilityNotes, isActive } =
      req.body as Record<string, unknown>;

    const updates: Partial<typeof servicesTable.$inferInsert> = {};
    if (title !== undefined) updates.title = String(title);
    if (description !== undefined) updates.description = String(description);
    if (durationMinutes !== undefined) updates.durationMinutes = Number(durationMinutes);
    if (priceCents !== undefined) updates.priceCents = Number(priceCents);
    if (category !== undefined) updates.category = String(category);
    if (eligibilityNotes !== undefined) updates.eligibilityNotes = String(eligibilityNotes);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const [service] = await db
      .update(servicesTable)
      .set(updates)
      .where(eq(servicesTable.id, serviceId))
      .returning();

    res.json({ service });
  }
);

/** DELETE /providers/me/services/:serviceId — Deactivate a service */
router.delete(
  "/me/services/:serviceId",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const serviceId = Number(req.params["serviceId"]);
    const existing = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.providerId, profile.id)))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Service not found." });
      return;
    }

    await db
      .update(servicesTable)
      .set({ isActive: false })
      .where(eq(servicesTable.id, serviceId));

    res.json({ message: "Service deactivated." });
  }
);

/** GET /providers/me/availability — Get own availability */
router.get(
  "/me/availability",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const slots = await db
      .select()
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, profile.id))
      .orderBy(availabilityTable.dayOfWeek, availabilityTable.startTime);

    res.json({ slots });
  }
);

/** PUT /providers/me/availability — Replace own availability schedule */
router.put(
  "/me/availability",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { slots } = req.body as {
      slots?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    };

    if (!Array.isArray(slots)) {
      res.status(400).json({ error: "slots must be an array." });
      return;
    }

    // Replace all slots atomically
    await db
      .delete(availabilityTable)
      .where(eq(availabilityTable.providerId, profile.id));

    let inserted: typeof availabilityTable.$inferSelect[] = [];
    if (slots.length > 0) {
      inserted = await db
        .insert(availabilityTable)
        .values(
          slots.map((s) => ({
            providerId: profile.id,
            dayOfWeek: Number(s.dayOfWeek),
            startTime: s.startTime,
            endTime: s.endTime,
          }))
        )
        .returning();
    }

    res.json({ slots: inserted });
  }
);

/** GET /providers/me/travel-zones — List own travel zones */
router.get(
  "/me/travel-zones",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const zones = await db
      .select()
      .from(travelZonesTable)
      .where(eq(travelZonesTable.providerId, profile.id));

    res.json({ zones });
  }
);

/** POST /providers/me/travel-zones — Add a travel zone */
router.post(
  "/me/travel-zones",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { zoneName, city, notes } = req.body as Record<string, unknown>;

    if (!zoneName || !city) {
      res.status(400).json({ error: "zoneName and city are required." });
      return;
    }

    const [zone] = await db
      .insert(travelZonesTable)
      .values({
        providerId: profile.id,
        zoneName: String(zoneName),
        city: String(city),
        notes: notes !== undefined ? String(notes) : null,
      })
      .returning();

    res.status(201).json({ zone });
  }
);

/** DELETE /providers/me/travel-zones/:zoneId — Remove a travel zone */
router.delete(
  "/me/travel-zones/:zoneId",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const zoneId = Number(req.params["zoneId"]);
    const existing = await db
      .select()
      .from(travelZonesTable)
      .where(
        and(eq(travelZonesTable.id, zoneId), eq(travelZonesTable.providerId, profile.id))
      )
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Travel zone not found." });
      return;
    }

    await db.delete(travelZonesTable).where(eq(travelZonesTable.id, zoneId));
    res.json({ message: "Travel zone removed." });
  }
);

/** GET /providers/me/earnings — Earnings summary (placeholder until Stripe Connect) */
router.get(
  "/me/earnings",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    // Sum invoice amounts for completed bookings belonging to this provider
    const result = await db
      .select({ totalCents: sql<number>`coalesce(sum(${invoicesTable.amountCents}), 0)::int` })
      .from(invoicesTable)
      .where(eq(invoicesTable.providerId, profile.id));

    const totalCents = result[0]?.totalCents ?? 0;
    const completedBookings = profile.reviewCount; // approximation until booking count query added

    res.json({
      totalCents,
      completedBookings,
      pendingPayoutCents: 0, // Stripe Connect not yet active
    });
  }
);

/** GET /providers/me/earnings/export — Read-only statement data (completed bookings only) */
router.get(
  "/me/earnings/export",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const [providerRows, items] = await Promise.all([
      db
        .select({
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        })
        .from(usersTable)
        .where(eq(usersTable.id, profile.userId))
        .limit(1),
      db
        .select({
          bookingId: bookingsTable.id,
          scheduledAt: bookingsTable.scheduledAt,
          clientFirstName: usersTable.firstName,
          clientLastName: usersTable.lastName,
          serviceTitle: servicesTable.title,
          amountCents: servicesTable.priceCents,
        })
        .from(bookingsTable)
        .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
        .innerJoin(usersTable, eq(usersTable.id, bookingsTable.clientId))
        .where(
          and(
            eq(bookingsTable.providerId, profile.id),
            eq(bookingsTable.status, "completed")
          )
        )
        .orderBy(sql`${bookingsTable.scheduledAt} desc`),
    ]);

    res.json({
      provider: {
        firstName: providerRows[0]?.firstName ?? "",
        lastName: providerRows[0]?.lastName ?? "",
        title: profile.title,
        city: profile.city,
      },
      generatedAt: new Date().toISOString(),
      totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
      count: items.length,
      items,
    });
  }
);

// ── Public: Provider by ID ────────────────────────────────────────────────────

/** GET /providers/:providerId — Public provider profile */
router.get(
  "/:providerId",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);
    const provider = await buildProviderPublic(providerId);

    if (!provider) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    res.json({ provider });
  }
);

/** GET /providers/:providerId/services — Provider's active services (public) */
router.get(
  "/:providerId/services",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);

    // Verify provider exists
    const profile = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const services = await db
      .select()
      .from(servicesTable)
      .where(
        and(eq(servicesTable.providerId, providerId), eq(servicesTable.isActive, true))
      );

    res.json({ services });
  }
);

// ── Verification / Credentials ────────────────────────────────────────────────

/** GET /providers/me/verification — Own docs + overall status */
router.get(
  "/me/verification",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const docs = await db
      .select()
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.providerId, profile.id))
      .orderBy(sql`${verificationDocsTable.submittedAt} desc`);

    res.json({
      verificationStatus: profile.verificationStatus,
      docs,
    });
  }
);

/** POST /providers/me/verification — Submit a credential document */
router.post(
  "/me/verification",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { docType, fileName, notes } = req.body as {
      docType?: string;
      fileName?: string;
      notes?: string;
    };

    const ALLOWED_DOC_TYPES = ["license", "insurance", "certification", "other"];
    if (!docType || !ALLOWED_DOC_TYPES.includes(docType)) {
      res.status(400).json({ error: `docType must be one of: ${ALLOWED_DOC_TYPES.join(", ")}.` });
      return;
    }
    if (!fileName || fileName.trim().length < 3) {
      res.status(400).json({ error: "fileName (document URL or reference) is required." });
      return;
    }

    // If provider was in "pending" state with no submissions, bump to under_review
    const [inserted] = await db
      .insert(verificationDocsTable)
      .values({
        providerId: profile.id,
        docType,
        fileName: fileName.trim(),
        reviewerNotes: notes?.trim() ?? null,
        status: "pending",
      })
      .returning();

    // Auto-advance provider's overall status to under_review when they submit their first doc
    if (profile.verificationStatus === "pending") {
      await db
        .update(providerProfilesTable)
        .set({ verificationStatus: "under_review", updatedAt: new Date() })
        .where(eq(providerProfilesTable.id, profile.id));
    }

    res.status(201).json({ doc: inserted });
  }
);

/** GET /providers/:providerId/reviews — Provider's visible reviews (public) */
router.get(
  "/:providerId/reviews",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);
    const limit = Math.min(Number(req.query["limit"] ?? 20), 50);
    const offset = Number(req.query["offset"] ?? 0);

    // Verify provider exists
    const profile = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const [reviews, countRows] = await Promise.all([
      db
        .select({
          id: reviewsTable.id,
          bookingId: reviewsTable.bookingId,
          clientId: reviewsTable.clientId,
          providerId: reviewsTable.providerId,
          rating: reviewsTable.rating,
          comment: reviewsTable.comment,
          createdAt: reviewsTable.createdAt,
          clientFirstName: usersTable.firstName,
        })
        .from(reviewsTable)
        .innerJoin(usersTable, eq(usersTable.id, reviewsTable.clientId))
        .where(
          and(eq(reviewsTable.providerId, providerId), eq(reviewsTable.isVisible, true))
        )
        .orderBy(sql`${reviewsTable.createdAt} desc`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewsTable)
        .where(
          and(eq(reviewsTable.providerId, providerId), eq(reviewsTable.isVisible, true))
        ),
    ]);

    res.json({
      reviews,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  }
);

export default router;
