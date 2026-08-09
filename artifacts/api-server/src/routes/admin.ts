import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  verificationDocsTable,
  providerApplicationsTable,
  providerApplicationEventsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { createApplicationNotification } from "../lib/application-notifications.js";

const router = Router();

// All admin routes require admin role
router.use(requireAuth, requireRole("admin"));

// ── GET /admin/verification/queue ─────────────────────────────────────────────

router.get(
  "/verification/queue",
  async (req: Request, res: Response): Promise<void> => {
    const statusFilter = (req.query["status"] as string) ?? "pending";
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const offset = Number(req.query["offset"] ?? 0);

    const ALLOWED_STATUSES = ["pending", "approved", "rejected"];
    if (!ALLOWED_STATUSES.includes(statusFilter)) {
      res.status(400).json({ error: "status must be pending, approved, or rejected." });
      return;
    }

    const rows = await db
      .select({
        doc: verificationDocsTable,
        provider: {
          id: providerProfilesTable.id,
          userId: providerProfilesTable.userId,
          city: providerProfilesTable.city,
          verificationStatus: providerProfilesTable.verificationStatus,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
        },
      })
      .from(verificationDocsTable)
      .innerJoin(
        providerProfilesTable,
        eq(verificationDocsTable.providerId, providerProfilesTable.id)
      )
      .innerJoin(usersTable, eq(providerProfilesTable.userId, usersTable.id))
      .where(eq(verificationDocsTable.status, statusFilter as "pending" | "approved" | "rejected"))
      .orderBy(sql`${verificationDocsTable.submittedAt} asc`)
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.status, statusFilter as "pending" | "approved" | "rejected"));

    res.json({
      items: rows,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  }
);

// ── PATCH /admin/verification/docs/:docId ─────────────────────────────────────

router.patch(
  "/verification/docs/:docId",
  async (req: Request, res: Response): Promise<void> => {
    const docId = Number(req.params["docId"]);
    if (!Number.isFinite(docId)) {
      res.status(400).json({ error: "Invalid doc ID." });
      return;
    }

    const { status, reviewerNotes, updateProviderStatus } = req.body as {
      status?: string;
      reviewerNotes?: string;
      updateProviderStatus?: string;
    };

    const ALLOWED_STATUSES = ["approved", "rejected"];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ error: "status must be approved or rejected." });
      return;
    }

    // Fetch the doc to confirm it exists
    const existing = await db
      .select()
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.id, docId))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    const [updated] = await db
      .update(verificationDocsTable)
      .set({
        status: status as "approved" | "rejected",
        reviewerNotes: reviewerNotes?.trim() ?? null,
        reviewedAt: new Date(),
      })
      .where(eq(verificationDocsTable.id, docId))
      .returning();

    // Optionally update provider's overall verification status
    if (updateProviderStatus) {
      const ALLOWED_PROVIDER_STATUSES = ["pending", "under_review", "approved", "rejected"];
      if (!ALLOWED_PROVIDER_STATUSES.includes(updateProviderStatus)) {
        res.status(400).json({ error: "Invalid updateProviderStatus value." });
        return;
      }
      await db
        .update(providerProfilesTable)
        .set({
          verificationStatus: updateProviderStatus as "pending" | "under_review" | "approved" | "rejected",
          updatedAt: new Date(),
        })
        .where(eq(providerProfilesTable.id, existing[0].providerId));
    }

    res.json({ doc: updated });
  }
);

// ── Reviewer decisions on provider applications (MC9 Commit 1) ───────────────
//
// Admin-only approve/reject of a provider application. The only valid source
// state is `under_review`; any other state (including a repeated decision)
// fails with 409 and produces no side effects. The decision, the reviewer
// audit fields (`reviewedAt`, `reviewedBy`, reviewer-private `reviewerNotes`,
// and — on reject — the provider-visible `rejectionReason`), and the matching
// `approved`/`rejected` lifecycle event are persisted in a single
// transaction: the event exists iff the transition committed.
//
// Boundaries kept intact:
//   - Reviewers can never decide their own application (403), so a user who
//     holds both provider and admin roles cannot self-approve.
//   - Provider-operations authorization is unchanged — it still additionally
//     requires an approved profile verification status (separate flow above).
//   - No notifications are created here (MC9 Commit 2 adds them).

// Drizzle transaction handle type, derived from db.transaction's callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DecisionOutcome =
  | { kind: "not_found" }
  | { kind: "self_review" }
  | { kind: "conflict"; status: string }
  | {
      kind: "decided";
      application: typeof providerApplicationsTable.$inferSelect;
    };

