import { Router, type Request, type Response } from "express";
import { eq, ilike, and, or, lt, lte, gte, desc, sql, isNull, inArray } from "drizzle-orm";
import {
  db,
  providerProfilesTable,
  providerApplicationsTable,
  providerApplicationSubmissionsTable,
  providerApplicationEventsTable,
  providerNotificationsTable,
  accountRolesTable,
  travelZonesTable,
  providerServiceAreasTable,
  providerCoverageAreasTable,
  availabilityTable,
  providerEmergencyOpeningsTable,
  providerBlockedRangesTable,
  servicesTable,
  reviewsTable,
  usersTable,
  invoicesTable,
  verificationDocsTable,
  bookingsTable,
} from "@workspace/db";
import {
  requireApprovedProvider,
  requireAuth,
  requireRole,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { isSchemaDriftError } from "../lib/schema-drift.js";
import { createApplicationNotification } from "../lib/application-notifications.js";
import {
  computeReadiness,
  loadReadinessSourceByUserId,
} from "../lib/provider-readiness.js";
import { emitProviderActivationEvents } from "../lib/marketplace-events.js";
import {
  getMarketplaceTimezone,
  generateSlotsForDate,
  generateEffectiveSlotsForDate,
  localDateOfInstant,
  localTimeLabel,
  type AvailabilityWindow,
} from "../lib/availability.js";
import {
  loadBlockedRanges,
  loadEmergencyOpenings,
} from "../lib/availability-exceptions.js";
import { slugifyDisplayName, slugCandidate } from "../lib/booking-page.js";
import {
  SERVICE_AREA_MESSAGES,
  SUPPORTED_COUNTRY_CODES,
  evaluateServiceAreaEligibility,
  getTravelSetupBufferMinutes,
  getTravelSetupBufferSource,
  isCoverageConfigured,
  loadProviderCoverage,
  normalizeCountryCode,
  normalizeFsaPrefix,
  normalizeProvinceCode,
} from "../lib/service-area.js";

const router = Router();

const requireProviderOperation = [
  requireAuth,
  requireRole("provider"),
  requireApprovedProvider,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signup-era provider_profiles columns — the stable set every owner-scoped
 * provider route depends on. The Gate B-pending booking-page columns
 * (public_slug, booking_page_published, booking_page_published_at —
 * docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql) are attempted
 * eagerly below and degrade to the truthful pre-#11 state (no slug,
 * unpublished) only on a drifted database, so no owner route 500s on drift.
 */
const ownProfileStableSelection = {
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
  updatedAt: providerProfilesTable.updatedAt,
};

/** Fetch the provider profile row for the currently authenticated provider. */
async function getOwnProfile(
  userId: number,
): Promise<typeof providerProfilesTable.$inferSelect | null> {
  try {
    const rows = await db
      .select()
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // Truthful degraded read: on a database without the booking-page columns
    // nothing can be published — the migrated columns' backfill-free default.
    logger.warn(
      { userId },
      "getOwnProfile degraded: Gate B-pending booking-page columns missing; reporting unpublished",
    );
    const rows = await db
      .select(ownProfileStableSelection)
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      publicSlug: null,
      bookingPagePublished: false,
      bookingPagePublishedAt: null,
    };
  }
}

type PreviousSubmissionRow = {
  id: number;
  outcome: "rejected";
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
};

type ApplicationRow = {
  id: number;
  userId: number;
  providerProfileId: number;
  status: "draft" | "under_review" | "approved" | "rejected" | "suspended";
  currentStep: "profile" | "services" | "availability" | "verification" | "submitted";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  profile: {
    id: number;
    title: string;
    bio: string | null;
    city: string;
    serviceAreaNotes: string | null;
    yearsExperience: number | null;
    profileComplete: boolean;
    verificationStatus: "pending" | "under_review" | "approved" | "rejected";
  };
  previousSubmissions: PreviousSubmissionRow[];
};

/**
 * Signup-era columns only — the stable set every owner status read depends
 * on. The Gate B-pending additive column provider_applications.rejection_reason
 * (docs/migrations/PROVIDER_APPLICATION_REJECTION_REASON_V1.sql) is selected
 * eagerly in getOwnApplication but degrades to null on a database without it,
 * mirroring the raw-SQL column discipline of the signup write path
 * (routes/auth.ts) so a provider's first return can never 500 on drift.
 */
const applicationStableSelection = {
  id: providerApplicationsTable.id,
  userId: providerApplicationsTable.userId,
  providerProfileId: providerApplicationsTable.providerProfileId,
  status: providerApplicationsTable.status,
  currentStep: providerApplicationsTable.currentStep,
  submittedAt: providerApplicationsTable.submittedAt,
  reviewedAt: providerApplicationsTable.reviewedAt,
  profile: {
    id: providerProfilesTable.id,
    title: providerProfilesTable.title,
    bio: providerProfilesTable.bio,
    city: providerProfilesTable.city,
    serviceAreaNotes: providerProfilesTable.serviceAreaNotes,
    yearsExperience: providerProfilesTable.yearsExperience,
    profileComplete: providerProfilesTable.profileComplete,
    verificationStatus: providerProfilesTable.verificationStatus,
  },
};

async function getOwnApplication(userId: number): Promise<ApplicationRow | null> {
  let application: Omit<ApplicationRow, "previousSubmissions"> | null;
  try {
    const rows = await db
      .select({
        ...applicationStableSelection,
        rejectionReason: providerApplicationsTable.rejectionReason,
      })
      .from(providerApplicationsTable)
      .innerJoin(
        providerProfilesTable,
        eq(providerProfilesTable.id, providerApplicationsTable.providerProfileId),
      )
      .where(eq(providerApplicationsTable.userId, userId))
      .limit(1);
    application = rows[0] ?? null;
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // Truthful degraded read: NULL means "no rejection recorded" — identical
    // to the migrated column's backfill-free default. Never fabricates state.
    logger.warn(
      { userId },
      "getOwnApplication degraded: Gate B-pending rejection_reason column missing; rejectionReason defaulted to null",
    );
    const rows = await db
      .select(applicationStableSelection)
      .from(providerApplicationsTable)
      .innerJoin(
        providerProfilesTable,
        eq(providerProfilesTable.id, providerApplicationsTable.providerProfileId),
      )
      .where(eq(providerApplicationsTable.userId, userId))
      .limit(1);
    application = rows[0] ? { ...rows[0], rejectionReason: null } : null;
  }

  if (!application) return null;

  // Owner-visible submission history: only public fields, never reviewerNotes.
  let previousSubmissions: PreviousSubmissionRow[];
  try {
    previousSubmissions = await db
      .select({
        id: providerApplicationSubmissionsTable.id,
        outcome: providerApplicationSubmissionsTable.outcome,
        submittedAt: providerApplicationSubmissionsTable.submittedAt,
        reviewedAt: providerApplicationSubmissionsTable.reviewedAt,
        rejectionReason: providerApplicationSubmissionsTable.rejectionReason,
        createdAt: providerApplicationSubmissionsTable.createdAt,
      })
      .from(providerApplicationSubmissionsTable)
      .where(
        eq(providerApplicationSubmissionsTable.providerApplicationId, application.id),
      )
      .orderBy(providerApplicationSubmissionsTable.createdAt);
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // An absent relation can hold no rows — empty history is the truth.
    logger.warn(
      { userId },
      "getOwnApplication degraded: submission-history relation missing; history defaulted to empty",
    );
    previousSubmissions = [];
  }

  return { ...application, previousSubmissions };
}

function applicationResponse(application: ApplicationRow) {
  return {
    application: {
      id: application.id,
      status: application.status,
      currentStep: application.currentStep,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      providerProfileId: application.providerProfileId,
      profile: application.profile,
      rejectionReason: application.rejectionReason,
      previousSubmissions: application.previousSubmissions,
    },
  };
}

function assertProviderMember(req: Request, res: Response): boolean {
  if (!req.authz?.roles.includes("provider")) {
    res.status(403).json({ error: "Provider onboarding access is required." });
    return false;
  }
  return true;
}

// ── Provider onboarding/application ──────────────────────────────────────────

router.get(
  "/application",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    res.json(applicationResponse(application));
  },
);

router.post(
  "/application",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const authz = req.authz!;
    if (!authz.roles.includes("client") && !authz.roles.includes("provider")) {
      res.status(403).json({ error: "Only client accounts can start provider onboarding." });
      return;
    }

    const existing = await getOwnApplication(req.user!.sub);
    if (existing) {
      res.status(200).json(applicationResponse(existing));
      return;
    }

    const created = await db.transaction(async (tx) => {
      await tx
        .insert(accountRolesTable)
        .values({ userId: req.user!.sub, role: "provider" })
        .onConflictDoNothing({
          target: [accountRolesTable.userId, accountRolesTable.role],
        });

      const [profile] = await tx
        .insert(providerProfilesTable)
        .values({ userId: req.user!.sub })
        .onConflictDoNothing({ target: providerProfilesTable.userId })
        .returning({ id: providerProfilesTable.id });

      let providerProfileId = profile?.id;
      if (!providerProfileId) {
        const [existingProfile] = await tx
          .select({ id: providerProfilesTable.id })
          .from(providerProfilesTable)
          .where(eq(providerProfilesTable.userId, req.user!.sub))
          .limit(1);
        providerProfileId = existingProfile?.id;
      }

      if (!providerProfileId) throw new Error("Provider profile could not be created.");

      const [application] = await tx
        .insert(providerApplicationsTable)
        .values({ userId: req.user!.sub, providerProfileId })
        .onConflictDoNothing({ target: providerApplicationsTable.userId })
        .returning({ id: providerApplicationsTable.id });

      return Boolean(application);
    });

    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(500).json({ error: "Provider application could not be created." });
      return;
    }
    res.status(created ? 201 : 200).json(applicationResponse(application));
  },
);

router.patch(
  "/application",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status === "rejected") {
      res.status(409).json({
        error: "Reset the rejected application to draft before editing.",
      });
      return;
    }
    if (application.status !== "draft") {
      res.status(409).json({ error: "This application is no longer editable." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const updates: Partial<typeof providerProfilesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    const stringFields = ["title", "bio", "city", "serviceAreaNotes"] as const;
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        const value = String(body[field]).trim();
        if (field === "title" && (value.length < 1 || value.length > 120)) {
          res.status(400).json({ error: "title must be between 1 and 120 characters." });
          return;
        }
        if (field === "bio" && value.length > 2000) {
          res.status(400).json({ error: "bio must be 2,000 characters or fewer." });
          return;
        }
        if (field === "city" && (value.length < 1 || value.length > 120)) {
          res.status(400).json({ error: "city must be between 1 and 120 characters." });
          return;
        }
        if (field === "serviceAreaNotes" && value.length > 2000) {
          res.status(400).json({ error: "serviceAreaNotes must be 2,000 characters or fewer." });
          return;
        }
        updates[field] = value;
      }
    }
    if (body.yearsExperience !== undefined) {
      const years = Number(body.yearsExperience);
      if (!Number.isInteger(years) || years < 0 || years > 80) {
        res.status(400).json({ error: "yearsExperience must be an integer from 0 to 80." });
        return;
      }
      updates.yearsExperience = years;
    }

    const merged = { ...application.profile, ...updates };
    updates.profileComplete = Boolean(merged.title && merged.bio && merged.city);

    await db.transaction(async (tx) => {
      await tx
        .update(providerProfilesTable)
        .set(updates)
        .where(
          and(
            eq(providerProfilesTable.id, application.providerProfileId),
            eq(providerProfilesTable.userId, req.user!.sub),
          ),
        );
      await tx
        .update(providerApplicationsTable)
        .set({
          currentStep:
            body.currentStep === "services" ||
            body.currentStep === "availability" ||
            body.currentStep === "verification"
              ? body.currentStep
              : "profile",
          updatedAt: new Date(),
        })
        .where(eq(providerApplicationsTable.id, application.id));
      // Phase 3: profile fields changed — funnel milestone + flip check in
      // the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: application.providerProfileId,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkProfileCompleted: true },
      });
    });

    const updated = await getOwnApplication(req.user!.sub);
    if (!updated) {
      res.status(500).json({ error: "Provider application could not be loaded." });
      return;
    }
    res.json(applicationResponse(updated));
  },
);

