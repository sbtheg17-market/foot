import { getTableColumns } from "drizzle-orm";
import { bookingsTable } from "@workspace/db";

/**
 * True when the error chain contains a PostgreSQL missing-relation error:
 * 42703 (undefined_column) or 42P01 (undefined_table). Both occur on a
 * deployed database whose Gate B-pending additive migration artifacts
 * (docs/migrations/*.sql) have not been applied yet — startup never pushes
 * schema (docs/deployment-notes.md), so schema drift is an expected,
 * recoverable deployment state, not a programming error. Drizzle wraps the
 * pg error, so the chain is walked via `cause` (same convention as
 * isUniqueViolation in routes/auth.ts).
 *
 * Shared by the provider/booking read paths hardened in the provider route
 * read audit (docs/provider-route-read-audit.md). Reads that degrade on
 * drift must return only truthful pre-artifact states (null / empty /
 * unconfigured) — never fabricated approval, readiness, or ownership.
 */
export function isSchemaDriftError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: string }).code;
    if (code === "42703" || code === "42P01") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Stable (pre-Gate-B) bookings columns. The additive columns from the frozen
 * artifacts PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql (source) and
 * CANCELLATION_NO_SHOW_SUPPORT_V1.sql (cancellation_category,
 * no_show_marked_by, no_show_marked_at) may be absent on a drifted managed
 * database; booking READS degrade them to their backfill-free defaults
 * (null) instead of failing 42703 → 500. Writes that require those columns
 * keep failing loudly — nothing is fabricated. Shared by routes/bookings.ts
 * and routes/reschedule.ts (docs/provider-route-read-audit.md).
 */
const {
  source: _driftSource,
  cancellationCategory: _driftCancellationCategory,
  noShowMarkedBy: _driftNoShowMarkedBy,
  noShowMarkedAt: _driftNoShowMarkedAt,
  ...bookingStableColumns
} = getTableColumns(bookingsTable);

export { bookingStableColumns };

export const BOOKING_DRIFT_DEFAULTS = {
  source: null,
  cancellationCategory: null,
  noShowMarkedBy: null,
  noShowMarkedAt: null,
} as const;
