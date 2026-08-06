import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import { verifyToken } from "../lib/jwt.js";
import {
  loadAuthorizationContext,
  requireAuth,
} from "../middlewares/auth.js";
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

    const authz = await loadAuthorizationContext(payload.sub);
    const application = authz?.providerApplication;
    if (
      !authz ||
      authz.activeRole !== payload.role ||
      authz.activeRole !== "provider" ||
      !authz.roles.includes("provider") ||
      !application ||
      application.providerProfileUserId !== payload.sub ||
      application.status !== "approved" ||
      application.verificationStatus !== "approved"
    ) {
      res.status(403).json({
        error: "Approved provider access is required for this stream",
      });
      return;
    }

    const providerId = application.providerProfileId;

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

// ── POST /notifications/register-token — save Expo push token ─────────────────

router.post(
  "/register-token",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { token, platform } = req.body as {
      token?: unknown;
      platform?: unknown;
    };

    if (typeof token !== "string" || !token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    if (typeof platform !== "string" || !platform) {
      res.status(400).json({ error: "platform is required" });
      return;
    }

    const userId = req.user!.sub;

    // Upsert: update updatedAt if token already exists for this user
    await db
      .insert(pushTokensTable)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { updatedAt: new Date() },
      });

    res.status(200).json({ ok: true });
  }
);

// ── DELETE /notifications/register-token — remove push token on logout ─────────

router.delete(
  "/register-token",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as { token?: unknown };

    if (typeof token !== "string" || !token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    await db
      .delete(pushTokensTable)
      .where(
        and(
          eq(pushTokensTable.token, token),
          eq(pushTokensTable.userId, req.user!.sub)
        )
      );

    res.status(200).json({ ok: true });
  }
);

export default router;