router.post(
  "/application/submit",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status === "under_review" || application.status === "approved") {
      res.status(200).json(applicationResponse(application));
      return;
    }
    if (application.status === "rejected") {
      res.status(409).json({
        error: "Reset the rejected application to draft before resubmitting.",
      });
      return;
    }
    if (application.status === "suspended") {
      res.status(409).json({ error: "Suspended applications cannot be submitted." });
      return;
    }
    // Validate all required sections are complete (server-derived, not client-trusted)
    const completion = await computeCompletion(application);
    if (!completion.readyForSubmission) {
      res.status(400).json({
        error: "Your application is not ready for submission.",
        missingRequirements: completion.missingRequirements,
      });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(providerApplicationsTable)
        .set({
          status: "under_review",
          currentStep: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerApplicationsTable.id, application.id),
            eq(providerApplicationsTable.userId, req.user!.sub),
          ),
        );
      await tx
        .update(providerProfilesTable)
        .set({ verificationStatus: "under_review", updatedAt: new Date() })
        .where(
          and(
            eq(providerProfilesTable.id, application.providerProfileId),
            eq(providerProfilesTable.userId, req.user!.sub),
          ),
        );
      // Lifecycle event (MC8): draft → under_review. Same transaction, so the
      // event is recorded iff the transition commits. Reachable only from
      // `draft` (other statuses early-return above), so exactly one per submit.
      const [event] = await tx
        .insert(providerApplicationEventsTable)
        .values({
          providerApplicationId: application.id,
          userId: req.user!.sub,
          type: "submitted",
          fromStatus: "draft",
          toStatus: "under_review",
        })
        .returning({ id: providerApplicationEventsTable.id });
      await createApplicationNotification(tx, req.user!.sub, event!.id, "submitted");
    });

    const submitted = await getOwnApplication(req.user!.sub);
    if (!submitted) {
      res.status(500).json({ error: "Provider application could not be loaded." });
      return;
    }
    res.json(applicationResponse(submitted));
  },
);

// ── Rejected → draft resubmission reset ─────────────────────────────────────
//
// Owner-only. Idempotent when the application is already `draft`.
// On `rejected`, snapshots the closed cycle into the immutable
// `provider_application_submissions` history table, then clears rejection
// fields on the main row. Never touches provider-operations authorization.

router.post(
  "/application/reset",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    const outcome = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: providerApplicationsTable.id,
          userId: providerApplicationsTable.userId,
          status: providerApplicationsTable.status,
          submittedAt: providerApplicationsTable.submittedAt,
          reviewedAt: providerApplicationsTable.reviewedAt,
          reviewedBy: providerApplicationsTable.reviewedBy,
          reviewerNotes: providerApplicationsTable.reviewerNotes,
          rejectionReason: providerApplicationsTable.rejectionReason,
        })
        .from(providerApplicationsTable)
        .where(eq(providerApplicationsTable.userId, req.user!.sub))
        .limit(1)
        .for("update");

      const current = rows[0];
      if (!current) return { kind: "not_found" as const };
      if (current.status === "draft") return { kind: "noop" as const };
      if (current.status !== "rejected") {
        return { kind: "conflict" as const, status: current.status };
      }

      // Snapshot the closed rejection cycle. submittedAt must exist because
      // the application only reaches `rejected` after a prior submit set it.
      await tx.insert(providerApplicationSubmissionsTable).values({
        providerApplicationId: current.id,
        outcome: "rejected",
        submittedAt: current.submittedAt ?? new Date(),
        reviewedAt: current.reviewedAt,
        reviewedBy: current.reviewedBy,
        reviewerNotes: current.reviewerNotes,
        rejectionReason: current.rejectionReason,
      });

      await tx
        .update(providerApplicationsTable)
        .set({
          status: "draft",
          currentStep: "profile",
          submittedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          reviewerNotes: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerApplicationsTable.id, current.id),
            eq(providerApplicationsTable.userId, req.user!.sub),
          ),
        );

      // Lifecycle event (MC8): rejected → draft. Same transaction; reached
      // only when current.status === "rejected" (draft is a noop, others
      // conflict above), so exactly one per real reset.
      const [event] = await tx
        .insert(providerApplicationEventsTable)
        .values({
          providerApplicationId: current.id,
          userId: req.user!.sub,
          type: "reset_to_draft",
          fromStatus: "rejected",
          toStatus: "draft",
        })
        .returning({ id: providerApplicationEventsTable.id });
      await createApplicationNotification(
        tx,
        req.user!.sub,
        event!.id,
        "reset_to_draft",
      );

      return { kind: "reset" as const };
    });

    if (outcome.kind === "not_found") {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (outcome.kind === "conflict") {
      res.status(409).json({
        error: `Applications in status "${outcome.status}" cannot be reset to draft.`,
      });
      return;
    }

    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(500).json({ error: "Provider application could not be loaded." });
      return;
    }
    res.json(applicationResponse(application));
  },
);

// ── Application-scoped completion summary ──────────────────────────────────────

/**
 * Computes the server-side completion summary for a provider application.
 * All booleans are derived from the database; client values are never trusted.
 */
async function computeCompletion(application: ApplicationRow) {
  const profileId = application.providerProfileId;

  const [serviceRows, slotRows, docRows] = await Promise.all([
    db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(and(eq(servicesTable.providerId, profileId), eq(servicesTable.isActive, true)))
      .limit(1),
    db
      .select({ id: availabilityTable.id })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, profileId))
      .limit(1),
    db
      .select({ id: verificationDocsTable.id })
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.providerId, profileId))
      .limit(1),
  ]);

  const profileComplete = application.profile.profileComplete;
  const servicesComplete = serviceRows.length > 0;
  const availabilityComplete = slotRows.length > 0;
  const verificationComplete = docRows.length > 0;
  const readyForSubmission =
    profileComplete && servicesComplete && availabilityComplete && verificationComplete;

  const missingRequirements: string[] = [];
  if (!profileComplete) missingRequirements.push("Complete your professional title, bio, and city");
  if (!servicesComplete) missingRequirements.push("Add at least one service");
  if (!availabilityComplete) missingRequirements.push("Add at least one availability slot");
  if (!verificationComplete) missingRequirements.push("Submit at least one verification document");

  return {
    profileComplete,
    servicesComplete,
    availabilityComplete,
    verificationComplete,
    readyForSubmission,
    applicationStatus: application.status,
    missingRequirements,
  };
}

router.get(
  "/application/completion",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    const completion = await computeCompletion(application);
    res.json({ completion });
  },
);

// ── Application status (owner-scoped, read-only) ─────────────────────────────
//
// Compact server-authoritative view of the owner's application: current
// status, current cycle timestamps, provider-visible rejectionReason, closed
// submission summary, and server-derived `nextAction` + capability flags.
// Never returns reviewerNotes (admin-private).

type NextAction =
  | "resume_draft"
  | "wait_for_review"
  | "provider_operations_available"
  | "reset_to_draft"
  | "contact_support";

function deriveNextAction(status: ApplicationRow["status"]): NextAction {
  switch (status) {
    case "draft":
      return "resume_draft";
    case "under_review":
      return "wait_for_review";
    case "approved":
      return "provider_operations_available";
    case "rejected":
      return "reset_to_draft";
    case "suspended":
      return "contact_support";
  }
}

type SubmissionCursor = { createdAt: string; id: number };

/**
 * Owner-scoped status projection shared by GET /application/status and the
 * `summary` field of GET /application/submissions. Single source of truth so
 * both endpoints report identical `submissionCount` / `latestSubmission`.
 * Reviewer-private fields are never included.
 */
function buildStatusView(application: ApplicationRow) {
  const history = application.previousSubmissions;
  const latestSubmission =
    history.length > 0 ? history[history.length - 1] : null;
  return {
    applicationId: application.id,
    status: application.status,
    currentStep: application.currentStep,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    rejectionReason: application.rejectionReason,
    submissionCount: history.length,
    latestSubmission,
    nextAction: deriveNextAction(application.status),
    canEdit: application.status === "draft",
    canReset: application.status === "rejected",
    canResubmit: application.status === "draft",
  };
}

/** Opaque base64 of the keyset position. Encodes position only. */
function encodeSubmissionCursor(row: { createdAt: Date; id: number }): string {
  const payload: SubmissionCursor = {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeSubmissionCursor(raw: string): SubmissionCursor | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { createdAt, id } = parsed as Record<string, unknown>;
  if (
    typeof createdAt !== "string" ||
    typeof id !== "number" ||
    !Number.isInteger(id)
  ) {
    return null;
  }
  if (Number.isNaN(new Date(createdAt).getTime())) return null;
  return { createdAt, id };
}

/**
 * Keyset page of closed submission cycles for one application, newest first.
 * ORDER BY created_at DESC, id DESC; the cursor predicate selects rows strictly
 * after the cursor position. The application id is always supplied by the
 * caller from the authenticated user — never derived from the cursor. Explicit
 * six-column allow-list; reviewerNotes / reviewedBy are never selected.
 */
async function fetchSubmissionPage(
  providerApplicationId: number,
  limit: number,
  cursor: SubmissionCursor | null,
): Promise<PreviousSubmissionRow[]> {
  const ownership = eq(
    providerApplicationSubmissionsTable.providerApplicationId,
    providerApplicationId,
  );
  const cursorDate = cursor ? new Date(cursor.createdAt) : null;
  const where =
    cursor && cursorDate
      ? and(
          ownership,
          or(
            lt(providerApplicationSubmissionsTable.createdAt, cursorDate),
            and(
              eq(providerApplicationSubmissionsTable.createdAt, cursorDate),
              lt(providerApplicationSubmissionsTable.id, cursor.id),
            ),
          ),
        )
      : ownership;

  return db
    .select({
      id: providerApplicationSubmissionsTable.id,
      outcome: providerApplicationSubmissionsTable.outcome,
      submittedAt: providerApplicationSubmissionsTable.submittedAt,
      reviewedAt: providerApplicationSubmissionsTable.reviewedAt,
      rejectionReason: providerApplicationSubmissionsTable.rejectionReason,
      createdAt: providerApplicationSubmissionsTable.createdAt,
    })
    .from(providerApplicationSubmissionsTable)
    .where(where)
    .orderBy(
      desc(providerApplicationSubmissionsTable.createdAt),
      desc(providerApplicationSubmissionsTable.id),
    )
    .limit(limit + 1);
}

router.get(
  "/application/status",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }

    res.json({ status: buildStatusView(application) });
  },
);

// ── Submission history (owner-scoped, keyset-paginated, read-only) ───────────
//
// Newest-first history of closed rejected submission cycles. `summary` is the
// same status projection returned by GET /application/status; `submissions` is
// the keyset page. Honest scope: only closed rejected cycles are recorded here
// (snapshotted at reset); the current open cycle lives in `summary`. This is
// not a complete persisted lifecycle event log.

router.get(
  "/application/submissions",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    // limit: integer 1..50, default 20.
    let limit = 20;
    const rawLimit = req.query["limit"];
    if (rawLimit !== undefined) {
      const asString = String(rawLimit);
      const parsed = Number(asString);
      if (
        !/^\d+$/.test(asString) ||
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > 50
      ) {
        res
          .status(400)
          .json({ error: "limit must be an integer between 1 and 50." });
        return;
      }
      limit = parsed;
    }

    // cursor: opaque position token. Position only — never ownership or scope.
    let cursor: SubmissionCursor | null = null;
    const rawCursor = req.query["cursor"];
    if (rawCursor !== undefined) {
      cursor = decodeSubmissionCursor(String(rawCursor));
      if (!cursor) {
        res.status(400).json({ error: "Invalid pagination cursor." });
        return;
      }
    }

    // provider_application_id is always re-derived from the authenticated user.
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }

    const rows = await fetchSubmissionPage(application.id, limit, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeSubmissionCursor(last) : null;

    res.json({
      summary: buildStatusView(application),
      submissions: page,
      pagination: { limit, hasMore, nextCursor },
    });
  },
);

// ── Application-scoped services (pre-approval) ────────────────────────────────

router.get(
  "/application/services",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    const services = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.providerId, application.providerProfileId));
    res.json({ services });
  },
);

