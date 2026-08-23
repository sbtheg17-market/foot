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

const MAX_SEND_ATTEMPTS = 2;

/**
 * Send a push notification to all registered Expo tokens for a user.
 * Delivery is best-effort — push delivery must never break a booking flow.
 * Retries the whole batch once, and logs only aggregate safe diagnostics.
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
    let delivered = false;
    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS && !delivered; attempt += 1) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        delivered = true;
      } catch {
        if (attempt === MAX_SEND_ATTEMPTS) {
          // Never expose provider responses or token values in application logs.
          console.warn("[push] delivery failed after bounded retry", {
            userId,
            tokenCount: chunk.length,
          });
        }
      }
    }
  }
}
