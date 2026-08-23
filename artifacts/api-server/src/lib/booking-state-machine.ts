/**
 * Booking status state machine.
 *
 * Single source of truth for allowed transitions and role permissions.
 * Import from here — do not duplicate in route handlers.
 */

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled"
  | "no_show";

/**
 * Allowed next statuses per role.
 * Admin can do anything (checked separately in isTransitionAllowed).
 */
export const ALLOWED_TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<"client" | "provider", BookingStatus[]>>
> = {
  requested: {
    provider: ["confirmed", "cancelled"],
    client: ["cancelled"],
  },
  confirmed: {
    // Provider time changes require client consent (docs/rescheduling-policy.md):
    // providers create a reschedule PROPOSAL instead of writing "rescheduled".
    provider: ["completed", "cancelled", "no_show"],
    client: ["cancelled", "rescheduled"],
  },
  rescheduled: {
    provider: ["confirmed", "cancelled"],
    client: ["cancelled"],
  },
  // Terminal states — no further transitions for any role
  completed: {},
  cancelled: {},
  no_show: {},
};

export const TERMINAL_STATUSES: BookingStatus[] = ["completed", "cancelled", "no_show"];

export function isTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
  role: "client" | "provider" | "admin"
): boolean {
  if (role === "admin") return true;
  const allowed = ALLOWED_TRANSITIONS[from]?.[role as "client" | "provider"] ?? [];
  return (allowed as BookingStatus[]).includes(to);
}
