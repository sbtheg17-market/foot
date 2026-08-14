/**
 * Part 2 reconciliation replay job — Analytics Step 2
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md §4 step 3).
 *
 * Replays structured `prevented_booking_record_failed` reconciliation lines
 * (from the local DLQ file or operator-exported platform log extracts) into
 * `prevented_booking_records`, idempotently by `correlation_id`.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run replay:prevented-bookings -- \
 *     --input <file.ndjson>
 *   (DATABASE_URL must point at the target database.)
 *
 * Contract:
 *  - INPUT: NDJSON; each candidate line is a JSON object with
 *    `evt: "prevented_booking_record_failed"` and the complete payload.
 *    Standard pino envelope fields (level, time, pid, hostname, msg) are
 *    tolerated; ANY other unknown top-level or payload field → invalid.
 *  - STRICT VALIDATION: exact payload keys, positive-integer ids, ISO-8601
 *    timestamps, server-UUID correlation ids, enum path values only.
 *  - IDEMPOTENT: INSERT … ON CONFLICT (correlation_id) DO NOTHING — safe to
 *    re-run any number of times; classifications are
 *    inserted | already_present | invalid | failed.
 *  - RETRY: transient database failures retried at most three times with
 *    250ms, 1s, 4s backoff; persistent failures go to `<input>.failed.ndjson`.
 *  - PRIVACY: raw input lines are NEVER echoed to logs; invalid lines are
 *    written verbatim ONLY to the local `<input>.invalid.ndjson`; audit logs
 *    carry correlation_id + classification only.
 *  - STATELESS: the original input file is never modified; no checkpoints —
 *    recovery from any interruption is simply re-running the same input.
 *  - EXIT CODES: 0 = every record inserted or already present;
 *    1 = any record invalid or failed; 2 = usage error or database
 *    unreachable at startup (input untouched).
 *  - GATE B: the target table exists on managed infrastructure only after
 *    B2 is applied under separately authorized B3. Local/scratch use only
 *    until then.
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { db, pool, preventedBookingRecordsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import {
  PREVENTED_BOOKING_FAILURE_EVT,
  type PreventedBookingFailurePayload,
  type PreventedBookingPath,
} from "../lib/prevented-booking-events.js";

const RETRY_DELAYS_MS = [250, 1_000, 4_000] as const;

/** Server-generated UUID shape (app.ts genReqId → crypto.randomUUID). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pino envelope fields tolerated around the event; anything else → invalid. */
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "evt",
  "payload",
  "level",
  "time",
  "pid",
  "hostname",
  "msg",
]);

const REQUIRED_PAYLOAD_KEYS = [
  "marketplaceId",
  "correlationId",
  "occurredAt",
  "actorUserId",
  "subjectBookingId",
  "providerId",
  "serviceId",
  "scheduledAt",
  "path",
] as const;

const ALLOWED_PATHS: ReadonlySet<string> = new Set([
  "preflight",
  "index_violation",
]);

type Classification = "inserted" | "already_present" | "invalid" | "failed";

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * Strict validation. Returns the typed payload or null (invalid). The raw
 * line content is never logged from here.
 */
