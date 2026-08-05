import { EventEmitter } from "node:events";

// ── Typed notification events ──────────────────────────────────────────────────

export interface NewBookingPayload {
  type: "new-booking";
  providerId: number;
  bookingId: number;
  city: string;
  scheduledAt: string; // ISO string
}

export type NotificationPayload = NewBookingPayload;

// ── Singleton bus ──────────────────────────────────────────────────────────────

class NotificationBus extends EventEmitter {}

export const notificationBus = new NotificationBus();

// Prevent Node from warning about many simultaneous SSE clients
notificationBus.setMaxListeners(500);

// ── Emit helpers ───────────────────────────────────────────────────────────────

export function emitNewBooking(
  payload: Omit<NewBookingPayload, "type">
): void {
  const event: NewBookingPayload = { type: "new-booking", ...payload };
  notificationBus.emit("new-booking", event);
}
