import { Router, type Request, type Response } from "express";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import {
  db,
  verificationDocsTable,
  providerApplicationsTable,
  providerApplicationEventsTable,
  providerProfilesTable,
  supportTicketsTable,
  supportMessagesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import adminPilotRouter from "./admin-pilot.js";
import { computeSystemStatus } from "../lib/system-status.js";
import { summarizeDemoData, purgeDemoData, PURGE_CONFIRMATION } from "../lib/demo-data.js";
import { logger } from "../lib/logger.js";
import { createApplicationNotification } from "../lib/application-notifications.js";
import { emitProviderActivationEvents } from "../lib/marketplace-events.js";
import { sendApplicationDecisionEmail, type EmailOutcome } from "../lib/decision-emails.js";

const router = Router();

// All admin routes require admin role
router.use(requireAuth, requireRole("admin"));

// Pilot Operations Dashboard (admin-only; inherits the gate above).
router.use("/pilot", adminPilotRouter);

// ── GET /admin/system-status ─────────────────────────────────────────────────
// Deployment config health: env var presence (never values) + applied migrations.

router.get("/system-status", async (_req: Request, res: Response): Promise<void> => {
  res.json(await computeSystemStatus());
});

// ── Demo data (seed accounts + sample bookings) ──────────────────────────────

router.get("/demo-data", async (_req: Request, res: Response): Promise<void> => {
  res.json(await summarizeDemoData());
});

router.post("/demo-data/purge", async (req: Request, res: Response): Promise<void> => {
  const confirm = (req.body as { confirm?: unknown } | undefined)?.confirm;
  if (confirm !== PURGE_CONFIRMATION) {
    res.status(400).json({ error: `Type "${PURGE_CONFIRMATION}" to confirm.` });
    return;
  }
  const removed = await purgeDemoData();
  logger.warn(
    { adminUserId: req.user!.sub, removed: removed.counts },
    "Demo data purged",
  );
  res.json({ removed });
});

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

    if (updateProviderStatus) {
      const ALLOWED_PROVIDER_STATUSES = ["pending", "under_review", "approved", "rejected"];
      if (!ALLOWED_PROVIDER_STATUSES.includes(updateProviderStatus)) {
        res.status(400).json({ error: "Invalid updateProviderStatus value." });
        return;
      }
    }

    const [updated] = await db.transaction(async (tx) => {
      const updatedRows = await tx
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
        await tx
          .update(providerProfilesTable)
          .set({
            verificationStatus: updateProviderStatus as "pending" | "under_review" | "approved" | "rejected",
            updatedAt: new Date(),
          })
          .where(eq(providerProfilesTable.id, existing[0]!.providerId));
      }

      // Phase 3: verification status (C1) and/or doc status (C7, dormant
      // while no document type is mandated) may have changed — activation
      // flip check in the SAME transaction as the review.
      await emitProviderActivationEvents(tx, {
        providerProfileId: existing[0]!.providerId,
        actor: { userId: req.user!.sub, role: "admin" },
        context: {},
      });

      return updatedRows;
    });

    res.json({ doc: updated });
  }
);

// ── GET /admin/verification/events (recent credential decisions, read-only) ──
//
// Honesty boundary: verification_docs has no separate event table. This feed
// is the set of documents that carry a reviewer decision (status approved or
// rejected + reviewedAt), newest decision first. Reviewer notes and emails are
// excluded from the projection.