function validateLine(raw: string): PreventedBookingFailurePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) return null;
  }
  if (record["evt"] !== PREVENTED_BOOKING_FAILURE_EVT) return null;

  const payload = record["payload"];
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.length !== REQUIRED_PAYLOAD_KEYS.length) return null;
  for (const key of REQUIRED_PAYLOAD_KEYS) {
    if (!(key in candidate)) return null;
  }

  if (!isPositiveInt(candidate["marketplaceId"])) return null;
  if (
    typeof candidate["correlationId"] !== "string" ||
    !UUID_PATTERN.test(candidate["correlationId"])
  ) {
    return null;
  }
  if (!isIsoTimestamp(candidate["occurredAt"])) return null;
  if (!isPositiveInt(candidate["actorUserId"])) return null;
  if (!isPositiveInt(candidate["subjectBookingId"])) return null;
  if (!isPositiveInt(candidate["providerId"])) return null;
  if (!isPositiveInt(candidate["serviceId"])) return null;
  if (!isIsoTimestamp(candidate["scheduledAt"])) return null;
  if (
    typeof candidate["path"] !== "string" ||
    !ALLOWED_PATHS.has(candidate["path"])
  ) {
    return null;
  }

  return {
    marketplaceId: candidate["marketplaceId"],
    correlationId: candidate["correlationId"],
    occurredAt: candidate["occurredAt"],
    actorUserId: candidate["actorUserId"],
    subjectBookingId: candidate["subjectBookingId"],
    providerId: candidate["providerId"],
    serviceId: candidate["serviceId"],
    scheduledAt: candidate["scheduledAt"],
    path: candidate["path"] as PreventedBookingPath,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Idempotent insert with bounded retry: one attempt plus at most three
 * retries (250ms, 1s, 4s). ON CONFLICT (correlation_id) DO NOTHING makes
 * every path replay-safe; `returning` distinguishes inserted from
 * already_present.
 */
async function insertWithRetry(
  payload: PreventedBookingFailurePayload,
): Promise<Exclude<Classification, "invalid">> {
  const row = {
    marketplaceId: payload.marketplaceId,
    correlationId: payload.correlationId,
    occurredAt: new Date(payload.occurredAt),
    actorUserId: payload.actorUserId,
    subjectBookingId: payload.subjectBookingId,
    providerId: payload.providerId,
    serviceId: payload.serviceId,
    scheduledAt: new Date(payload.scheduledAt),
    path: payload.path,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const returned = await db
        .insert(preventedBookingRecordsTable)
        .values(row)
        .onConflictDoNothing({
          target: preventedBookingRecordsTable.correlationId,
        })
        .returning({ id: preventedBookingRecordsTable.id });
      return returned.length > 0 ? "inserted" : "already_present";
    } catch {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
      }
    }
  }
  return "failed";
}

function parseInputArg(argv: readonly string[]): string | null {
  const flagIndex = argv.indexOf("--input");
  if (flagIndex === -1) return null;
  const value = argv[flagIndex + 1];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function auditRecord(
  correlationId: string | null,
  classification: Classification,
): void {
  // Audit lines carry ONLY correlation_id + classification — never raw input.
  logger.info(
    { evt: "prevented_booking_replayed", correlationId, classification },
    "replay record processed",
  );
}

async function main(): Promise<number> {
  const startedAt = Date.now();

  const inputPath = parseInputArg(process.argv.slice(2));
  if (!inputPath) {
    logger.error(
      { evt: "prevented_booking_replay_usage_error" },
      "usage: replay:prevented-bookings -- --input <file.ndjson>",
    );
    return 2;
  }

  let inputBytes: Buffer;
  try {
    inputBytes = readFileSync(inputPath);
  } catch {
    logger.error(
      { evt: "prevented_booking_replay_usage_error", inputPath },
      "input file could not be read",
    );
    return 2;
  }
  const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");

  // Fail fast if the database is unreachable at startup — input untouched.
  try {
    await pool.query("SELECT 1");
  } catch {
    logger.error(
      { evt: "prevented_booking_replay_startup_error" },
      "database unreachable at startup — no records processed",
    );
    return 2;
  }

  const invalidPath = `${inputPath}.invalid.ndjson`;
  const failedPath = `${inputPath}.failed.ndjson`;

  const counters = {
    read: 0,
    inserted: 0,
    already_present: 0,
    invalid: 0,
    failed: 0,
  };

  const lines = inputBytes.toString("utf8").split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue; // blank lines are not records
    counters.read += 1;

    const payload = validateLine(line);
    if (payload === null) {
      counters.invalid += 1;
      // Raw line goes ONLY to the local invalid file — never to logs.
      appendFileSync(invalidPath, `${line}\n`, "utf8");
      auditRecord(null, "invalid");
      continue;
    }

    const classification = await insertWithRetry(payload);
    counters[classification] += 1;
    if (classification === "failed") {
      appendFileSync(failedPath, `${line}\n`, "utf8");
    }
    auditRecord(payload.correlationId, classification);
  }

  const summary = {
    read: counters.read,
    inserted: counters.inserted,
    already_present: counters.already_present,
    invalid: counters.invalid,
    failed: counters.failed,
    input_sha256: inputSha256,
    duration_ms: Date.now() - startedAt,
  };
  logger.info(
    { evt: "prevented_booking_replay_summary", ...summary },
    "reconciliation replay finished",
  );

  return counters.invalid + counters.failed > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await pool.end().catch(() => undefined);
    process.exitCode = code;
  })
  .catch(async (error) => {
    logger.error(
      { evt: "prevented_booking_replay_fatal", err: error },
      "reconciliation replay aborted",
    );
    await pool.end().catch(() => undefined);
    process.exitCode = 2;
  });
