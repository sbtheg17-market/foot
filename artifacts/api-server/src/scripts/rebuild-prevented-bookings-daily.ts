/**
 * Projection rebuild job — prevented_bookings_daily (Analytics Step 2,
 * Part 3). Operational procedure: docs/projection-rebuild-runbook.md.
 *
 * Rebuilds the `prevented_bookings_daily` daily aggregate projection from
 * `prevented_booking_records` (its ONLY source — this script never writes to
 * the source). The projection is replaced transactionally: either the whole
 * rebuild commits, or nothing changes.
 *
 * Usage:
 *   Dry-run (read-only; no INSERT/UPDATE/DELETE/DDL):
 *     node --import tsx/esm src/scripts/rebuild-prevented-bookings-daily.ts \
 *       --dry-run [--from YYYY-MM-DD --to YYYY-MM-DD]
 *
 *   Live full rebuild (target confirmation mandatory):
 *     node --import tsx/esm src/scripts/rebuild-prevented-bookings-daily.ts \
 *       --confirm-target <12-hex-target-fingerprint>
 *
 *   Live bounded rebuild (replaces ONLY the given inclusive UTC-day window):
 *     node --import tsx/esm src/scripts/rebuild-prevented-bookings-daily.ts \
 *       --confirm-target <12-hex> --from YYYY-MM-DD --to YYYY-MM-DD
 *   (DATABASE_URL must point at the target database.)
 *
 * Controls:
 *  - DRY RUN (`--dry-run`): computes the full report (source rows, groups
 *    that would be inserted, projection rows that would be replaced, the
 *    distinct-correlation tripwire) inside a READ ONLY transaction and
 *    performs zero writes. Labeled `DRY RUN`. `--confirm-target` is optional
 *    in a dry-run but validated and honored identically when provided
 *    (rehearsal mode).
 *  - TARGET GUARD (`--confirm-target`): the credential-free fingerprint of
 *    the connection target — the first 12 hex characters of
 *    SHA-256("host:port/dbname") derived from DATABASE_URL, the SAME
 *    algorithm as the replay script (imported from it, not re-implemented).
 *    Userinfo, query parameters, and the raw URI are never part of the
 *    fingerprint input and never appear in output. Live execution refuses to
 *    start when the confirmation is missing or mismatched.
 *  - SCOPE (`--from` / `--to`): both-or-neither, inclusive UTC calendar
 *    days (YYYY-MM-DD). Bounded mode deletes and re-inserts ONLY projection
 *    rows whose day_utc falls inside the window, from source rows whose
 *    occurred_at falls inside the same window. Without them the ENTIRE
 *    projection is rebuilt. There are deliberately NO replay-style write
 *    caps: a rebuild is a wholesale transactional replacement, not an event
 *    stream — capping it could only produce a half-replaced projection.
 *  - UTC PINNING: the rebuild transaction executes SET LOCAL TIME ZONE
 *    'UTC', and day parameters travel as plain strings — day bucketing can
 *    never drift with process or session timezone.
 *  - TRANSACTIONAL REPLACEMENT: tripwire → DELETE → INSERT…SELECT →
 *    reconciliation, all in ONE transaction; any failure rolls back and
 *    leaves the projection exactly as it was. Full rebuilds also restart the
 *    surrogate-id sequence inside the transaction and insert in
 *    deterministic grain order, so repeated full rebuilds of identical
 *    source data produce identical rows.
 *  - RECONCILIATION (inside the transaction, live mode):
 *      SUM(attempts_total)        = source COUNT(*) over the range;
 *      SUM(preflight_count)       = source COUNT WHERE path='preflight';
 *      SUM(index_violation_count) = source COUNT WHERE path='index_violation';
 *    plus the distinct-correlation tripwire
 *      COUNT(*) = COUNT(DISTINCT correlation_id)
 *    over the range (the source is unique by correlation_id by
 *    construction; a violation means source corruption — abort). Any
 *    reconciliation failure → ROLLBACK, exit 1.
 *  - ZERO SOURCE WRITES: the source table is read with SELECT only.
 *  - PRIVACY: the single summary line (`evt:
 *    prevented_bookings_daily_rebuild_summary`) carries counts, range
 *    metadata, and the target fingerprint only — never credentials,
 *    connection URIs, or row contents.
 *  - NO AUTOMATIC EXECUTION: this script runs only when explicitly invoked
 *    by an operator; nothing schedules it, and production execution is a
 *    separately authorized operation (see the runbook).
 *  - EXIT CODES (mirroring the replay script): 0 = rebuild (or dry-run)
 *    completed and reconciled; 1 = tripwire or reconciliation failure, or
 *    the transaction failed and rolled back; 2 = usage/confirmation failure
 *    (bad or missing options, malformed days, from > to, fingerprint
 *    mismatch, DATABASE_URL missing/unparseable) or database unreachable at
 *    startup (nothing touched).
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { deriveTargetFingerprint } from "./replay-prevented-bookings.js";

const FINGERPRINT_PATTERN = /^[0-9a-f]{12}$/i;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SOURCE_TABLE = "prevented_booking_records";
const PROJECTION_TABLE = "prevented_bookings_daily";

// ── CLI options (strict; unknown options are usage errors) ───────────────────

export interface RebuildCliOptions {
  readonly dryRun: boolean;
  readonly confirmTarget: string | null;
  /** Inclusive UTC-day window; both set or both null. */
  readonly fromDay: string | null;
  readonly toDay: string | null;
}