router.get(
  "/verification/events",
  async (req: Request, res: Response): Promise<void> => {
    const rawLimit = req.query["limit"] === undefined ? 10 : Number(req.query["limit"]);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      res.status(400).json({ error: "limit must be an integer between 1 and 50." });
      return;
    }
    const rows = await db
      .select({
        id: verificationDocsTable.id,
        docType: verificationDocsTable.docType,
        status: verificationDocsTable.status,
        submittedAt: verificationDocsTable.submittedAt,
        reviewedAt: verificationDocsTable.reviewedAt,
        provider: {
          id: providerProfilesTable.id,
          userId: providerProfilesTable.userId,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          verificationStatus: providerProfilesTable.verificationStatus,
        },
      })
      .from(verificationDocsTable)
      .innerJoin(providerProfilesTable, eq(verificationDocsTable.providerId, providerProfilesTable.id))
      .innerJoin(usersTable, eq(providerProfilesTable.userId, usersTable.id))
      .where(inArray(verificationDocsTable.status, ["approved", "rejected"]))
      .orderBy(desc(verificationDocsTable.reviewedAt), desc(verificationDocsTable.id))
      .limit(rawLimit);

    res.json({
      items: rows.map((r) => ({
        ...r,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  },
);

// ── GET /admin/support/escalations (open support requests, read-only) ────────
//
// Command-center feed of support tickets. Default filter `unresolved` = open +
// in_progress, oldest first so nothing sits unanswered. Resolution happens via
// the existing PATCH /support/escalations/:ticketId (admin-gated, audit-logged).

const TICKET_FILTERS = ["unresolved", "open", "in_progress", "resolved", "all"] as const;

router.get(
  "/support/escalations",
  async (req: Request, res: Response): Promise<void> => {
    const filter = (req.query["status"] as string | undefined) ?? "unresolved";
    if (!TICKET_FILTERS.includes(filter as (typeof TICKET_FILTERS)[number])) {
      res.status(400).json({ error: `status must be one of: ${TICKET_FILTERS.join(", ")}.` });
      return;
    }
    const rawLimit = req.query["limit"] === undefined ? 50 : Number(req.query["limit"]);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
      res.status(400).json({ error: "limit must be an integer between 1 and 200." });
      return;
    }

    const where =
      filter === "all"
        ? undefined
        : filter === "unresolved"
          ? inArray(supportTicketsTable.status, ["open", "in_progress"])
          : eq(supportTicketsTable.status, filter as "open" | "in_progress" | "resolved");

    const base = db
      .select({
        id: supportTicketsTable.id,
        subject: supportTicketsTable.subject,
        status: supportTicketsTable.status,
        bookingId: supportTicketsTable.bookingId,
        createdAt: supportTicketsTable.createdAt,
        updatedAt: supportTicketsTable.updatedAt,
        requester: {
          userId: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
        },
      })
      .from(supportTicketsTable)
      .innerJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id));
    const tickets = await (where ? base.where(where) : base)
      .orderBy(
        filter === "resolved" || filter === "all"
          ? desc(supportTicketsTable.updatedAt)
          : sql`${supportTicketsTable.createdAt} asc`,
      )
      .limit(rawLimit);

    const countQuery = db.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable);
    const [countRow] = await (where ? countQuery.where(where) : countQuery);

    const ticketIds = tickets.map((t) => t.id);
    const messages = ticketIds.length
      ? await db
          .select({
            id: supportMessagesTable.id,
            ticketId: supportMessagesTable.ticketId,
            userId: supportMessagesTable.userId,
            message: supportMessagesTable.message,
            createdAt: supportMessagesTable.createdAt,
            authorRole: usersTable.role,
          })
          .from(supportMessagesTable)
          .innerJoin(usersTable, eq(supportMessagesTable.userId, usersTable.id))
          .where(inArray(supportMessagesTable.ticketId, ticketIds))
          .orderBy(desc(supportMessagesTable.createdAt), desc(supportMessagesTable.id))
      : [];
    const latestByTicket = new Map<number, (typeof messages)[number]>();
    const countByTicket = new Map<number, number>();
    for (const m of messages) {
      countByTicket.set(m.ticketId, (countByTicket.get(m.ticketId) ?? 0) + 1);
      if (!latestByTicket.has(m.ticketId)) latestByTicket.set(m.ticketId, m);
    }

    res.json({
      items: tickets.map((t) => {
        const latest = latestByTicket.get(t.id);
        return {
          id: t.id,
          subject: t.subject,
          status: t.status,
          bookingId: t.bookingId,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          requester: t.requester,
          messageCount: countByTicket.get(t.id) ?? 0,
          latestMessage: latest
            ? {
                message: latest.message.slice(0, 280),
                createdAt: latest.createdAt.toISOString(),
                fromAdmin: latest.authorRole === "admin",
              }
            : null,
        };
      }),
      total: countRow?.count ?? 0,
    });
  },
);

// ── GET /admin/provider-applications (read-only queue feed) ──────────────────
//
// Admin command-center feed: applications in one status, oldest submission
// first, with a minimal applicant summary. Reviewer-private `reviewerNotes`
// and the provider-visible `rejectionReason` are deliberately excluded from
// this list projection (the decision endpoints return them).

const APPLICATION_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "suspended",
] as const;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

