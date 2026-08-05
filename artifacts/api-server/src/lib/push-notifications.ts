import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { eq } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";

const expo = new Expo();

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getExpoTokens(userId: number): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));
  return rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to all registered Expo tokens for a user.
 * Fails silently — push delivery must never break a booking flow.
 */
export async function sendPushToUser(
  userId: number,
  payload: PushPayload
): Promise<void> {
  let tokens: string[];
  try {
    tokens = await getExpoTokens(userId);
  } catch {
    return; // DB error — don't break the caller
  }

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      // Log but never rethrow — notification failure must not break the caller
      console.error("[push] send error:", err);
    }
  }
}