export type RebuildCliParseResult =
  | { readonly ok: true; readonly options: RebuildCliOptions }
  | { readonly ok: false; readonly reason: string };

const VALUE_OPTIONS = new Set(["--confirm-target", "--from", "--to"]);
const FLAG_OPTIONS = new Set(["--dry-run"]);

/**
 * A calendar-valid UTC day in strict YYYY-MM-DD form. The Date round-trip
 * (with an explicit Z suffix) rejects impossible days like 2026-02-30
 * regardless of process timezone.
 */
export function isValidUtcDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Strict argv parser. Every failure is a usage error (exit 2) — no partial
 * acceptance, no silent defaults for safety-relevant options.
 */
export function parseRebuildCliOptions(
  argv: readonly string[],
): RebuildCliParseResult {
  const values = new Map<string, string>();
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (FLAG_OPTIONS.has(arg)) {
      if (arg === "--dry-run") {
        if (dryRun) return { ok: false, reason: "duplicate option --dry-run" };
        dryRun = true;
      }
      continue;
    }
    if (VALUE_OPTIONS.has(arg)) {
      if (values.has(arg)) {
        return { ok: false, reason: `duplicate option ${arg}` };
      }
      const value = argv[i + 1];
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("--")
      ) {
        return { ok: false, reason: `missing value for ${arg}` };
      }
      values.set(arg, value);
      i += 1;
      continue;
    }
    return { ok: false, reason: `unknown option ${arg}` };
  }

  const confirmTarget = values.get("--confirm-target") ?? null;
  if (confirmTarget !== null && !FINGERPRINT_PATTERN.test(confirmTarget)) {
    return {
      ok: false,
      reason:
        "--confirm-target must be exactly 12 hexadecimal characters (see the dry-run report's target_fingerprint)",
    };
  }

  const fromDay = values.get("--from") ?? null;
  const toDay = values.get("--to") ?? null;
  if ((fromDay === null) !== (toDay === null)) {
    return {
      ok: false,
      reason:
        "--from and --to must be provided together (inclusive UTC-day window) or not at all (full rebuild)",
    };
  }
  if (fromDay !== null && !isValidUtcDay(fromDay)) {
    return {
      ok: false,
      reason: "--from must be a valid UTC calendar day in YYYY-MM-DD form",
    };
  }
  if (toDay !== null && !isValidUtcDay(toDay)) {
    return {
      ok: false,
      reason: "--to must be a valid UTC calendar day in YYYY-MM-DD form",
    };
  }
  if (fromDay !== null && toDay !== null && fromDay > toDay) {
    return { ok: false, reason: "--from must not be later than --to" };
  }

  if (!dryRun && confirmTarget === null) {
    return {
      ok: false,
      reason:
        "live execution requires --confirm-target <fingerprint>; run with --dry-run first to obtain the target_fingerprint",
    };
  }

  return { ok: true, options: { dryRun, confirmTarget, fromDay, toDay } };
}