router.post(
  "/application/services",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status !== "draft" && application.status !== "rejected") {
      res.status(409).json({ error: "Services can only be edited on draft or rejected applications." });
      return;
    }

    const { title, description, durationMinutes, priceCents, category, eligibilityNotes } =
      req.body as Record<string, unknown>;

    if (!title || !durationMinutes || priceCents === undefined) {
      res.status(400).json({ error: "title, durationMinutes, and priceCents are required." });
      return;
    }
    const titleStr = String(title).trim();
    if (titleStr.length < 1 || titleStr.length > 200) {
      res.status(400).json({ error: "title must be between 1 and 200 characters." });
      return;
    }
    const dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 15 || dur > 480) {
      res.status(400).json({ error: "durationMinutes must be an integer between 15 and 480." });
      return;
    }
    const price = Number(priceCents);
    if (!Number.isInteger(price) || price < 0) {
      res.status(400).json({ error: "priceCents must be a non-negative integer." });
      return;
    }

    const service = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(servicesTable)
        .values({
          providerId: application.providerProfileId,
          title: titleStr,
          description: description !== undefined ? String(description).trim() : null,
          durationMinutes: dur,
          priceCents: price,
          category: category !== undefined ? String(category) : "foot_care",
          eligibilityNotes: eligibilityNotes !== undefined ? String(eligibilityNotes).trim() : null,
          isActive: true,
        })
        .returning();
      // Phase 3: services changed — funnel milestone + flip check in the
      // same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: application.providerProfileId,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
        serviceId: created!.id,
      });
      return created;
    });

    res.status(201).json({ service });
  },
);

router.patch(
  "/application/services/:serviceId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status !== "draft" && application.status !== "rejected") {
      res.status(409).json({ error: "Services can only be edited on draft or rejected applications." });
      return;
    }

    const serviceId = Number(req.params["serviceId"]);
    const [existing] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, serviceId),
          eq(servicesTable.providerId, application.providerProfileId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Service not found." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const updates: Partial<typeof servicesTable.$inferInsert> = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t.length < 1 || t.length > 200) {
        res.status(400).json({ error: "title must be between 1 and 200 characters." });
        return;
      }
      updates.title = t;
    }
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.durationMinutes !== undefined) {
      const dur = Number(body.durationMinutes);
      if (!Number.isInteger(dur) || dur < 15 || dur > 480) {
        res.status(400).json({ error: "durationMinutes must be between 15 and 480." });
        return;
      }
      updates.durationMinutes = dur;
    }
    if (body.priceCents !== undefined) {
      const price = Number(body.priceCents);
      if (!Number.isInteger(price) || price < 0) {
        res.status(400).json({ error: "priceCents must be a non-negative integer." });
        return;
      }
      updates.priceCents = price;
    }
    if (body.category !== undefined) updates.category = String(body.category);
    if (body.eligibilityNotes !== undefined) updates.eligibilityNotes = String(body.eligibilityNotes).trim();

    const service = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(servicesTable)
        .set(updates)
        .where(eq(servicesTable.id, serviceId))
        .returning();
      // Phase 3: services changed — funnel milestone + flip check in the
      // same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: application.providerProfileId,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
        serviceId,
      });
      return updated;
    });

    res.json({ service });
  },
);

router.delete(
  "/application/services/:serviceId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status !== "draft" && application.status !== "rejected") {
      res.status(409).json({ error: "Services can only be removed from draft or rejected applications." });
      return;
    }

    const serviceId = Number(req.params["serviceId"]);
    const [existing] = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, serviceId),
          eq(servicesTable.providerId, application.providerProfileId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Service not found." });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(servicesTable).where(eq(servicesTable.id, serviceId));
      // Phase 3: services changed — flip check (deactivation) in the same
      // transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: application.providerProfileId,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
      });
    });
    res.json({ message: "Service removed." });
  },
);

// ── Application-scoped availability (pre-approval) ────────────────────────────

router.get(
  "/application/availability",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    const slots = await db
      .select()
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, application.providerProfileId))
      .orderBy(availabilityTable.dayOfWeek, availabilityTable.startTime);
    res.json({ slots });
  },
);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.put(
  "/application/availability",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const application = await getOwnApplication(req.user!.sub);
    if (!application) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }
    if (application.status !== "draft" && application.status !== "rejected") {
      res.status(409).json({ error: "Availability can only be set on draft or rejected applications." });
      return;
    }

    const { slots } = req.body as {
      slots?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    };

    if (!Array.isArray(slots)) {
      res.status(400).json({ error: "slots must be an array." });
      return;
    }

    for (const [i, slot] of slots.entries()) {
      const day = Number(slot.dayOfWeek);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        res.status(400).json({ error: `slots[${i}].dayOfWeek must be 0–6.` });
        return;
      }
      if (!TIME_RE.test(slot.startTime)) {
        res.status(400).json({ error: `slots[${i}].startTime must be HH:MM (24h).` });
        return;
      }
      if (!TIME_RE.test(slot.endTime)) {
        res.status(400).json({ error: `slots[${i}].endTime must be HH:MM (24h).` });
        return;
      }
      if (slot.startTime >= slot.endTime) {
        res.status(400).json({ error: `slots[${i}]: startTime must be before endTime.` });
        return;
      }
    }

    const profileId = application.providerProfileId;

    let inserted: typeof availabilityTable.$inferSelect[] = [];
    await db.transaction(async (tx) => {
      await tx.delete(availabilityTable).where(eq(availabilityTable.providerId, profileId));
      if (slots.length > 0) {
        inserted = await tx
          .insert(availabilityTable)
          .values(
            slots.map((s) => ({
              providerId: profileId,
              dayOfWeek: Number(s.dayOfWeek),
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          )
          .returning();
      }
      // Phase 3: availability changed — funnel milestone + flip check in
      // the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profileId,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkAvailabilitySet: true },
      });
    });

    res.json({ slots: inserted });
  },
);

/** Build the public-facing provider object (joins user name + avatar). */
// GET /providers/me/listing-preview — owner-scoped marketplace preview.
//
// Lets a provider (draft, under-review, or approved) see exactly how their
// marketplace presence renders — profile, active services, weekly availability,
// effective timezone, and real generated 30-minute slots — using the SAME slot
// engine as public booking. Owner scope is derived from the authenticated user
// id only. This route never weakens the anonymous public approval gate: the
// public "/:providerId", "/:providerId/availability", and "/:providerId/slots"
// routes remain approved-only. Only public-preview-safe fields are returned;
// no client ids, booking ids, reviewer-private notes, verification documents,
// private care notes, or other providers' data are exposed.
router.get(
  "/me/listing-preview",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const userId = req.user!.sub;

    const profile = await getOwnProfile(userId);
    if (!profile) {
      res.status(404).json({ error: "No provider profile found for this account." });
      return;
    }
    const profileId = profile.id;

    const [account] = await db
      .select({
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const [application] = await db
      .select({ status: providerApplicationsTable.status })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, userId))
      .limit(1);

    const timezone = getMarketplaceTimezone();

    const services = await db
      .select({
        id: servicesTable.id,
        title: servicesTable.title,
        description: servicesTable.description,
        durationMinutes: servicesTable.durationMinutes,
        priceCents: servicesTable.priceCents,
        category: servicesTable.category,
      })
      .from(servicesTable)
      .where(and(eq(servicesTable.providerId, profileId), eq(servicesTable.isActive, true)))
      .orderBy(servicesTable.id);

    const availability = (await db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, profileId))
      .orderBy(availabilityTable.dayOfWeek, availabilityTable.startTime)) as AvailabilityWindow[];

    // Readiness (C1–C7) so the UI can surface exactly what remains.
    const readinessSource = await loadReadinessSourceByUserId(db, userId);
    const readiness = readinessSource
      ? await computeReadiness(db, readinessSource)
      : null;

    // Representative slot preview for the first active service over the next 7
    // days, generated by the same engine used for public booking. Candidate
    // (bookable) slots only — no live per-slot availability lookup is done here.
    const previewService = services[0];
    const slotPreview: Array<{ date: string; slots: Array<{ start: string; end: string; available: boolean }> }> = [];
    if (previewService) {
      const base = Date.now();
      for (let d = 1; d <= 7; d++) {
        const date = new Date(base + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const slots = generateSlotsForDate({
          date,
          durationMinutes: previewService.durationMinutes,
          windows: availability,
          tz: timezone,
        });
        if (slots.length > 0) {
          // Candidate preview slots: `available` is advisory here (no live
          // per-slot booking lookup); the transactional path stays authoritative.
          slotPreview.push({
            date,
            slots: slots.map((s) => ({ start: s.start, end: s.end, available: true })),
          });
        }
      }
    }

    res.json({
      preview: {
        isPublic: profile.verificationStatus === "approved",
        applicationStatus: application?.status ?? null,
        verificationStatus: profile.verificationStatus,
        timezone,
        profile: {
          title: profile.title,
          bio: profile.bio,
          city: profile.city,
          serviceAreaNotes: profile.serviceAreaNotes,
          yearsExperience: profile.yearsExperience,
          rating: profile.rating,
          reviewCount: profile.reviewCount,
          acceptsNewClients: profile.acceptsNewClients,
          firstName: account?.firstName ?? null,
          lastName: account?.lastName ?? null,
          avatarUrl: account?.avatarUrl ?? null,
        },
        services,
        availability,
        slotPreviewServiceId: previewService?.id ?? null,
        slotPreview,
        readiness,
      },
    });
  }
);

// ── Provider-owned public booking page (roadmap #11) ─────────────────────────
//
// One canonical public booking page per provider at /book/:slug. The slug is
// generated at first publish from the provider display name (lowercase
// kebab-case, 3–64 chars, globally unique, deterministic suffix on collision)
// and is NOT provider-editable afterwards. Providers stay unpublished until
// they intentionally publish; unpublishing removes public access but never
// deletes data (the slug is retained so the URL is stable on republish).

type BookingPageProfileRow = {
  id: number;
  publicSlug: string | null;
  bookingPagePublished: boolean;
  bookingPagePublishedAt: Date | null;
  verificationStatus: "pending" | "under_review" | "approved" | "rejected";
};

function bookingPageView(
  profile: BookingPageProfileRow,
  serviceAreaConfigured: boolean,
) {
  return {
    slug: profile.publicSlug,
    published: profile.bookingPagePublished,
    publishedAt: profile.bookingPagePublishedAt,
    path: profile.publicSlug ? `/book/${profile.publicSlug}` : null,
    // Publishing requires BOTH approval and an active service-area
    // configuration with at least one covered postal area (roadmap #12).
    eligible: profile.verificationStatus === "approved" && serviceAreaConfigured,
    verificationStatus: profile.verificationStatus,
    serviceAreaConfigured,
  };
}

/** True when the provider has an active coverage config with ≥1 active prefix. */
async function hasActiveServiceAreaCoverage(profileId: number): Promise<boolean> {
  try {
    return isCoverageConfigured(await loadProviderCoverage(db, profileId));
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // Absent Gate B service-area relations can hold no configuration.
    logger.warn(
      { profileId },
      "hasActiveServiceAreaCoverage degraded: Gate B-pending service-area tables missing; reporting unconfigured",
    );
    return false;
  }
}

/** GET /providers/me/booking-page — owner-scoped publish state. */
router.get(
  "/me/booking-page",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }
    res.json({
      bookingPage: bookingPageView(
        profile,
        await hasActiveServiceAreaCoverage(profile.id),
      ),
    });
  },
);

/** True when another profile already owns this slug. */
async function slugTaken(slug: string, ownProfileId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.publicSlug, slug))
    .limit(1);
  return Boolean(row && row.id !== ownProfileId);
}

