/**
 * Consent-first rescheduling policy constants and pure helpers
 * (docs/rescheduling-policy.md — approved fallback values).
 */

export const DEFAULT_PROVIDER_PROPOSAL_LIMIT = 3;

/** Reminder lead time before expiry. Documented policy value — reminder
 *  DELIVERY is not implemented (no scheduled-notification infrastructure). */
export const PROPOSAL_REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Provider-initiated proposals per booking before further changes require
 * manual review. Configurable via RESCHEDULE_PROPOSAL_LIMIT; invalid values
 * fall back to the documented default (never a hidden limit).
 */
export function getProviderProposalLimit(): number {
  const raw = process.env["RESCHEDULE_PROPOSAL_LIMIT"];
  if (raw === undefined || raw === "") return DEFAULT_PROVIDER_PROPOSAL_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PROVIDER_PROPOSAL_LIMIT;
  return parsed;
}

/**
 * Approved fallback deadline policy: 48 hours before the appointment, or —
 * when the appointment is sooner than that — 24 hours after the proposal,
 * never past the appointment itself. Pure UTC-instant math (DST-safe).
 */
export function computeProposalDeadline(now: Date, appointmentAt: Date): Date {
  const base = appointmentAt.getTime() - FORTY_EIGHT_HOURS_MS;
  if (base > now.getTime()) return new Date(base);
  return new Date(Math.min(now.getTime() + TWENTY_FOUR_HOURS_MS, appointmentAt.getTime()));
}