// ── SQL fragments (parameterized; day values travel as plain strings) ────────

interface RangeSql {
  /** WHERE clause for the source table (occurred_at window), or "". */
  readonly sourceWhere: string;
  /** WHERE clause for the projection table (day_utc window), or "". */
  readonly projectionWhere: string;
  /** Parameters for both clauses ([] for a full rebuild). */
  readonly params: readonly string[];
}

function rangeSql(options: RebuildCliOptions): RangeSql {
  if (options.fromDay === null || options.toDay === null) {
    return { sourceWhere: "", projectionWhere: "", params: [] };
  }
  return {
    // occurred_at is timestamp WITHOUT time zone storing UTC instants;
    // [from 00:00:00, to+1day 00:00:00) covers the inclusive day window.
    sourceWhere:
      " WHERE occurred_at >= ($1::date)::timestamp AND occurred_at < ($2::date + 1)::timestamp",
    projectionWhere: " WHERE day_utc >= $1::date AND day_utc <= $2::date",
    params: [options.fromDay, options.toDay],
  };
}

interface SourceStats {
  readonly sourceRows: number;
  readonly distinctCorrelations: number;
  readonly preflightRows: number;
  readonly indexViolationRows: number;
}

interface ProjectionSums {
  readonly attemptsTotal: number;
  readonly preflightSum: number;
  readonly indexViolationSum: number;
}

const AGGREGATION_SELECT = `SELECT marketplace_id, provider_id, service_id, occurred_at::date AS day_utc,
       COUNT(*)::int AS attempts_total,
       (COUNT(*) FILTER (WHERE path = 'preflight'))::int AS preflight_count,
       (COUNT(*) FILTER (WHERE path = 'index_violation'))::int AS index_violation_count
  FROM ${SOURCE_TABLE}`;

const AGGREGATION_GROUP_BY =
  " GROUP BY marketplace_id, provider_id, service_id, occurred_at::date";

/** Deterministic insert order so full rebuilds are byte-identical. */
const AGGREGATION_ORDER_BY =
  " ORDER BY marketplace_id, provider_id NULLS FIRST, service_id NULLS FIRST, day_utc";

type QueryClient = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

async function readSourceStats(
  client: QueryClient,
  range: RangeSql,
): Promise<SourceStats> {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS source_rows,
            COUNT(DISTINCT correlation_id)::int AS distinct_correlations,
            (COUNT(*) FILTER (WHERE path = 'preflight'))::int AS preflight_rows,
            (COUNT(*) FILTER (WHERE path = 'index_violation'))::int AS index_violation_rows
       FROM ${SOURCE_TABLE}${range.sourceWhere}`,
    [...range.params],
  );
  const row = rows[0] as {
    source_rows: number;
    distinct_correlations: number;
    preflight_rows: number;
    index_violation_rows: number;
  };
  return {
    sourceRows: row.source_rows,
    distinctCorrelations: row.distinct_correlations,
    preflightRows: row.preflight_rows,
    indexViolationRows: row.index_violation_rows,
  };
}

async function readProjectionSums(
  client: QueryClient,
  range: RangeSql,
): Promise<ProjectionSums> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(attempts_total), 0)::int AS attempts_total,
            COALESCE(SUM(preflight_count), 0)::int AS preflight_sum,
            COALESCE(SUM(index_violation_count), 0)::int AS index_violation_sum
       FROM ${PROJECTION_TABLE}${range.projectionWhere}`,
    [...range.params],
  );
  const row = rows[0] as {
    attempts_total: number;
    preflight_sum: number;
    index_violation_sum: number;
  };
  return {
    attemptsTotal: row.attempts_total,
    preflightSum: row.preflight_sum,
    indexViolationSum: row.index_violation_sum,
  };
}

function usageError(reason: string): void {
  logger.error(
    { evt: "prevented_bookings_daily_rebuild_usage_error", reason },
    "usage: rebuild-prevented-bookings-daily [--dry-run] " +
      "[--confirm-target <12-hex>] [--from YYYY-MM-DD --to YYYY-MM-DD] — " +
      "--confirm-target is mandatory for live (non-dry-run) execution; " +
      "see docs/projection-rebuild-runbook.md",
  );
}