/** POST /providers/me/booking-page/publish — approved providers only. */
router.post(
  "/me/booking-page/publish",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const serviceAreaConfigured = await hasActiveServiceAreaCoverage(profile.id);

    // Idempotent: already published with a slug → current state, no writes.
    if (profile.bookingPagePublished && profile.publicSlug) {
      res.json({ bookingPage: bookingPageView(profile, serviceAreaConfigured) });
      return;
    }

    // Roadmap #12 publish gate: a provider must have a valid active
    // service-area configuration (≥1 covered postal area) before public
    // online booking can be enabled. Unpublish stays ungated so a provider
    // can always take their page down.
    if (!serviceAreaConfigured) {
      res.status(409).json({
        error:
          "Add the areas you serve before publishing. Set at least one postal area in your service-area settings so clients can check availability.",
        reason: "service_area_required",
      });
      return;
    }

    // Slug immutability: reuse an existing slug (assigned by a prior
    // publish); otherwise generate from the display name.
    let slug = profile.publicSlug;
    if (!slug) {
      const [account] = await db
        .select({
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.sub))
        .limit(1);
      const base = slugifyDisplayName(
        `${account?.firstName ?? ""} ${account?.lastName ?? ""}`.trim(),
      );
      for (let attempt = 0; attempt < 50 && !slug; attempt++) {
        const candidate = slugCandidate(base, attempt);
        if (!(await slugTaken(candidate, profile.id))) slug = candidate;
      }
      // Deterministic safe fallback: the profile id is globally unique.
      if (!slug) slug = slugCandidate(`${base}-${profile.id}`, 0);
    }

    const publish = (finalSlug: string) =>
      db
        .update(providerProfilesTable)
        .set({
          publicSlug: finalSlug,
          bookingPagePublished: true,
          bookingPagePublishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerProfilesTable.id, profile.id),
            eq(providerProfilesTable.userId, req.user!.sub),
          ),
        )
        .returning({
          id: providerProfilesTable.id,
          publicSlug: providerProfilesTable.publicSlug,
          bookingPagePublished: providerProfilesTable.bookingPagePublished,
          bookingPagePublishedAt: providerProfilesTable.bookingPagePublishedAt,
          verificationStatus: providerProfilesTable.verificationStatus,
        });

    let updated: BookingPageProfileRow | undefined;
    try {
      [updated] = await publish(slug);
    } catch (error) {
      // Concurrent slug race: retry once with the deterministic id suffix.
      const text = error instanceof Error ? error.message : String(error);
      if (!text.includes("provider_profiles_public_slug_unique_idx")) throw error;
      [updated] = await publish(
        slugCandidate(`${slugifyDisplayName(slug)}-${profile.id}`, 0),
      );
    }

    if (!updated) {
      res.status(500).json({ error: "Booking page could not be published." });
      return;
    }
    res.json({ bookingPage: bookingPageView(updated, serviceAreaConfigured) });
  },
);

/**
 * POST /providers/me/booking-page/unpublish — owner-scoped. Intentionally not
 * gated on approval so a provider whose status changed can always take their
 * page down. Removes public access only; slug and data are retained.
 */
router.post(
  "/me/booking-page/unpublish",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const unpublishServiceAreaConfigured = await hasActiveServiceAreaCoverage(
      profile.id,
    );

    if (!profile.bookingPagePublished) {
      res.json({
        bookingPage: bookingPageView(profile, unpublishServiceAreaConfigured),
      });
      return;
    }

    const [updated] = await db
      .update(providerProfilesTable)
      .set({ bookingPagePublished: false, updatedAt: new Date() })
      .where(
        and(
          eq(providerProfilesTable.id, profile.id),
          eq(providerProfilesTable.userId, req.user!.sub),
        ),
      )
      .returning({
        id: providerProfilesTable.id,
        publicSlug: providerProfilesTable.publicSlug,
        bookingPagePublished: providerProfilesTable.bookingPagePublished,
        bookingPagePublishedAt: providerProfilesTable.bookingPagePublishedAt,
        verificationStatus: providerProfilesTable.verificationStatus,
      });

    res.json({
      bookingPage: bookingPageView(
        updated ?? profile,
        unpublishServiceAreaConfigured,
      ),
    });
  },
);

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

// ── In-app provider notifications (owner-scoped, read-only + mark-read) ───────
//
// Provider-facing notifications generated transactionally from lifecycle
// events. Owner scope is derived from the authenticated user; a notification's
// user_id is never taken from the request. Reviewer-private material is never
// exposed. Registered before the public "/:providerId" route so the literal
// "/notifications" paths are not captured as a providerId.

type NotificationCursor = { createdAt: string; id: number };

function encodeNotificationCursor(row: { createdAt: Date; id: number }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
    "utf8",
  ).toString("base64");
}

function decodeNotificationCursor(raw: string): NotificationCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { createdAt, id } = parsed as Record<string, unknown>;
  if (
    typeof createdAt !== "string" ||
    typeof id !== "number" ||
    !Number.isInteger(id)
  ) {
    return null;
  }
  if (Number.isNaN(new Date(createdAt).getTime())) return null;
  return { createdAt, id };
}

function serializeNotification(row: {
  id: number;
  // Table-inferred enum: covers every recorded event type with notification
  // content (submitted, reset_to_draft, approved, rejected).
  type: (typeof providerNotificationsTable.$inferSelect)["type"];
  title: string;
  body: string;
  link: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

const notificationColumns = {
  id: providerNotificationsTable.id,
  type: providerNotificationsTable.type,
  title: providerNotificationsTable.title,
  body: providerNotificationsTable.body,
  link: providerNotificationsTable.link,
  readAt: providerNotificationsTable.readAt,
  createdAt: providerNotificationsTable.createdAt,
};

// GET /providers/notifications — owner-scoped, newest-first, keyset-paginated.
router.get(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    let limit = 20;
    const rawLimit = req.query["limit"];
    if (rawLimit !== undefined) {
      const asString = String(rawLimit);
      const parsed = Number(asString);
      if (
        !/^\d+$/.test(asString) ||
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > 50
      ) {
        res
          .status(400)
          .json({ error: "limit must be an integer between 1 and 50." });
        return;
      }
      limit = parsed;
    }

    let cursor: NotificationCursor | null = null;
    const rawCursor = req.query["cursor"];
    if (rawCursor !== undefined) {
      cursor = decodeNotificationCursor(String(rawCursor));
      if (!cursor) {
        res.status(400).json({ error: "Invalid pagination cursor." });
        return;
      }
    }

    // Ownership is always the authenticated user — never from the cursor.
    const ownership = eq(providerNotificationsTable.userId, req.user!.sub);
    const cursorDate = cursor ? new Date(cursor.createdAt) : null;
    const where =
      cursor && cursorDate
        ? and(
            ownership,
            or(
              lt(providerNotificationsTable.createdAt, cursorDate),
              and(
                eq(providerNotificationsTable.createdAt, cursorDate),
                lt(providerNotificationsTable.id, cursor.id),
              ),
            ),
          )
        : ownership;

    const rows = await db
      .select(notificationColumns)
      .from(providerNotificationsTable)
      .where(where)
      .orderBy(
        desc(providerNotificationsTable.createdAt),
        desc(providerNotificationsTable.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeNotificationCursor(last) : null;

    res.json({
      notifications: page.map(serializeNotification),
      pagination: { limit, hasMore, nextCursor },
    });
  },
);

// GET /providers/notifications/unread-count — owner-scoped unread total.
router.get(
  "/notifications/unread-count",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerNotificationsTable)
      .where(
        and(
          eq(providerNotificationsTable.userId, req.user!.sub),
          isNull(providerNotificationsTable.readAt),
        ),
      );
    res.json({ unreadCount: rows[0]?.count ?? 0 });
  },
);

// POST /providers/notifications/:id/read — owner-only, non-enumerating,
// idempotent. 404 for a non-owner or unknown id (no existence disclosure).
router.post(
  "/notifications/:id/read",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    const rawId = String(req.params["id"] ?? "");
    if (!/^\d+$/.test(rawId)) {
      res.status(400).json({ error: "Invalid notification id." });
      return;
    }
    const id = Number(rawId);

    const [row] = await db
      .select(notificationColumns)
      .from(providerNotificationsTable)
      .where(
        and(
          eq(providerNotificationsTable.id, id),
          eq(providerNotificationsTable.userId, req.user!.sub),
        ),
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }

    if (!row.readAt) {
      const now = new Date();
      await db
        .update(providerNotificationsTable)
        .set({ readAt: now })
        .where(
          and(
            eq(providerNotificationsTable.id, id),
            eq(providerNotificationsTable.userId, req.user!.sub),
          ),
        );
      row.readAt = now;
    }

    res.json({ notification: serializeNotification(row) });
  },
);

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
  ...requireProviderOperation,
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

// ── Activation readiness (owner-scoped; unapproved providers may read) ────────
//
// Provider Activation & First Booking Conversion — Phase 2 (readiness view).
// Read-only: nothing is persisted and no marketplace event is emitted by
// reads. The C1–C7 computation lives in ../lib/provider-readiness.ts (moved
// there in Phase 3 so event emission can reuse it inside transactions);
// behavior is unchanged: criteria are computed live from raw source fields
// on every request and stored roll-up flags (profileComplete) are never
// trusted. Reason codes are the stable readiness subset of
// `marketplace_event_reason_code` in deterministic C1→C7 order.

/**
 * GET /providers/me/readiness — Own activation readiness.
 *
 * requireAuth + provider membership (NOT requireApprovedProvider): unapproved
 * providers must be able to read their own readiness to see what is missing.
 * Owner-scoped — the profile is resolved strictly from the authenticated
 * user id; no identifier is accepted from the request.
 */
router.get(
  "/me/readiness",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    const source = await loadReadinessSourceByUserId(db, req.user!.sub);
    if (!source) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const readiness = await computeReadiness(db, source);
    res.json({ readiness });
  },
);

// ── Activation hub summary (owner-scoped, read-only) ─────────────────────────
//
// GET /providers/me/activation-status — single safe summary for the provider
// Approval Status & Activation Hub. Unlike the approved-only /me/* operation
// routes this is readable by every provider member in every application state
// (mirrors the /application/status and /me/booking-page gating), because the
// hub exists precisely for providers who are not yet approved. It composes
// EXISTING business rules only: the buildStatusView capability flags, the
// computeReadiness criteria, roadmap #12 active coverage (the same rule that
// gates booking-page publishing), the #11 bookingPageView, status-level
// verification progress (raw document references, reviewer identity, and
// reviewer-private notes are NEVER included), and the first-value definition
// (first booking ever) scoped to the caller. Read-only; nothing is persisted.

type ProviderActivationMilestones = {
  accountCreated: boolean;
  profileCompleted: boolean;
  verificationSubmitted: boolean;
  approved: boolean;
  serviceAreaConfigured: boolean;
  activeServiceConfigured: boolean;
  availabilityConfigured: boolean;
  bookingPagePublished: boolean;
  firstBookingReceived: boolean;
};

type ProviderActivationNextAction =
  | "continue_onboarding"
  | "wait_for_review"
  | "review_update_needed"
  | "contact_support"
  | "complete_profile"
  | "configure_service_area"
  | "add_service"
  | "set_availability"
  | "publish_booking_page"
  | "share_booking_page"
  | "all_set";

/** Journey-ordered next action from true state only — never promises outcomes. */
function deriveActivationNextAction(
  applicationStatus: ApplicationRow["status"],
  m: ProviderActivationMilestones,
): ProviderActivationNextAction {
  if (applicationStatus === "draft") return "continue_onboarding";
  if (applicationStatus === "rejected") return "review_update_needed";
  if (applicationStatus === "suspended") return "contact_support";
  if (applicationStatus === "under_review") return "wait_for_review";
  // approved — booking-readiness journey order
  if (!m.profileCompleted) return "complete_profile";
  if (!m.serviceAreaConfigured) return "configure_service_area";
  if (!m.activeServiceConfigured) return "add_service";
  if (!m.availabilityConfigured) return "set_availability";
  if (!m.bookingPagePublished) return "publish_booking_page";
  if (!m.firstBookingReceived) return "share_booking_page";
  return "all_set";
}

/**
 * Drift-safe owner profile read for the activation hub — a narrow
 * booking-page projection kept for the hub's compact payload. Booking-page
 * columns are attempted first; on drift the read degrades to the truthful
 * pre-#11 state: no slug, unpublished. (Same convention as getOwnProfile
 * above — drift-safe since the provider route read audit — and
 * getOwnVerificationProfile below.)
 */
async function getOwnActivationProfile(
  userId: number,
): Promise<BookingPageProfileRow | null> {
  try {
    const rows = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
        publicSlug: providerProfilesTable.publicSlug,
        bookingPagePublished: providerProfilesTable.bookingPagePublished,
        bookingPagePublishedAt: providerProfilesTable.bookingPagePublishedAt,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    logger.warn(
      { userId },
      "getOwnActivationProfile degraded: Gate B-pending booking-page columns missing; reporting unpublished",
    );
    const rows = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, userId))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          ...row,
          publicSlug: null,
          bookingPagePublished: false,
          bookingPagePublishedAt: null,
        }
      : null;
  }
}

