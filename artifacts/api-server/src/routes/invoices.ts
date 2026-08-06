import { Router, type Request, type Response } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db, invoicesTable, providerProfilesTable } from "@workspace/db";
import {
  requireAuth,
  requireApprovedProviderIfProvider,
} from "../middlewares/auth.js";

const router = Router();

// ── GET /invoices — list own invoices (scoped by role) ────────────────────────

router.get(
  "/",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
    const offset = Number(req.query["offset"] ?? 0);

    let ownershipClause;
    const role = req.authz!.activeRole;
    if (role === "client") {
      ownershipClause = eq(invoicesTable.clientId, user.sub);
    } else if (role === "provider") {
      const profile = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, user.sub))
        .limit(1);
      if (!profile[0]) {
        res.json({ invoices: [], total: 0, limit, offset });
        return;
      }
      ownershipClause = eq(invoicesTable.providerId, profile[0].id);
    } else {
      // admin: see all
      ownershipClause = undefined;
    }

    const [invoices, countRows] = await Promise.all([
      db
        .select()
        .from(invoicesTable)
        .where(ownershipClause)
        .orderBy(sql`${invoicesTable.createdAt} desc`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoicesTable)
        .where(ownershipClause),
    ]);

    res.json({
      invoices,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  }
);

// ── GET /invoices/:invoiceId — detail (own only) ──────────────────────────────

router.get(
  "/:invoiceId",
  requireAuth,
  requireApprovedProviderIfProvider,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const invoiceId = Number(req.params["invoiceId"]);

    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .limit(1);

    const invoice = rows[0];
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }

    // Access control
    const role = req.authz!.activeRole;
    if (role === "client" && invoice.clientId !== user.sub) {
      res.status(403).json({ error: "You do not have access to this invoice." });
      return;
    }
    if (role === "provider") {
      const profile = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, user.sub))
        .limit(1);
      if (!profile[0] || invoice.providerId !== profile[0].id) {
        res.status(403).json({ error: "You do not have access to this invoice." });
        return;
      }
    }

    res.json({ invoice });
  }
);

export default router;
