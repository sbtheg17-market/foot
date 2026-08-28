/**
 * Availability exceptions (Phase B — blocked dates only).
 *
 * A blocked date is a provider-owned "YYYY-MM-DD" marketplace-local calendar
 * date on which no NEW booking or reschedule target may land. Blocked dates
 * never modify existing bookings (consent-first rescheduling/cancellation
 * remains the only way to move them). Policy:
 * docs/availability-exceptions-policy.md.
 */

import { eq, and } from "drizzle-orm";
import { db, availabilityExceptionsTable } from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | Tx;

/** Public-facing rejection copy — truthful, no reason/PII leakage. */
export const BLOCKED_DATE_MESSAGE =
  "This provider is not taking bookings on the selected date.";

export const MAX_EXCEPTION_REASON_LENGTH = 200;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a real "YYYY-MM-DD" calendar date. */
export function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m! - 1 &&
    probe.getUTCDate() === d
  );
}

/** True when the provider has a blocked exception on `localDate` (YYYY-MM-DD). */
export async function isDateBlocked(
  executor: DbExecutor,
  providerId: number,
  localDate: string,
): Promise<boolean> {
  const [row] = await executor
    .select({ id: availabilityExceptionsTable.id })
    .from(availabilityExceptionsTable)
    .where(
      and(
        eq(availabilityExceptionsTable.providerId, providerId),
        eq(availabilityExceptionsTable.date, localDate),
        eq(availabilityExceptionsTable.type, "blocked"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** All blocked "YYYY-MM-DD" dates for a provider, as a Set (preview filtering). */
export async function loadBlockedDates(
  executor: DbExecutor,
  providerId: number,
): Promise<Set<string>> {
  const rows = await executor
    .select({ date: availabilityExceptionsTable.date })
    .from(availabilityExceptionsTable)
    .where(
      and(
        eq(availabilityExceptionsTable.providerId, providerId),
        eq(availabilityExceptionsTable.type, "blocked"),
      ),
    );
  return new Set(rows.map((r) => r.date));
}