router.get(
  "/me/activation-status",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!assertProviderMember(req, res)) return;

    const application = await getOwnApplication(req.user!.sub);
    const profile = await getOwnActivationProfile(req.user!.sub);
    const source = await loadReadinessSourceByUserId(db, req.user!.sub);
    if (!application || !profile || !source) {
      res.status(404).json({ error: "Provider application not found." });
      return;
    }

    // Sequential LIMIT-1/status-only probes reusing existing rule helpers.
    const readiness = await computeReadiness(db, source);
    let serviceAreaConfigured = false;
    try {
      serviceAreaConfigured = await hasActiveServiceAreaCoverage(profile.id);
    } catch (error) {
      // provider_service_areas / provider_coverage_areas are Gate B-pending
      // tables (PROVIDER_SERVICE_AREAS_V1.sql); an absent table can hold no
      // coverage, so "not configured" is the truthful degraded state.
      if (!isSchemaDriftError(error)) throw error;
      logger.warn(
        { userId: req.user!.sub },
        "activation service-area probe degraded: Gate B-pending tables missing; reporting not configured",
      );
    }
    const docs = await db
      .select({
        status: verificationDocsTable.status,
        submittedAt: verificationDocsTable.submittedAt,
      })
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.providerId, profile.id))
      .orderBy(desc(verificationDocsTable.submittedAt));
    const firstBookingRows = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(eq(bookingsTable.providerId, profile.id))
      .limit(1);

    const verificationSubmitted = docs.length > 0;
    const verificationStatus = !verificationSubmitted
      ? "not_started"
      : profile.verificationStatus === "approved"
        ? "approved"
        : profile.verificationStatus === "rejected"
          ? "needs_update"
          : profile.verificationStatus === "under_review"
            ? "under_review"
            : "submitted";

    const milestones: ProviderActivationMilestones = {
      accountCreated: true,
      profileCompleted: readiness.criteria.profileComplete,
      verificationSubmitted,
      approved: readiness.criteria.approved,
      serviceAreaConfigured,
      activeServiceConfigured: readiness.criteria.activeService,
      availabilityConfigured: readiness.criteria.availability,
      bookingPagePublished: profile.bookingPagePublished,
      firstBookingReceived: firstBookingRows.length > 0,
    };
    const milestoneValues = Object.values(milestones);

    // Same provider-visible projection rules as GET /application/status.
    const statusView = buildStatusView(application);

    res.json({
      activation: {
        applicationStatus: statusView.status,
        rejectionReason: statusView.rejectionReason,
        submittedAt: statusView.submittedAt,
        reviewedAt: statusView.reviewedAt,
        canEdit: statusView.canEdit,
        canReset: statusView.canReset,
        canResubmit: statusView.canResubmit,
        verification: {
          status: verificationStatus,
          submittedAt: docs[0]?.submittedAt ?? null,
          canResubmit: profile.verificationStatus === "rejected",
        },
        milestones,
        milestonesCompleted: milestoneValues.filter(Boolean).length,
        milestonesTotal: milestoneValues.length,
        bookingPage: bookingPageView(profile, serviceAreaConfigured),
        nextAction: deriveActivationNextAction(statusView.status, milestones),
      },
    });
  },
);

/** PUT /providers/me — Update own profile */
router.put(
  "/me",
  ...requireProviderOperation,
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

    await db.transaction(async (tx) => {
      await tx
        .update(providerProfilesTable)
        .set(updates)
        .where(eq(providerProfilesTable.id, profile.id));
      // Phase 3: profile fields (C2) and/or acceptsNewClients (C6) changed —
      // funnel milestone + flip check in the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkProfileCompleted: true },
      });
    });

    const full = await buildProviderPublic(profile.id);
    res.json({ provider: full });
  }
);

/** GET /providers/me/services — List own services */
router.get(
  "/me/services",
  ...requireProviderOperation,
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
  ...requireProviderOperation,
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

    const service = await db.transaction(async (tx) => {
      const [created] = await tx
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
      // Phase 3: services changed — funnel milestone + flip check in the
      // same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
        serviceId: created!.id,
      });
      return created;
    });

    res.status(201).json({ service });
  }
);

/** PUT /providers/me/services/:serviceId — Update a service */
router.put(
  "/me/services/:serviceId",
  ...requireProviderOperation,
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

    const service = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(servicesTable)
        .set(updates)
        .where(eq(servicesTable.id, serviceId))
        .returning();
      // Phase 3: services changed (including isActive) — funnel milestone +
      // flip check in the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
        serviceId,
      });
      return updated;
    });

    res.json({ service });
  }
);

/** DELETE /providers/me/services/:serviceId — Deactivate a service */
router.delete(
  "/me/services/:serviceId",
  ...requireProviderOperation,
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

    await db.transaction(async (tx) => {
      await tx
        .update(servicesTable)
        .set({ isActive: false })
        .where(eq(servicesTable.id, serviceId));
      // Phase 3: last active service may have been deactivated — flip check
      // in the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkFirstServicePublished: true },
      });
    });

    res.json({ message: "Service deactivated." });
  }
);

/** GET /providers/me/availability — Get own availability */
router.get(
  "/me/availability",
  ...requireProviderOperation,
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
  ...requireProviderOperation,
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

    for (const [i, slot] of slots.entries()) {
      const day = Number(slot.dayOfWeek);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        res.status(400).json({ error: `slots[${i}].dayOfWeek must be 0–6.` });
        return;
      }
      if (!TIME_RE.test(slot.startTime)) {
        res.status(400).json({ error: `slots[${i}].startTime must be HH:MM (24h).` });
        return;
      }
      if (!TIME_RE.test(slot.endTime)) {
        res.status(400).json({ error: `slots[${i}].endTime must be HH:MM (24h).` });
        return;
      }
      // Overnight windows are unsupported; availability writes reject
      // start_time >= end_time.
      if (slot.startTime >= slot.endTime) {
        res.status(400).json({ error: `slots[${i}]: startTime must be before endTime.` });
        return;
      }
    }

    // Replace all slots atomically
    let inserted: typeof availabilityTable.$inferSelect[] = [];
    await db.transaction(async (tx) => {
      await tx
        .delete(availabilityTable)
        .where(eq(availabilityTable.providerId, profile.id));

      if (slots.length > 0) {
        inserted = await tx
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
      // Phase 3: availability changed — funnel milestone + flip check in
      // the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkAvailabilitySet: true },
      });
    });

    res.json({ slots: inserted });
  }
);

// ── Emergency openings (one-off extra slots) ──────────────────────────────────
//
// Owner-scoped, date-specific EXTRA availability outside the weekly windows
// (docs/emergency-openings-policy.md). Additive only: openings never modify
// the recurring schedule and never bypass overlap, travel-buffer, or
// service-area rules — they are consumed by the same engine as weekly
// windows. Deleting an opening never cancels or breaks appointments.

const OPENING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OPENING_HORIZON_DAYS = 365;

/** True when `value` (YYYY-MM-DD) is a real calendar date. */
function isRealCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/** GET /providers/me/availability/emergency-openings — upcoming, owner-scoped */
router.get(
  "/me/availability/emergency-openings",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const today = localDateOfInstant(Date.now(), getMarketplaceTimezone());
    let openings: (typeof providerEmergencyOpeningsTable.$inferSelect)[];
    try {
      openings = await db
        .select()
        .from(providerEmergencyOpeningsTable)
        .where(
          and(
            eq(providerEmergencyOpeningsTable.providerId, profile.id),
            gte(providerEmergencyOpeningsTable.date, today),
          ),
        )
        .orderBy(
          providerEmergencyOpeningsTable.date,
          providerEmergencyOpeningsTable.startTime,
        );
    } catch (error) {
      if (!isSchemaDriftError(error)) throw error;
      // An absent Gate B openings relation can hold no rows — empty is the truth.
      logger.warn(
        { profileId: profile.id },
        "emergency-openings read degraded: Gate B-pending relation missing; reporting none",
      );
      openings = [];
    }

    res.json({ openings });
  }
);

/** POST /providers/me/availability/emergency-openings — create with validation */
router.post(
  "/me/availability/emergency-openings",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { date, startTime, endTime, serviceIds, urgentOnly } = (req.body ??
      {}) as {
      date?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      serviceIds?: unknown;
      urgentOnly?: unknown;
    };

    if (
      typeof date !== "string" ||
      !OPENING_DATE_RE.test(date) ||
      !isRealCalendarDate(date)
    ) {
      res.status(400).json({ error: "date must be a real calendar date (YYYY-MM-DD)." });
      return;
    }
    if (typeof startTime !== "string" || !TIME_RE.test(startTime)) {
      res.status(400).json({ error: "startTime must be HH:MM (24h)." });
      return;
    }
    if (typeof endTime !== "string" || !TIME_RE.test(endTime)) {
      res.status(400).json({ error: "endTime must be HH:MM (24h)." });
      return;
    }
    if (startTime >= endTime) {
      res.status(400).json({ error: "startTime must be before endTime." });
      return;
    }
    if (urgentOnly !== undefined && typeof urgentOnly !== "boolean") {
      res.status(400).json({ error: "urgentOnly must be a boolean." });
      return;
    }

    const tz = getMarketplaceTimezone();
    const today = localDateOfInstant(Date.now(), tz);
    if (date < today) {
      res.status(400).json({ error: "date cannot be in the past." });
      return;
    }
    const horizon = localDateOfInstant(
      Date.now() + MAX_OPENING_HORIZON_DAYS * 24 * 60 * 60 * 1000,
      tz,
    );
    if (date > horizon) {
      res.status(400).json({
        error: `date must be within the next ${MAX_OPENING_HORIZON_DAYS} days.`,
      });
      return;
    }

    // Optional service restriction: every id must be an own ACTIVE service.
    let normalizedServiceIds: number[] | null = null;
    if (serviceIds !== undefined && serviceIds !== null) {
      if (
        !Array.isArray(serviceIds) ||
        serviceIds.some((id) => !Number.isInteger(id) || Number(id) <= 0)
      ) {
        res.status(400).json({ error: "serviceIds must be an array of service ids." });
        return;
      }
      const unique = [...new Set(serviceIds.map(Number))].sort((a, b) => a - b);
      if (unique.length > 0) {
        const owned = await db
          .select({ id: servicesTable.id })
          .from(servicesTable)
          .where(
            and(
              eq(servicesTable.providerId, profile.id),
              eq(servicesTable.isActive, true),
              inArray(servicesTable.id, unique),
            ),
          );
        if (owned.length !== unique.length) {
          res.status(400).json({
            error: "serviceIds must reference your own active services.",
          });
          return;
        }
        normalizedServiceIds = unique;
      }
    }

    // Mutual exclusion with blocked time off (vacation ranges): an opening
    // cannot be created on a blocked date (docs/availability-exceptions-policy.md).
    const [blockingRange] = await loadBlockedRanges(db, profile.id, { date });
    if (blockingRange) {
      res.status(409).json({
        error: `${date} falls inside your blocked time off (${blockingRange.startDate} – ${blockingRange.endDate}). Remove that time off first — emergency openings and time off cannot overlap.`,
        reason: "blocked_range_conflict",
      });
      return;
    }

    // Overlap prevention among openings: same provider + date, intersecting
    // wall-clock windows ("HH:MM" strings compare correctly).
    const sameDay = await db
      .select({
        id: providerEmergencyOpeningsTable.id,
        startTime: providerEmergencyOpeningsTable.startTime,
        endTime: providerEmergencyOpeningsTable.endTime,
      })
      .from(providerEmergencyOpeningsTable)
      .where(
        and(
          eq(providerEmergencyOpeningsTable.providerId, profile.id),
          eq(providerEmergencyOpeningsTable.date, date),
        ),
      );
    const overlap = sameDay.find(
      (o) => startTime < o.endTime && o.startTime < endTime,
    );
    if (overlap) {
      res.status(409).json({
        error: `This overlaps your existing emergency opening on ${date} (${overlap.startTime}–${overlap.endTime}). Delete or adjust that opening first.`,
        reason: "opening_overlap",
      });
      return;
    }

    const [opening] = await db
      .insert(providerEmergencyOpeningsTable)
      .values({
        providerId: profile.id,
        date,
        startTime,
        endTime,
        serviceIds: normalizedServiceIds,
        urgentOnly: urgentOnly === true,
      })
      .returning();

    res.status(201).json({ opening });
  }
);

