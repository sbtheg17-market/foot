import { Router, type Request, type Response } from "express";
import { eq, ilike, and, or, lt, desc, sql, isNull } from "drizzle-orm";
import {
  db,
  providerProfilesTable,
  providerApplicationsTable,
  providerApplicationSubmissionsTable,
  providerApplicationEventsTable,
  providerNotificationsTable,
  accountRolesTable,
  travelZonesTable,
  availabilityTable,
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
import { createApplicationNotification } from "../lib/application-notifications.js";
import {
  computeReadiness,
  loadReadinessSourceByUserId,
} from "../lib/provider-readiness.js";
import { emitProviderActivationEvents } from "../lib/marketplace-events.js";
import {
  getMarketplaceTimezone,
  generateSlotsForDate,
  type AvailabilityWindow,
} from "../lib/availability.js";

const router = Router();

const requireProviderOperation = [
  requireAuth,
  requireRole("provider"),
  requireApprovedProvider,
];

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

async function getOwnApplication(userId: number): Promise<ApplicationRow | null> {
  const rows = await db
    .select({
      id: providerApplicationsTable.id,
      userId: providerApplicationsTable.userId,
      providerProfileId: providerApplicationsTable.providerProfileId,
      status: providerApplicationsTable.status,
      currentStep: providerApplicationsTable.currentStep,
      submittedAt: providerApplicationsTable.submittedAt,
      reviewedAt: providerApplicationsTable.reviewedAt,
      rejectionReason: providerApplicationsTable.rejectionReason,
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
    })
    .from(providerApplicationsTable)
    .innerJoin(
      providerProfilesTable,
      eq(providerProfilesTable.id, providerApplicationsTable.providerProfileId),
    )
    .where(eq(providerApplicationsTable.userId, userId))
    .limit(1);

  const application = rows[0];
  if (!application) return null;

  // Owner-visible submission history: only public fields, never reviewerNotes.
  const previousSubmissions = await db
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

    const candidates = generateSlotsForDate({
      date,
      durationMinutes: service[0].durationMinutes,
      windows,
      tz: timezone,
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

    const slots = candidates.map((s) => {
      const start = new Date(s.start).getTime();
      const end = new Date(s.end).getTime();
      const available = !activeIntervals.some(
        (iv) => iv.start < end && start < iv.end
      );
      return { start: s.start, end: s.end, available };
    });

    res.json({ timezone, date, slots });
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
