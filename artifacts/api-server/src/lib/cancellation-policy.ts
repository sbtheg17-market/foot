/**
 * Cancellation and no-show policy (roadmap #13, docs/cancellation-no-show-policy.md).
 *
 * SERVER-AUTHORITATIVE: the server computes every cancellation outcome from
 * the booking's scheduled instant and the centrally managed notice window.
 * The UI presents; it never decides. Pure UTC-instant math (DST-safe) — same
 * posture as the #12 travel buffer: environment override is validated and
 * never a silent fallback.
 *
 * Payments are deferred: a "late" cancellation is RECORDED as late; no fee is
 * ever charged or implied by this module.
 */

export const DEFAULT_CANCELLATION_NOTICE_HOURS = 24;
export const MAX_CANCELLATION_NOTICE_HOURS = 168; // one week

export class InvalidCancellationNoticeError extends Error {
  constructor(value: string) {
    super(
      `CANCELLATION_NOTICE_HOURS must be an integer between 0 and ${MAX_CANCELLATION_NOTICE_HOURS}; got "${value}".`,
    );
    this.name = "InvalidCancellationNoticeError";
  }
}

/** Centrally managed notice window. Invalid overrides throw — never a silent fallback. */
export function getCancellationNoticeHours(): number {
  const override = process.env["CANCELLATION_NOTICE_HOURS"];
  if (override === undefined || override.trim() === "") {
    return DEFAULT_CANCELLATION_NOTICE_HOURS;
  }
  const value = override.trim();
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_CANCELLATION_NOTICE_HOURS
  ) {
    throw new InvalidCancellationNoticeError(value);
  }
  return parsed;
}

// ── Cancellation categories (stable identifiers — append-only history) ───────

export const CANCELLATION_CATEGORIES = [
  "client_cancelled_early",
  "client_cancelled_late",
  "provider_cancelled",
  "cancelled_by_support",
] as const;

export type CancellationCategory = (typeof CANCELLATION_CATEGORIES)[number];

/**
 * Allowlisted structured reasons a provider must give when cancelling.
 * The category is shared with the client; any free-text stays
 * support/admin-visible only (privacy rule in the policy doc).
 */
export const PROVIDER_CANCELLATION_REASON_CATEGORIES = [
  "illness",
  "emergency",
  "schedule_conflict",
  "client_request",
  "declined_request",
  "reschedule_declined",
  "other",
] as const;

export type ProviderCancellationReasonCategory =
  (typeof PROVIDER_CANCELLATION_REASON_CATEGORIES)[number];

export function isProviderCancellationReasonCategory(
  value: unknown,
): value is ProviderCancellationReasonCategory {
  return (
    typeof value === "string" &&
    (PROVIDER_CANCELLATION_REASON_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Compute the policy category for a cancellation happening `now` against a
 * booking scheduled at `scheduledAt`.
 *
 * - Client: within-notice (free) when at least the notice window remains
 *   before the appointment; otherwise recorded as late (boundary instant
 *   itself counts as EARLY — exactly `noticeHours` before is still free).
 * - Provider: always `provider_cancelled` — never penalizes the client.
 * - Admin/support: `cancelled_by_support`.
 */
export function computeCancellationCategory(
  role: "client" | "provider" | "admin",
  now: Date,
  scheduledAt: Date,
): CancellationCategory {
  if (role === "provider") return "provider_cancelled";
  if (role === "admin") return "cancelled_by_support";
  const noticeMs = getCancellationNoticeHours() * 60 * 60 * 1000;
  return scheduledAt.getTime() - now.getTime() >= noticeMs
    ? "client_cancelled_early"
    : "client_cancelled_late";
}

/** The instant until which a client cancellation is free (within notice). */
export function computeFreeCancellationDeadline(scheduledAt: Date): Date {
  return new Date(
    scheduledAt.getTime() - getCancellationNoticeHours() * 60 * 60 * 1000,
  );
}

// ── No-show rule ──────────────────────────────────────────────────────────────

/** New #13 server rule: a no-show may be recorded only AFTER the scheduled time. */
export function isNoShowMarkableNow(now: Date, scheduledAt: Date): boolean {
  return now.getTime() > scheduledAt.getTime();
}

export const NO_SHOW_TOO_EARLY_MESSAGE =
  "A no-show can only be recorded after the scheduled appointment time has passed.";

// ── Client-safe policy copy (plain language; no internal identifiers) ────────

export function getCancellationPolicySummary(): {
  noticeHours: number;
  summary: string;
} {
  const noticeHours = getCancellationNoticeHours();
  return {
    noticeHours,
    summary:
      `Free cancellation until ${noticeHours} hours before the visit. ` +
      "Later cancellations are recorded as late — no fee is charged. " +
      "If the provider cancels, it never counts against you. " +
      "Something wrong after a visit? You can ask for help from the booking.",
  };
}