/** DELETE /providers/me/availability/emergency-openings/:openingId */
router.delete(
  "/me/availability/emergency-openings/:openingId",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const openingId = Number(req.params["openingId"]);
    if (!Number.isInteger(openingId) || openingId <= 0) {
      res.status(400).json({ error: "openingId must be a positive integer." });
      return;
    }

    // Ownership is part of the WHERE — a foreign id is a non-leaking 404.
    const [opening] = await db
      .select()
      .from(providerEmergencyOpeningsTable)
      .where(
        and(
          eq(providerEmergencyOpeningsTable.id, openingId),
          eq(providerEmergencyOpeningsTable.providerId, profile.id),
        ),
      )
      .limit(1);
    if (!opening) {
      res.status(404).json({ error: "Emergency opening not found." });
      return;
    }

    // Honest delete guard (conservative by design, see policy doc): any
    // ACTIVE booking overlapping the opening's wall-clock window on that
    // date blocks deletion. Deleting an opening never cancels appointments.
    const tz = getMarketplaceTimezone();
    const parseMin = (v: string) => {
      const [h, m] = v.split(":").map(Number);
      return h! * 60 + m!;
    };
    const openStart = parseMin(opening.startTime);
    const openEnd = parseMin(opening.endTime);

    const activeBookings = await db
      .select({
        scheduledAt: bookingsTable.scheduledAt,
        durationMinutes: servicesTable.durationMinutes,
      })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
      .where(
        and(
          eq(bookingsTable.providerId, profile.id),
          inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
        ),
      );

    const conflictCount = activeBookings.filter((b) => {
      const ms = new Date(b.scheduledAt).getTime();
      if (localDateOfInstant(ms, tz) !== opening.date) return false;
      const startMin = parseMin(localTimeLabel(ms, tz));
      return startMin < openEnd && startMin + b.durationMinutes > openStart;
    }).length;

    if (conflictCount > 0) {
      res.status(409).json({
        error: `${conflictCount} active booking${conflictCount === 1 ? " is" : "s are"} scheduled during this opening. Cancel or reschedule ${conflictCount === 1 ? "it" : "them"} first — deleting the opening will not cancel appointments.`,
        reason: "bookings_exist",
        bookingCount: conflictCount,
      });
      return;
    }

    await db
      .delete(providerEmergencyOpeningsTable)
      .where(eq(providerEmergencyOpeningsTable.id, openingId));

    res.json({ message: "Emergency opening deleted." });
  }
);

// ── Blocked ranges (vacation / time off) ──────────────────────────────────────
//
// Owner-scoped date-range blocks (docs/availability-exceptions-policy.md):
// every day in [startDate, endDate] (inclusive, marketplace timezone) offers
// NO bookable time regardless of weekly windows — a subtractive source for
// the same engine. Mutually exclusive with emergency openings at write time.
// Blocking time off never cancels appointments: a range overlapping ACTIVE
// bookings is rejected with an honest 409. `reason` is a private
// provider-only note, never shown on client-facing surfaces.

const MAX_BLOCKED_RANGE_REASON_LENGTH = 200;

/** GET /providers/me/availability/blocked-ranges — upcoming, owner-scoped */
router.get(
  "/me/availability/blocked-ranges",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const today = localDateOfInstant(Date.now(), getMarketplaceTimezone());
    let ranges: (typeof providerBlockedRangesTable.$inferSelect)[];
    try {
      ranges = await db
        .select()
        .from(providerBlockedRangesTable)
        .where(
          and(
            eq(providerBlockedRangesTable.providerId, profile.id),
            gte(providerBlockedRangesTable.endDate, today),
          ),
        )
        .orderBy(
          providerBlockedRangesTable.startDate,
          providerBlockedRangesTable.id,
        );
    } catch (error) {
      if (!isSchemaDriftError(error)) throw error;
      // An absent Gate B blocked-ranges relation can hold no rows.
      logger.warn(
        { profileId: profile.id },
        "blocked-ranges read degraded: Gate B-pending relation missing; reporting none",
      );
      ranges = [];
    }

    res.json({ ranges });
  }
);

/** POST /providers/me/availability/blocked-ranges — create with validation */
router.post(
  "/me/availability/blocked-ranges",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { startDate, endDate, reason } = (req.body ?? {}) as {
      startDate?: unknown;
      endDate?: unknown;
      reason?: unknown;
    };

    if (
      typeof startDate !== "string" ||
      !OPENING_DATE_RE.test(startDate) ||
      !isRealCalendarDate(startDate)
    ) {
      res.status(400).json({ error: "startDate must be a real calendar date (YYYY-MM-DD)." });
      return;
    }
    if (
      typeof endDate !== "string" ||
      !OPENING_DATE_RE.test(endDate) ||
      !isRealCalendarDate(endDate)
    ) {
      res.status(400).json({ error: "endDate must be a real calendar date (YYYY-MM-DD)." });
      return;
    }
    if (startDate > endDate) {
      res.status(400).json({ error: "startDate must be on or before endDate." });
      return;
    }
    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      res.status(400).json({ error: "reason must be a string." });
      return;
    }
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";
    if (normalizedReason.length > MAX_BLOCKED_RANGE_REASON_LENGTH) {
      res.status(400).json({
        error: `reason must be at most ${MAX_BLOCKED_RANGE_REASON_LENGTH} characters.`,
      });
      return;
    }

    const tz = getMarketplaceTimezone();
    const today = localDateOfInstant(Date.now(), tz);
    if (startDate < today) {
      res.status(400).json({ error: "startDate cannot be in the past." });
      return;
    }
    const horizon = localDateOfInstant(
      Date.now() + MAX_OPENING_HORIZON_DAYS * 24 * 60 * 60 * 1000,
      tz,
    );
    if (endDate > horizon) {
      res.status(400).json({
        error: `endDate must be within the next ${MAX_OPENING_HORIZON_DAYS} days.`,
      });
      return;
    }

    // Overlap prevention among ranges: inclusive date-range intersection
    // ("YYYY-MM-DD" strings compare correctly).
    const existingRanges = await db
      .select({
        id: providerBlockedRangesTable.id,
        startDate: providerBlockedRangesTable.startDate,
        endDate: providerBlockedRangesTable.endDate,
      })
      .from(providerBlockedRangesTable)
      .where(eq(providerBlockedRangesTable.providerId, profile.id));
    const rangeOverlap = existingRanges.find(
      (r) => startDate <= r.endDate && r.startDate <= endDate,
    );
    if (rangeOverlap) {
      res.status(409).json({
        error: `This overlaps your existing time off ${rangeOverlap.startDate} – ${rangeOverlap.endDate}. Delete or adjust that block first.`,
        reason: "range_overlap",
      });
      return;
    }

    // Mutual exclusion with emergency openings: an opening dated inside the
    // range contradicts "no bookable time" — the provider must delete it
    // first (docs/availability-exceptions-policy.md).
    const conflictingOpenings = await db
      .select({
        date: providerEmergencyOpeningsTable.date,
        startTime: providerEmergencyOpeningsTable.startTime,
        endTime: providerEmergencyOpeningsTable.endTime,
      })
      .from(providerEmergencyOpeningsTable)
      .where(
        and(
          eq(providerEmergencyOpeningsTable.providerId, profile.id),
          gte(providerEmergencyOpeningsTable.date, startDate),
          lte(providerEmergencyOpeningsTable.date, endDate),
        ),
      )
      .orderBy(
        providerEmergencyOpeningsTable.date,
        providerEmergencyOpeningsTable.startTime,
      );
    if (conflictingOpenings.length > 0) {
      const first = conflictingOpenings[0]!;
      const n = conflictingOpenings.length;
      res.status(409).json({
        error: `${n} emergency opening${n === 1 ? " falls" : "s fall"} inside this time off (first: ${first.date} ${first.startTime}–${first.endTime}). Delete ${n === 1 ? "it" : "them"} first — emergency openings and time off cannot overlap.`,
        reason: "emergency_opening_conflict",
        openingCount: n,
      });
      return;
    }

    // Honest guard (chosen policy): any ACTIVE booking on a blocked day
    // rejects the range — the provider must cancel/reschedule first.
    // Blocking time off never cancels or moves appointments.
    const activeBookings = await db
      .select({ scheduledAt: bookingsTable.scheduledAt })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, profile.id),
          inArray(bookingsTable.status, ["requested", "confirmed", "rescheduled"]),
        ),
      );
    const conflictCount = activeBookings.filter((b) => {
      const d = localDateOfInstant(new Date(b.scheduledAt).getTime(), tz);
      return d >= startDate && d <= endDate;
    }).length;
    if (conflictCount > 0) {
      res.status(409).json({
        error: `${conflictCount} active booking${conflictCount === 1 ? " is" : "s are"} scheduled during this time off. Cancel or reschedule ${conflictCount === 1 ? "it" : "them"} first — blocking time off will not cancel appointments.`,
        reason: "bookings_exist",
        bookingCount: conflictCount,
      });
      return;
    }

    const [range] = await db
      .insert(providerBlockedRangesTable)
      .values({
        providerId: profile.id,
        startDate,
        endDate,
        reason: normalizedReason.length > 0 ? normalizedReason : null,
      })
      .returning();

    res.status(201).json({ range });
  }
);

/** DELETE /providers/me/availability/blocked-ranges/:rangeId */
router.delete(
  "/me/availability/blocked-ranges/:rangeId",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const rangeId = Number(req.params["rangeId"]);
    if (!Number.isInteger(rangeId) || rangeId <= 0) {
      res.status(400).json({ error: "rangeId must be a positive integer." });
      return;
    }

    // Ownership is part of the WHERE — a foreign id is a non-leaking 404.
    // No delete guard needed: removing time off only RE-OPENS bookable time
    // and can never invalidate an existing appointment.
    const [range] = await db
      .select({ id: providerBlockedRangesTable.id })
      .from(providerBlockedRangesTable)
      .where(
        and(
          eq(providerBlockedRangesTable.id, rangeId),
          eq(providerBlockedRangesTable.providerId, profile.id),
        ),
      )
      .limit(1);
    if (!range) {
      res.status(404).json({ error: "Time off not found." });
      return;
    }

    await db
      .delete(providerBlockedRangesTable)
      .where(eq(providerBlockedRangesTable.id, rangeId));

    res.json({ message: "Time off deleted." });
  }
);

/** GET /providers/me/travel-zones — List own travel zones */
router.get(
  "/me/travel-zones",
  ...requireProviderOperation,
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
  ...requireProviderOperation,
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

    const zone = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(travelZonesTable)
        .values({
          providerId: profile.id,
          zoneName: String(zoneName),
          city: String(city),
          notes: notes !== undefined ? String(notes) : null,
        })
        .returning();
      // Phase 3: travel zones changed — funnel milestone + flip check in
      // the same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkServiceAreaSet: true },
      });
      return created;
    });

    res.status(201).json({ zone });
  }
);

/** DELETE /providers/me/travel-zones/:zoneId — Remove a travel zone */
router.delete(
  "/me/travel-zones/:zoneId",
  ...requireProviderOperation,
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

    await db.transaction(async (tx) => {
      await tx.delete(travelZonesTable).where(eq(travelZonesTable.id, zoneId));
      // Phase 3: last travel zone may have been removed — flip check in the
      // same transaction as the write.
      await emitProviderActivationEvents(tx, {
        providerProfileId: profile.id,
        actor: { userId: req.user!.sub, role: req.authz!.activeRole },
        context: { checkServiceAreaSet: true },
      });
    });
    res.json({ message: "Travel zone removed." });
  }
);

// ── Service area & coverage (roadmap #12) ─────────────────────────────────────
//
// Canada-first provider-managed postal-prefix (FSA) coverage. Owner-scoped:
// coverage writes always derive the provider from the authenticated user —
// a provider id is never taken from the request, so cross-provider edits
// are impossible by construction. Raw coverage entries are returned ONLY
// to the owner; public surfaces get the safe description + eligibility
// states, never the prefix list.

/** Owner-facing service-area projection (safe: owner-scoped endpoints only). */
async function buildOwnServiceArea(profileId: number) {
  let config: typeof providerServiceAreasTable.$inferSelect | undefined;
  let prefixes: Array<{
    id: number;
    countryCode: string;
    prefix: string;
    createdAt: Date;
  }>;
  try {
    [config] = await db
      .select()
      .from(providerServiceAreasTable)
      .where(eq(providerServiceAreasTable.providerId, profileId))
      .limit(1);

    prefixes = await db
      .select({
        id: providerCoverageAreasTable.id,
        countryCode: providerCoverageAreasTable.countryCode,
        prefix: providerCoverageAreasTable.prefix,
        createdAt: providerCoverageAreasTable.createdAt,
      })
      .from(providerCoverageAreasTable)
      .where(
        and(
          eq(providerCoverageAreasTable.providerId, profileId),
          eq(providerCoverageAreasTable.isActive, true),
        ),
      )
      .orderBy(providerCoverageAreasTable.prefix);
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // Absent Gate B service-area relations can hold no configuration.
    logger.warn(
      { profileId },
      "buildOwnServiceArea degraded: Gate B-pending service-area tables missing; reporting unconfigured",
    );
    config = undefined;
    prefixes = [];
  }

  const configured = Boolean(config?.isActive) && prefixes.length > 0;

  return {
    configured,
    isActive: config?.isActive ?? false,
    countryCode: config?.countryCode ?? "CA",
    provinceCode: config?.provinceCode ?? null,
    city: config?.city ?? null,
    publicDescription: config?.publicDescription ?? null,
    prefixes,
    // Centrally managed travel/setup buffer — visible to the provider,
    // provider-specific overrides are DEFERRED (docs/TODO-LEDGER.md).
    bufferMinutes: getTravelSetupBufferMinutes(),
    bufferSource: getTravelSetupBufferSource(),
    publishEligible: configured,
  };
}