async function decideProviderApplication(
  applicationId: number,
  reviewerId: number,
  decision: "approved" | "rejected",
  reviewerNotes: string | null,
  rejectionReason: string | null,
): Promise<DecisionOutcome> {
  return db.transaction(async (tx: Tx): Promise<DecisionOutcome> => {
    const rows = await tx
      .select({
        id: providerApplicationsTable.id,
        userId: providerApplicationsTable.userId,
        status: providerApplicationsTable.status,
      })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.id, applicationId))
      .limit(1)
      .for("update");

    const current = rows[0];
    if (!current) return { kind: "not_found" };
    if (current.userId === reviewerId) return { kind: "self_review" };
    if (current.status !== "under_review") {
      return { kind: "conflict", status: current.status };
    }

    const now = new Date();
    const [updated] = await tx
      .update(providerApplicationsTable)
      .set({
        status: decision,
        reviewedAt: now,
        reviewedBy: reviewerId,
        reviewerNotes,
        rejectionReason: decision === "rejected" ? rejectionReason : null,
        updatedAt: now,
      })
      .where(eq(providerApplicationsTable.id, current.id))
      .returning();

    // Lifecycle event (MC9): under_review → approved|rejected. Same
    // transaction; reachable only from `under_review` (other states conflict
    // above), so exactly one event per real decision. `userId` is the
    // application owner — the provider the event belongs to — not the
    // reviewer.
    const [event] = await tx
      .insert(providerApplicationEventsTable)
      .values({
        providerApplicationId: current.id,
        userId: current.userId,
        type: decision,
        fromStatus: "under_review",
        toStatus: decision,
      })
      .returning({ id: providerApplicationEventsTable.id });

    // Decision notification (MC9 Commit 2): created in the SAME transaction
    // as the event — one per event via UNIQUE(user_id, event_id). Recipient
    // is the application owner. Content is static and provider-safe; the
    // provider-visible rejectionReason is surfaced on the status page, never
    // stored in the notification.
    await createApplicationNotification(tx, current.userId, event!.id, decision);

    return { kind: "decided", application: updated! };
  });
}

/** Admin-scoped response projection; includes reviewer-private fields. */
function adminApplicationResponse(
  application: typeof providerApplicationsTable.$inferSelect,
) {
  return {
    application: {
      id: application.id,
      userId: application.userId,
      providerProfileId: application.providerProfileId,
      status: application.status,
      currentStep: application.currentStep,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      reviewedBy: application.reviewedBy,
      reviewerNotes: application.reviewerNotes,
      rejectionReason: application.rejectionReason,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    },
  };
}

function parseApplicationId(req: Request, res: Response): number | null {
  const applicationId = Number(req.params["applicationId"]);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    res.status(400).json({ error: "Invalid application ID." });
    return null;
  }
  return applicationId;
}

/** Optional reviewer-private notes; trimmed, empty coerced to null. */
function parseReviewerNotes(
  value: unknown,
  res: Response,
): { ok: true; notes: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, notes: null };
  if (typeof value !== "string") {
    res.status(400).json({ error: "reviewerNotes must be a string." });
    return { ok: false };
  }
  const trimmed = value.trim();
  return { ok: true, notes: trimmed.length > 0 ? trimmed : null };
}

function sendDecisionError(
  res: Response,
  outcome: Exclude<DecisionOutcome, { kind: "decided" }>,
): void {
  if (outcome.kind === "not_found") {
    res.status(404).json({ error: "Provider application not found." });
    return;
  }
  if (outcome.kind === "self_review") {
    res.status(403).json({ error: "You cannot review your own application." });
    return;
  }
  res.status(409).json({
    error: `Applications in status "${outcome.status}" cannot be decided; only "under_review" applications can be approved or rejected.`,
  });
}

// ── POST /admin/provider-applications/:applicationId/approve ─────────────────

router.post(
  "/provider-applications/:applicationId/approve",
  async (req: Request, res: Response): Promise<void> => {
    const applicationId = parseApplicationId(req, res);
    if (applicationId === null) return;

    const body = (req.body ?? {}) as { reviewerNotes?: unknown };
    const notes = parseReviewerNotes(body.reviewerNotes, res);
    if (!notes.ok) return;

    const outcome = await decideProviderApplication(
      applicationId,
      req.user!.sub,
      "approved",
      notes.notes,
      null,
    );

    if (outcome.kind !== "decided") {
      sendDecisionError(res, outcome);
      return;
    }
    res.json(adminApplicationResponse(outcome.application));
  },
);

// ── POST /admin/provider-applications/:applicationId/reject ──────────────────

router.post(
  "/provider-applications/:applicationId/reject",
  async (req: Request, res: Response): Promise<void> => {
    const applicationId = parseApplicationId(req, res);
    if (applicationId === null) return;

    const body = (req.body ?? {}) as {
      rejectionReason?: unknown;
      reviewerNotes?: unknown;
    };

    // Provider-visible reason is required for a rejection.
    if (
      typeof body.rejectionReason !== "string" ||
      body.rejectionReason.trim().length === 0
    ) {
      res.status(400).json({
        error: "rejectionReason is required and must be a non-empty string.",
      });
      return;
    }
    const notes = parseReviewerNotes(body.reviewerNotes, res);
    if (!notes.ok) return;

    const outcome = await decideProviderApplication(
      applicationId,
      req.user!.sub,
      "rejected",
      notes.notes,
      body.rejectionReason.trim(),
    );

    if (outcome.kind !== "decided") {
      sendDecisionError(res, outcome);
      return;
    }
    res.json(adminApplicationResponse(outcome.application));
  },
);

export default router;