export async function main(): Promise<number> {
  const startedAt = Date.now();

  // 1) Strict option parsing — every failure exits 2 before any database
  //    access.
  const parsed = parseRebuildCliOptions(process.argv.slice(2));
  if (!parsed.ok) {
    usageError(parsed.reason);
    return 2;
  }
  const options = parsed.options;
  const mode = options.dryRun ? "DRY_RUN" : "LIVE";
  const scope = options.fromDay !== null ? "BOUNDED" : "FULL";

  // 2) Credential-free target fingerprint + target guard — checked before
  //    any database connection is attempted. Same algorithm as the replay
  //    script (imported, not re-implemented).
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    usageError("DATABASE_URL is not set");
    return 2;
  }
  const targetFingerprint = deriveTargetFingerprint(databaseUrl);
  if (targetFingerprint === null) {
    usageError(
      "DATABASE_URL could not be parsed to derive the target fingerprint",
    );
    return 2;
  }
  if (options.confirmTarget !== null) {
    if (targetFingerprint !== options.confirmTarget.toLowerCase()) {
      logger.error(
        {
          evt: "prevented_bookings_daily_rebuild_target_mismatch",
          target_fingerprint: targetFingerprint,
          confirmed_fingerprint: options.confirmTarget.toLowerCase(),
        },
        "target fingerprint mismatch — the confirmed target is not the connected target; aborting before any database access",
      );
      return 2;
    }
  }

  // 3) Fail fast if the database is unreachable at startup — nothing touched.
  try {
    await pool.query("SELECT 1");
  } catch {
    logger.error(
      { evt: "prevented_bookings_daily_rebuild_startup_error" },
      "database unreachable at startup — nothing rebuilt",
    );
    return 2;
  }

  const range = rangeSql(options);

  let sourceStats: SourceStats;
  let deleted = 0;
  let inserted = 0;
  let wouldDelete = 0;
  let wouldInsert = 0;
  let reconciliation: "passed" | "failed" | "skipped" = "skipped";
  let projectionSums: ProjectionSums = {
    attemptsTotal: 0,
    preflightSum: 0,
    indexViolationSum: 0,
  };

  const client = await pool.connect();
  try {
    if (options.dryRun) {
      // READ ONLY transaction: the database itself rejects any write this
      // path could ever attempt. SET LOCAL pins UTC for the session.
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL TIME ZONE 'UTC'");

      sourceStats = await readSourceStats(client, range);

      const wouldDeleteResult = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${PROJECTION_TABLE}${range.projectionWhere}`,
        [...range.params],
      );
      wouldDelete = (wouldDeleteResult.rows[0] as { n: number }).n;

      const wouldInsertResult = await client.query(
        `SELECT COUNT(*)::int AS n FROM (${AGGREGATION_SELECT}${range.sourceWhere}${AGGREGATION_GROUP_BY}) AS groups`,
        [...range.params],
      );
      wouldInsert = (wouldInsertResult.rows[0] as { n: number }).n;

      await client.query("ROLLBACK");

      // Tripwire is evaluated in a dry-run too: corrupted source data must
      // be reported before anyone authorizes a live rebuild.
      if (sourceStats.sourceRows !== sourceStats.distinctCorrelations) {
        logger.error(
          {
            evt: "prevented_bookings_daily_rebuild_tripwire_failed",
            source_rows: sourceStats.sourceRows,
            distinct_correlations: sourceStats.distinctCorrelations,
          },
          "distinct-correlation tripwire failed — source rows are not unique by correlation_id; investigate the source before rebuilding",
        );
        return 1;
      }
    } else {
      // Single transaction: tripwire → DELETE → INSERT…SELECT →
      // reconciliation. Any failure rolls the whole replacement back.
      await client.query("BEGIN");
      await client.query("SET LOCAL TIME ZONE 'UTC'");

      sourceStats = await readSourceStats(client, range);
      if (sourceStats.sourceRows !== sourceStats.distinctCorrelations) {
        await client.query("ROLLBACK");
        logger.error(
          {
            evt: "prevented_bookings_daily_rebuild_tripwire_failed",
            source_rows: sourceStats.sourceRows,
            distinct_correlations: sourceStats.distinctCorrelations,
          },
          "distinct-correlation tripwire failed — source rows are not unique by correlation_id; rebuild aborted before any write",
        );
        return 1;
      }

      const deleteResult = await client.query(
        `DELETE FROM ${PROJECTION_TABLE}${range.projectionWhere}`,
        [...range.params],
      );
      deleted = deleteResult.rowCount ?? 0;

      if (scope === "FULL") {
        // Deterministic surrogate ids for full rebuilds: restart the
        // sequence inside the transaction and insert in grain order, so
        // repeated full rebuilds of identical source data are byte-identical
        // rows (ids included). Bounded rebuilds replace only their window
        // and make no id-determinism claim.
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${PROJECTION_TABLE}', 'id'), 1, false)`,
        );
      }

      const insertResult = await client.query(
        `INSERT INTO ${PROJECTION_TABLE}
           (marketplace_id, provider_id, service_id, day_utc,
            attempts_total, preflight_count, index_violation_count)
         ${AGGREGATION_SELECT}${range.sourceWhere}${AGGREGATION_GROUP_BY}${AGGREGATION_ORDER_BY}`,
        [...range.params],
      );
      inserted = insertResult.rowCount ?? 0;

      projectionSums = await readProjectionSums(client, range);
      const reconciled =
        projectionSums.attemptsTotal === sourceStats.sourceRows &&
        projectionSums.preflightSum === sourceStats.preflightRows &&
        projectionSums.indexViolationSum === sourceStats.indexViolationRows;

      if (!reconciled) {
        await client.query("ROLLBACK");
        reconciliation = "failed";
        logger.error(
          {
            evt: "prevented_bookings_daily_rebuild_reconciliation_failed",
            source_rows: sourceStats.sourceRows,
            source_preflight: sourceStats.preflightRows,
            source_index_violation: sourceStats.indexViolationRows,
            projection_attempts_total: projectionSums.attemptsTotal,
            projection_preflight_sum: projectionSums.preflightSum,
            projection_index_violation_sum: projectionSums.indexViolationSum,
          },
          "reconciliation failed — projection sums do not match source counts; transaction rolled back, projection unchanged",
        );
        return 1;
      }

      await client.query("COMMIT");
      reconciliation = "passed";
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error(
      {
        evt: "prevented_bookings_daily_rebuild_transaction_failed",
        err: error,
      },
      "rebuild transaction failed and was rolled back — projection unchanged",
    );
    return 1;
  } finally {
    client.release();
  }

  // Single credential-free summary line: counts, range metadata, and the
  // target fingerprint only — never credentials, URIs, or row contents.
  const summary = {
    mode,
    scope,
    from_day: options.fromDay,
    to_day: options.toDay,
    source_rows: sourceStats.sourceRows,
    distinct_correlations: sourceStats.distinctCorrelations,
    source_preflight: sourceStats.preflightRows,
    source_index_violation: sourceStats.indexViolationRows,
    would_delete: wouldDelete,
    would_insert: wouldInsert,
    deleted,
    inserted,
    projection_attempts_total: projectionSums.attemptsTotal,
    projection_preflight_sum: projectionSums.preflightSum,
    projection_index_violation_sum: projectionSums.indexViolationSum,
    reconciliation,
    target_fingerprint: targetFingerprint,
    duration_ms: Date.now() - startedAt,
  };
  logger.info(
    { evt: "prevented_bookings_daily_rebuild_summary", ...summary },
    options.dryRun
      ? "DRY RUN — projection rebuild report (no database writes performed)"
      : "projection rebuild finished",
  );

  return 0;
}

// Run only when executed directly (node/tsx script entry); importing this
// module for unit tests never starts a rebuild.
const invokedPath = process.argv[1];
const isDirectExecution =
  typeof invokedPath === "string" &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url;

if (isDirectExecution) {
  main()
    .then(async (code) => {
      await pool.end().catch(() => undefined);
      process.exitCode = code;
    })
    .catch(async (error) => {
      logger.error(
        { evt: "prevented_bookings_daily_rebuild_fatal", err: error },
        "projection rebuild aborted",
      );
      await pool.end().catch(() => undefined);
      process.exitCode = 2;
    });
}