/** GET /providers/me/service-area — own coverage configuration */
router.get(
  "/me/service-area",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }
    res.json({ serviceArea: await buildOwnServiceArea(profile.id) });
  },
);

/** PUT /providers/me/service-area — create/update own configuration */
router.put(
  "/me/service-area",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { countryCode, provinceCode, city, publicDescription, isActive } =
      req.body as Record<string, unknown>;

    const country = normalizeCountryCode(countryCode ?? "CA");
    if (!country || !(SUPPORTED_COUNTRY_CODES as readonly string[]).includes(country)) {
      res.status(400).json({
        error: "Only Canada is supported for online service areas right now.",
      });
      return;
    }

    const province = normalizeProvinceCode(provinceCode);
    if (!province) {
      res.status(400).json({
        error: "provinceCode must be a valid Canadian province or territory.",
      });
      return;
    }

    if (city !== undefined && city !== null && typeof city !== "string") {
      res.status(400).json({ error: "city must be a string." });
      return;
    }
    if (
      publicDescription !== undefined &&
      publicDescription !== null &&
      (typeof publicDescription !== "string" || publicDescription.length > 500)
    ) {
      res.status(400).json({
        error: "publicDescription must be a string of at most 500 characters.",
      });
      return;
    }

    const values = {
      countryCode: country,
      provinceCode: province,
      city: typeof city === "string" && city.trim() ? city.trim() : null,
      publicDescription:
        typeof publicDescription === "string" && publicDescription.trim()
          ? publicDescription.trim()
          : null,
      isActive: isActive === undefined ? true : Boolean(isActive),
      updatedAt: new Date(),
    };

    await db
      .insert(providerServiceAreasTable)
      .values({ providerId: profile.id, ...values })
      .onConflictDoUpdate({
        target: providerServiceAreasTable.providerId,
        set: values,
      });

    res.json({ serviceArea: await buildOwnServiceArea(profile.id) });
  },
);

/** POST /providers/me/service-area/prefixes — add a covered postal area */
router.post(
  "/me/service-area/prefixes",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const [config] = await db
      .select({ id: providerServiceAreasTable.id })
      .from(providerServiceAreasTable)
      .where(eq(providerServiceAreasTable.providerId, profile.id))
      .limit(1);
    if (!config) {
      res.status(409).json({
        error:
          "Set your service-area country and province before adding postal areas.",
      });
      return;
    }

    const prefix = normalizeFsaPrefix((req.body as Record<string, unknown>)?.["prefix"]);
    if (!prefix) {
      res.status(400).json({
        error:
          "Enter a valid Canadian postal area — the first three characters of a postal code, for example M5V.",
      });
      return;
    }

    try {
      const created = await db.transaction(async (tx) => {
        // Reactivate a previously removed entry instead of duplicating it.
        const [existing] = await tx
          .select()
          .from(providerCoverageAreasTable)
          .where(
            and(
              eq(providerCoverageAreasTable.providerId, profile.id),
              eq(providerCoverageAreasTable.countryCode, "CA"),
              eq(providerCoverageAreasTable.prefix, prefix),
            ),
          )
          .orderBy(desc(providerCoverageAreasTable.isActive))
          .limit(1);

        if (existing?.isActive) {
          return { row: existing, duplicate: true };
        }
        if (existing) {
          const [reactivated] = await tx
            .update(providerCoverageAreasTable)
            .set({ isActive: true })
            .where(eq(providerCoverageAreasTable.id, existing.id))
            .returning();
          return { row: reactivated!, duplicate: false };
        }
        const [inserted] = await tx
          .insert(providerCoverageAreasTable)
          .values({ providerId: profile.id, countryCode: "CA", prefix })
          .returning();
        return { row: inserted!, duplicate: false };
      });

      if (created.duplicate) {
        res.status(409).json({
          error: "This postal area is already in your coverage.",
        });
        return;
      }
      res.status(201).json({
        prefix: {
          id: created.row.id,
          countryCode: created.row.countryCode,
          prefix: created.row.prefix,
          createdAt: created.row.createdAt,
        },
      });
    } catch (error) {
      // Concurrent duplicate: the partial unique index is the race guard.
      const text = error instanceof Error ? `${error.message}` : String(error);
      if (text.includes("provider_coverage_areas_active_prefix_unique_idx")) {
        res.status(409).json({
          error: "This postal area is already in your coverage.",
        });
        return;
      }
      throw error;
    }
  },
);

/** DELETE /providers/me/service-area/prefixes/:prefixId — remove (deactivate) */
router.delete(
  "/me/service-area/prefixes/:prefixId",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const prefixId = Number(req.params["prefixId"]);
    const [updated] = await db
      .update(providerCoverageAreasTable)
      .set({ isActive: false })
      .where(
        and(
          eq(providerCoverageAreasTable.id, prefixId),
          // Owner scope in the WHERE clause: another provider's entry is
          // indistinguishable from a missing one (non-leaking 404).
          eq(providerCoverageAreasTable.providerId, profile.id),
          eq(providerCoverageAreasTable.isActive, true),
        ),
      )
      .returning({ id: providerCoverageAreasTable.id });

    if (!updated) {
      res.status(404).json({ error: "Postal area not found." });
      return;
    }
    res.json({ message: "Postal area removed." });
  },
);

/** GET /providers/me/earnings — Earnings summary (placeholder until Stripe Connect) */
router.get(
  "/me/earnings",
  ...requireProviderOperation,
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
  ...requireProviderOperation,
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

// ── Provider dashboard (owner-scoped, read-only) ─────────────────────────────

/** Statuses that still occupy an upcoming slot. */
const DASHBOARD_ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "requested",
  "confirmed",
  "rescheduled",
]);

const DASHBOARD_UPCOMING_WINDOW_DAYS = 30;
const DASHBOARD_UPCOMING_LIMIT = 50;
const DASHBOARD_ACTIVITY_LIMIT = 10;

type DashboardBookingRow = {
  id: number;
  clientId: number;
  status:
    | "requested"
    | "confirmed"
    | "completed"
    | "cancelled"
    | "rescheduled"
    | "no_show";
  scheduledAt: Date;
  updatedAt: Date;
  postalCode: string | null;
  city: string;
  source: string | null;
  serviceTitle: string;
  priceCents: number;
  clientFirstName: string;
  clientLastName: string;
};

/**
 * One read of the provider's full booking history (joined to service +
 * client). Appropriate at pilot scale; revisit with SQL aggregation if a
 * provider ever exceeds thousands of bookings.
 */
const dashboardStableSelection = {
  id: bookingsTable.id,
  clientId: bookingsTable.clientId,
  status: bookingsTable.status,
  scheduledAt: bookingsTable.scheduledAt,
  updatedAt: bookingsTable.updatedAt,
  postalCode: bookingsTable.postalCode,
  city: bookingsTable.city,
  serviceTitle: servicesTable.title,
  priceCents: servicesTable.priceCents,
  clientFirstName: usersTable.firstName,
  clientLastName: usersTable.lastName,
};

async function loadDashboardBookingRows(
  providerProfileId: number,
): Promise<DashboardBookingRow[]> {
  try {
    return await db
      .select({ ...dashboardStableSelection, source: bookingsTable.source })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
      .innerJoin(usersTable, eq(usersTable.id, bookingsTable.clientId))
      .where(eq(bookingsTable.providerId, providerProfileId));
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    // Truthful degraded read: the Gate B-pending bookings.source column can
    // hold no attribution — null is the migrated column's backfill-free default.
    logger.warn(
      { providerProfileId },
      "loadDashboardBookingRows degraded: Gate B-pending bookings.source column missing; source reported as null",
    );
    const rows = await db
      .select(dashboardStableSelection)
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
      .innerJoin(usersTable, eq(usersTable.id, bookingsTable.clientId))
      .where(eq(bookingsTable.providerId, providerProfileId));
    return rows.map((row) => ({ ...row, source: null }));
  }
}

/** Privacy-trimmed cross-party label: first name + last initial. */
function dashboardClientName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial ? `${firstName} ${initial}.` : firstName;
}

/** FSA/postal prefix when present, otherwise city — never the full address. */
function dashboardLocation(postalCode: string | null, city: string): string {
  const prefix = postalCode?.trim().slice(0, 3).toUpperCase();
  return prefix && prefix.length === 3 ? prefix : city;
}

/** Local YYYY-MM-DD in the marketplace timezone (en-CA is ISO-ordered). */
function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function roundRate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Personal performance metrics. Rates use RESOLVED bookings (completed +
 * cancelled + no_show) as the denominator — active bookings have no outcome
 * yet, so counting them would silently deflate every rate. All rates are 0
 * when nothing is resolved (the UI shows an honest empty state instead).
 */
function computeDashboardMetrics(rows: DashboardBookingRow[]) {
  const completed = rows.filter((r) => r.status === "completed");
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const resolved = completed.length + cancelled + noShow;

  const completedByClient = new Map<number, number>();
  for (const row of completed) {
    completedByClient.set(row.clientId, (completedByClient.get(row.clientId) ?? 0) + 1);
  }
  const clientsWithCompleted = completedByClient.size;
  const repeatClients = [...completedByClient.values()].filter((c) => c >= 2).length;

  return {
    completionRate: resolved === 0 ? 0 : roundRate(completed.length / resolved),
    cancellationRate: resolved === 0 ? 0 : roundRate(cancelled / resolved),
    noShowRate: resolved === 0 ? 0 : roundRate(noShow / resolved),
    repeatClientRate:
      clientsWithCompleted === 0 ? 0 : roundRate(repeatClients / clientsWithCompleted),
    totalBookings: rows.length,
    completedBookings: completed.length,
    cancelledBookings: cancelled,
    noShowBookings: noShow,
    resolvedBookings: resolved,
  };
}

/**
 * Acquisition-source grouping over the allowlist (`qr-card` → `qrCard`).
 * `unknown` counts bookings without attribution; `other` only becomes
 * non-zero if the stored allowlist ever grows beyond these keys.
 */
function computeSourceAttribution(rows: DashboardBookingRow[]) {
  const attribution = {
    instagram: 0,
    qrCard: 0,
    text: 0,
    facebook: 0,
    website: 0,
    other: 0,
    unknown: 0,
  };
  for (const row of rows) {
    if (row.source === null) attribution.unknown += 1;
    else if (row.source === "instagram") attribution.instagram += 1;
    else if (row.source === "qr-card") attribution.qrCard += 1;
    else if (row.source === "text") attribution.text += 1;
    else if (row.source === "facebook") attribution.facebook += 1;
    else if (row.source === "website") attribution.website += 1;
    else attribution.other += 1;
  }
  return attribution;
}

function dashboardBookingView(row: DashboardBookingRow) {
  return {
    id: row.id,
    date: row.scheduledAt.toISOString(),
    clientName: dashboardClientName(row.clientFirstName, row.clientLastName),
    serviceName: row.serviceTitle,
    location: dashboardLocation(row.postalCode, row.city),
    status: row.status,
  };
}

const DASHBOARD_ACTIVITY_TYPES: Record<
  string,
  "booking" | "reschedule" | "cancellation" | "no_show"
> = {
  completed: "booking",
  rescheduled: "reschedule",
  cancelled: "cancellation",
  no_show: "no_show",
};

/**
 * GET /providers/me/dashboard — owner-scoped, read-only dashboard aggregate.
 * Everything is derived live from existing tables on every request; nothing
 * is persisted and no event is emitted (access is audit-logged only).
 */