router.get(
  "/provider-applications",
  async (req: Request, res: Response): Promise<void> => {
    const statusFilter = (req.query["status"] as string | undefined) ?? "under_review";
    if (!APPLICATION_STATUSES.includes(statusFilter as ApplicationStatus)) {
      res.status(400).json({
        error: `status must be one of ${APPLICATION_STATUSES.join(", ")}.`,
      });
      return;
    }
    const rawLimit = Number(req.query["limit"] ?? 50);
    const rawOffset = Number(req.query["offset"] ?? 0);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || !Number.isInteger(rawOffset) || rawOffset < 0) {
      res.status(400).json({ error: "limit must be a positive integer and offset a non-negative integer." });
      return;
    }
    const limit = Math.min(rawLimit, 200);
    const offset = rawOffset;
    const status = statusFilter as ApplicationStatus;

    const rows = await db
      .select({
        application: {
          id: providerApplicationsTable.id,
          status: providerApplicationsTable.status,
          currentStep: providerApplicationsTable.currentStep,
          submittedAt: providerApplicationsTable.submittedAt,
          reviewedAt: providerApplicationsTable.reviewedAt,
          createdAt: providerApplicationsTable.createdAt,
          updatedAt: providerApplicationsTable.updatedAt,
        },
        applicant: {
          userId: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
          providerProfileId: providerProfilesTable.id,
          city: providerProfilesTable.city,
          verificationStatus: providerProfilesTable.verificationStatus,
        },
      })
      .from(providerApplicationsTable)
      .innerJoin(usersTable, eq(providerApplicationsTable.userId, usersTable.id))
      .innerJoin(
        providerProfilesTable,
        eq(providerApplicationsTable.providerProfileId, providerProfilesTable.id),
      )
      .where(eq(providerApplicationsTable.status, status))
      // Oldest waiting first: submittedAt asc (nulls last), then createdAt.
      .orderBy(
        sql`${providerApplicationsTable.submittedAt} asc nulls last`,
        sql`${providerApplicationsTable.createdAt} asc`,
      )
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.status, status));

    res.json({ items: rows, total: countRow?.count ?? 0, limit, offset });
  },
);

// ── GET /admin/provider-applications/events (recent decisions, read-only) ────
//
// Newest-first slice of the append-only lifecycle log. Only the four recorded
// transition types exist (see provider-application-events.ts); this is not a
// complete history and the UI must say so.

router.get(
  "/provider-applications/events",
  async (req: Request, res: Response): Promise<void> => {
    const rawLimit = Number(req.query["limit"] ?? 10);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      res.status(400).json({ error: "limit must be an integer between 1 and 50." });
      return;
    }

    const items = await db
      .select({
        id: providerApplicationEventsTable.id,
        providerApplicationId: providerApplicationEventsTable.providerApplicationId,
        type: providerApplicationEventsTable.type,
        fromStatus: providerApplicationEventsTable.fromStatus,
        toStatus: providerApplicationEventsTable.toStatus,
        createdAt: providerApplicationEventsTable.createdAt,
        applicant: {
          userId: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        },
      })
      .from(providerApplicationEventsTable)
      .innerJoin(usersTable, eq(providerApplicationEventsTable.userId, usersTable.id))
      .orderBy(
        sql`${providerApplicationEventsTable.createdAt} desc`,
        sql`${providerApplicationEventsTable.id} desc`,
      )
      .limit(rawLimit);

    res.json({ items });
  },
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
        providerProfileId: providerApplicationsTable.providerProfileId,
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

    // Phase 3: application status (C1) changed — emit `provider_approved` on
    // approval plus the activation flip check, in the SAME transaction as
    // the decision. Reachable only from `under_review`, so exactly one
    // `provider_approved` per real approval decision.
    await emitProviderActivationEvents(tx, {
      providerProfileId: current.providerProfileId,
      actor: { userId: reviewerId, role: "admin" },
      context: { providerApproved: decision === "approved" },
    });

    return { kind: "decided", application: updated! };
  });
}

/** Admin-scoped response projection; includes reviewer-private fields. */
function adminApplicationResponse(
  application: typeof providerApplicationsTable.$inferSelect,
  email?: EmailOutcome,
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
    ...(email ? { email } : {}),
  };
}

/**
 * After the decision committed: email the applicant from server-side records.
 * Runs outside the transaction (a mail failure never rolls back a decision);
 * the outcome is returned to the admin so the UI can state it honestly.
 */
async function emailApplicant(
  application: typeof providerApplicationsTable.$inferSelect,
  decision: "approved" | "rejected",
): Promise<EmailOutcome> {
  const [applicant] = await db
    .select({ email: usersTable.email, firstName: usersTable.firstName })
    .from(usersTable)
    .where(eq(usersTable.id, application.userId))
    .limit(1);
  if (!applicant) return { sent: false, reason: "invalid_recipient" };
  return sendApplicationDecisionEmail({
    to: applicant.email,
    firstName: applicant.firstName,
    decision,
    rejectionReason: decision === "rejected" ? application.rejectionReason : null,
  });
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
    const email = await emailApplicant(outcome.application, "approved");
    res.json(adminApplicationResponse(outcome.application, email));
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
    const email = await emailApplicant(outcome.application, "rejected");
    res.json(adminApplicationResponse(outcome.application, email));
  },
);

export default router;
