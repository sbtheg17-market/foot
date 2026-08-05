import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, providerProfilesTable } from "@workspace/db";
import { verifyToken } from "../lib/jwt.js";
import {
  notificationBus,
  type NotificationPayload,
} from "../lib/notification-bus.js";

const router = Router();

// ── GET /notifications/stream — provider SSE alert stream ─────────────────────
//
// EventSource (browser) cannot send custom headers, so we accept the JWT via
// either the Authorization header (for curl / tests) or the ?token= query
// param (for the browser EventSource).

router.get(
  "/stream",
  async (req: Request, res: Response): Promise<void> => {
    // Resolve token
    let rawToken: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      rawToken = authHeader.slice(7);
    } else if (typeof req.query["token"] === "string") {
      rawToken = req.query["token"];
    }

    if (!rawToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(rawToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    if (payload.role !== "provider") {
      res.status(403).json({ error: "Only providers can subscribe to this stream" });
      return;
    }

    // Resolve the provider profile id for this user
    const rows = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, payload.sub))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Provider profile not found" });
      return;
    }

    const providerId = rows[0].id;

    // ── Open SSE connection ────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Send a connected confirmation so the client knows the stream is live
    res.write(`data: ${JSON.stringify({ type: "connected", providerId })}\n\n`);

    // Heartbeat every 25 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25_000);

    // Forward relevant events to this provider's stream
    const onEvent = (event: NotificationPayload) => {
      if (event.type === "new-booking" && event.providerId === providerId) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    notificationBus.on("new-booking", onEvent);

    // Cleanup when client disconnects
    req.on("close", () => {
      clearInterval(heartbeat);
      notificationBus.off("new-booking", onEvent);
    });
  }
);

export default router;