router.get(
  "/me/dashboard",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const [userRows, rows] = await Promise.all([
      db
        .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(eq(usersTable.id, profile.userId))
        .limit(1),
      loadDashboardBookingRows(profile.id),
    ]);

    // Read-only access audit trail (pilot support requirement).
    logger.info(
      {
        userId: req.user!.sub,
        providerProfileId: profile.id,
        route: "/providers/me/dashboard",
      },
      "provider dashboard accessed",
    );

    const timezone = getMarketplaceTimezone();
    const now = new Date();
    const todayKey = localDateKey(now, timezone);
    const monthKey = todayKey.slice(0, 7);
    const windowEnd = new Date(
      now.getTime() + DASHBOARD_UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const active = rows.filter((r) => DASHBOARD_ACTIVE_STATUSES.has(r.status));
    const todayBookingsCount = active.filter(
      (r) => localDateKey(r.scheduledAt, timezone) === todayKey,
    ).length;

    // Phase A: client-initiated reschedules awaiting the provider's
    // confirm/decline (state machine: rescheduled → confirmed | cancelled).
    // Derived from the rows already loaded above — no extra query, no window
    // cap (a request past the 30-day upcoming window still needs attention).
    // Soonest requested time first; the summary reuses the same
    // privacy-trimmed booking view as every other booking in this payload.
    // Read-only: no status is ever changed here.
    const pendingRescheduleRows = rows
      .filter((r) => r.status === "rescheduled")
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    const upcoming = active
      .filter((r) => r.scheduledAt >= now && r.scheduledAt <= windowEnd)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, DASHBOARD_UPCOMING_LIMIT);

    const recentActivity = rows
      .filter((r) => r.status in DASHBOARD_ACTIVITY_TYPES)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, DASHBOARD_ACTIVITY_LIMIT)
      .map((r) => ({
        type: DASHBOARD_ACTIVITY_TYPES[r.status]!,
        date: r.updatedAt.toISOString(),
        clientName: dashboardClientName(r.clientFirstName, r.clientLastName),
        serviceName: r.serviceTitle,
        status: r.status,
      }));

    // Honest estimate only: completed visits this month × service price.
    // Payments are NOT enabled — null when nothing completed this month.
    const completedThisMonth = rows.filter(
      (r) =>
        r.status === "completed" &&
        localDateKey(r.scheduledAt, timezone).startsWith(monthKey),
    );
    const estimatedMonthlyCents =
      completedThisMonth.length === 0
        ? null
        : completedThisMonth.reduce((sum, r) => sum + r.priceCents, 0);

    const published = profile.bookingPagePublished && profile.publicSlug !== null;

    res.json({
      providerId: profile.id,
      providerName:
        `${userRows[0]?.firstName ?? ""} ${userRows[0]?.lastName ?? ""}`.trim(),
      slug: profile.publicSlug,
      bookingPagePublished: profile.bookingPagePublished,
      bookingUrl: published ? `/book/${profile.publicSlug}` : null,
      todayBookingsCount,
      nextBooking: upcoming[0] ? dashboardBookingView(upcoming[0]) : null,
      upcomingBookings: upcoming.map(dashboardBookingView),
      pendingReschedules: {
        count: pendingRescheduleRows.length,
        nextRequest: pendingRescheduleRows[0]
          ? dashboardBookingView(pendingRescheduleRows[0])
          : null,
      },
      metrics: computeDashboardMetrics(rows),
      sourceAttribution: computeSourceAttribution(rows),
      recentActivity,
      earningsPreview: {
        estimatedMonthlyCents,
        available: false,
      },
      updatedAt: now.toISOString(),
    });
  },
);

/** GET /providers/me/metrics — metrics-only view of the same derivation. */
router.get(
  "/me/metrics",
  ...requireProviderOperation,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }
    const rows = await loadDashboardBookingRows(profile.id);
    res.json({
      metrics: computeDashboardMetrics(rows),
      updatedAt: new Date().toISOString(),
    });
  },
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

    // Verify provider exists, and read the approval gate.
    // Draft services from unapproved providers must never be publicly
    // discoverable — mirrors the `verificationStatus === "approved"` gate
    // already used by the general provider-listing endpoint above.
    const profile = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    if (profile[0].verificationStatus !== "approved") {
      // Profile page may still render publicly, but no services are exposed
      // until the provider is fully approved. Returning an empty list keeps
      // the shape stable for clients.
      res.json({ services: [] });
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

/** GET /providers/:providerId/availability — Public weekly windows + timezone */
router.get(
  "/:providerId/availability",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);

    const profile = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const timezone = getMarketplaceTimezone();

    // Unapproved providers expose a stable shape but no windows.
    if (profile[0].verificationStatus !== "approved") {
      res.json({ timezone, windows: [] });
      return;
    }

    const windows = await db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, providerId))
      .orderBy(availabilityTable.dayOfWeek, availabilityTable.startTime);

    res.json({ timezone, windows });
  }
);

/**
 * POST /providers/:providerId/service-area-check — public eligibility check
 * for the marketplace booking flow (roadmap #12). Server-authoritative:
 * returns ONLY a safe eligibility state, the approved public message, and
 * an allowlisted reason code — never raw coverage entries, and never any
 * provider-private data. Client input is validated minimally and NOT
 * retained. Unapproved providers report `unavailable` (indistinguishable
 * from unconfigured — non-leaking).
 */
router.post(
  "/:providerId/service-area-check",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);

    const [profile] = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (profile.verificationStatus !== "approved") {
      res.json({
        eligibility: {
          status: "unavailable",
          reason: "not_configured",
          message: SERVICE_AREA_MESSAGES["unavailable"],
        },
      });
      return;
    }

    const coverage = await loadProviderCoverage(db, profile.id);
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
  }
);

/** GET /providers/:providerId/slots?serviceId&date — Public bookable slots */
router.get(
  "/:providerId/slots",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);
    const serviceId = Number(req.query["serviceId"]);
    const date = String(req.query["date"] ?? "");

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      res.status(400).json({ error: "serviceId is required." });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD." });
      return;
    }

    const profile = await db
      .select({
        id: providerProfilesTable.id,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);

    if (!profile[0]) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const timezone = getMarketplaceTimezone();

    if (profile[0].verificationStatus !== "approved") {
      res.json({ timezone, date, slots: [] });
      return;
    }

    const service = await db
      .select({ durationMinutes: servicesTable.durationMinutes })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, serviceId),
          eq(servicesTable.providerId, providerId),
          eq(servicesTable.isActive, true)
        )
      )
      .limit(1);

    if (!service[0]) {
      res.status(404).json({ error: "Service not found or inactive." });
      return;
    }

    const windows = (await db
      .select({
        dayOfWeek: availabilityTable.dayOfWeek,
        startTime: availabilityTable.startTime,
        endTime: availabilityTable.endTime,
      })
      .from(availabilityTable)
      .where(eq(availabilityTable.providerId, providerId))) as AvailabilityWindow[];

    // Emergency openings on this date add candidate slots for the requested
    // service through the same engine (docs/emergency-openings-policy.md).
    const emergencyOpenings = await loadEmergencyOpenings(db, providerId, {
      date,
    });

    // Blocked time off (vacation ranges) removes the whole day from BOTH
    // sources (docs/availability-exceptions-policy.md).
    const blockedRanges = await loadBlockedRanges(db, providerId, { date });

    const candidates = generateEffectiveSlotsForDate({
      date,
      durationMinutes: service[0].durationMinutes,
      windows,
      tz: timezone,
      serviceId,
      emergencyOpenings,
      blockedRanges,
    });

    // Advisory `available` flag: mark a slot taken when it overlaps an active
    // booking for this provider. The transactional booking path is the
    // authoritative guard; this flag is a best-effort UI hint only.
    const active = await db
      .select({
        scheduledAt: bookingsTable.scheduledAt,
        durationMinutes: servicesTable.durationMinutes,
      })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, bookingsTable.serviceId))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          or(
            eq(bookingsTable.status, "requested"),
            eq(bookingsTable.status, "confirmed"),
            eq(bookingsTable.status, "rescheduled")
          )
        )
      );

    const activeIntervals = active.map((b) => {
      const start = new Date(b.scheduledAt).getTime();
      return { start, end: start + b.durationMinutes * 60000 };
    });

    // Advisory hint only: a slot is marked taken when it overlaps an active
    // booking OR falls inside the centrally managed travel/setup buffer
    // around one (roadmap #12). The transactional booking path remains the
    // authoritative guard for both rules.
    const bufferMs = getTravelSetupBufferMinutes() * 60000;

    const slots = candidates.map((s) => {
      const start = new Date(s.start).getTime();
      const end = new Date(s.end).getTime();
      const available = !activeIntervals.some(
        (iv) => iv.start < end + bufferMs && start < iv.end + bufferMs
      );
      return { start: s.start, end: s.end, available, urgentOnly: s.urgentOnly };
    });

    res.json({ timezone, date, slots });
  }
);

// ── Verification / Credentials ────────────────────────────────────────────────

const ALLOWED_DOC_TYPES = ["license", "insurance", "certification", "other"];
const MAX_DOC_REFERENCE_LENGTH = 200;
const MAX_REVIEWER_NOTES_LENGTH = 1000;

/**
 * Drift-safe narrow profile lookup for the verification flow. getOwnProfile()
 * selects every schema column, so on a database where the Gate B-pending
 * booking-page columns (docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql)
 * are not applied yet it fails with 42703 ("column public_slug does not
 * exist") and onboarding document submission surfaced as a generic 500.
 * Verification only needs signup-era columns, so select exactly those.
 */
async function getOwnVerificationProfile(userId: number) {
  const rows = await db
    .select({
      id: providerProfilesTable.id,
      verificationStatus: providerProfilesTable.verificationStatus,
    })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** GET /providers/me/verification — Own docs + overall status */
router.get(
  "/me/verification",
  requireAuth,
  requireRole("provider"),
  async (req: Request, res: Response): Promise<void> => {
    const profile = await getOwnVerificationProfile(req.user!.sub);
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
    const profile = await getOwnVerificationProfile(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: "Provider profile not found." });
      return;
    }

    const { docType, fileName, notes } = req.body as {
      docType?: unknown;
      fileName?: unknown;
      notes?: unknown;
    };

    if (typeof docType !== "string" || !ALLOWED_DOC_TYPES.includes(docType)) {
      res.status(400).json({ error: `docType must be one of: ${ALLOWED_DOC_TYPES.join(", ")}.` });
      return;
    }
    const reference = typeof fileName === "string" ? fileName.trim() : "";
    if (reference.length < 3) {
      res.status(400).json({ error: "fileName (document URL or reference) is required." });
      return;
    }
    if (reference.length > MAX_DOC_REFERENCE_LENGTH) {
      res.status(400).json({
        error: `fileName must be at most ${MAX_DOC_REFERENCE_LENGTH} characters.`,
      });
      return;
    }
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      res.status(400).json({ error: "notes must be a string." });
      return;
    }
    const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
    if (trimmedNotes.length > MAX_REVIEWER_NOTES_LENGTH) {
      res.status(400).json({
        error: `notes must be at most ${MAX_REVIEWER_NOTES_LENGTH} characters.`,
      });
      return;
    }

    // One transaction for the whole submission: lock the profile row to
    // serialize double-taps/retries per provider, return the identical
    // pending doc when one already exists (idempotent — no duplicate records
    // under retry or concurrency), insert exactly one record, then
    // auto-advance pending → under_review. All-or-nothing: a failure rolls
    // back both the doc and the status bump (no orphaned records).
    const doc = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from provider_profiles where id = ${profile.id} for update`,
      );

      const existing = await tx
        .select()
        .from(verificationDocsTable)
        .where(
          and(
            eq(verificationDocsTable.providerId, profile.id),
            eq(verificationDocsTable.docType, docType),
            eq(verificationDocsTable.fileName, reference),
            eq(verificationDocsTable.status, "pending"),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];

      const [inserted] = await tx
        .insert(verificationDocsTable)
        .values({
          providerId: profile.id,
          docType,
          fileName: reference,
          reviewerNotes: trimmedNotes.length > 0 ? trimmedNotes : null,
          status: "pending",
        })
        .returning();
      if (!inserted) {
        throw new Error("verification doc insert returned no row");
      }

      if (profile.verificationStatus === "pending") {
        await tx
          .update(providerProfilesTable)
          .set({ verificationStatus: "under_review", updatedAt: new Date() })
          .where(eq(providerProfilesTable.id, profile.id));
      }
      return inserted;
    });

    res.status(201).json({ doc });
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
