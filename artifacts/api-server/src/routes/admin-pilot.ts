import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  pilotProviderRetentionTable,
  providerProfilesTable,
} from "@workspace/db";
import { computePilotMetrics, type RetentionIntent } from "../lib/pilot-metrics.js";
import { logger } from "../lib/logger.js";

/**
 * Pilot Operations Dashboard — admin-only routes (Part 1).
 *
 * Mounted UNDER the admin router's requireAuth + requireRole("admin") gate
 * (routes/admin.ts): providers and clients can never reach these handlers.
 * Reads are audit-logged like the other pilot-support admin surfaces.
 */

const router: IRouter = Router();

const RETENTION_VALUES: readonly RetentionIntent[] = ["yes", "no", "unknown"];

/** GET /admin/pilot/metrics — full pilot operations metric payload. */
router.get("/metrics", async (req: Request, res: Response): Promise<void> => {
  const metrics = await computePilotMetrics();
  // Read-only access audit trail (pilot support requirement).
  logger.info(
    { userId: req.user!.sub, route: "/admin/pilot/metrics" },
    "pilot metrics accessed",
  );
  res.json(metrics);
});

/** PATCH /admin/pilot/providers/:providerId/retention — record intent. */
router.patch(
  "/providers/:providerId/retention",
  async (req: Request, res: Response): Promise<void> => {
    const providerId = Number(req.params["providerId"]);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      res.status(400).json({ error: "providerId must be a positive integer." });
      return;
    }

    const { retentionIntent } = req.body as { retentionIntent?: unknown };
    if (
      typeof retentionIntent !== "string" ||
      !RETENTION_VALUES.includes(retentionIntent as RetentionIntent)
    ) {
      res.status(400).json({
        error: `retentionIntent must be one of: ${RETENTION_VALUES.join(", ")}.`,
      });
      return;
    }

    const [profile] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const now = new Date();
    const [row] = await db
      .insert(pilotProviderRetentionTable)
      .values({
        providerId,
        retentionIntent: retentionIntent as RetentionIntent,
        updatedBy: req.user!.sub,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pilotProviderRetentionTable.providerId,
        set: {
          retentionIntent: retentionIntent as RetentionIntent,
          updatedBy: req.user!.sub,
          updatedAt: now,
        },
      })
      .returning();

    // Write audit trail: which admin recorded which intent for which provider.
    logger.info(
      {
        userId: req.user!.sub,
        providerProfileId: providerId,
        retentionIntent,
        route: "/admin/pilot/providers/:providerId/retention",
      },
      "pilot retention intent updated",
    );

    res.json({
      retention: {
        providerId: String(providerId),
        retentionIntent: row!.retentionIntent,
        updatedAt: row!.updatedAt.toISOString(),
      },
    });
  },
);

export default router;
