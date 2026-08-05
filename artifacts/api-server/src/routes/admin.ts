import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  verificationDocsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

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

export default router;
