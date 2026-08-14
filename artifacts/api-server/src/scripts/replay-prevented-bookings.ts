/**
 * Part 2 reconciliation replay job — Analytics Step 2
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md §4 step 3), hardened with
 * Gate 3 replay-safety controls. Operational procedure: docs/replay-runbook.md.
 *
 * Replays structured `prevented_booking_record_failed` reconciliation lines
 * (from the local DLQ file or operator-exported platform log extracts) into
 * `prevented_booking_records`, idempotently by `correlation_id`.
 *
 * Usage:
 *   Dry-run (no database writes; read-only existence checks only):
 *     pnpm --filter @workspace/api-server run replay:prevented-bookings -- \
 *       --input <file.ndjson> --dry-run
 *
 *   Live (ALL four safety options are mandatory):
 *     pnpm --filter @workspace/api-server run replay:prevented-bookings -- \
 *       --input <file.ndjson> \
 *       --confirm-target <12-hex-target-fingerprint> \
 *       --max-events <N> --max-writes <N> \
 *       --expect-sha256 <64-hex-input-hash>
 *   (DATABASE_URL must point at the target database.)
 *
 * Safety controls (Gate 3):
 *  - DRY RUN (`--dry-run`): parses and strictly validates the entire input,
 *    classifies records as `would_insert` | `already_present` via read-only
 *    existence checks by correlation_id (SELECT only — explicitly the ONLY
 *    database access a dry-run performs), performs NO INSERT/UPDATE/DELETE/DDL,
 *    and labels its report `DRY RUN`. Safety options are optional in a dry-run
 *    but are validated and honored identically when provided (rehearsal mode).
 *  - TARGET GUARD (`--confirm-target`): a credential-free fingerprint of the
 *    connection target — the first 12 hex characters of
 *    SHA-256("host:port/dbname") derived from DATABASE_URL. Userinfo
 *    (username/password), query parameters, and the raw URI are NEVER part of
 *    the fingerprint input and never appear in output. Live execution refuses
 *    to start when the confirmation is missing or mismatched. The fingerprint
 *    proves the operator confirmed the intended target without exposing any
 *    credential material.
 *  - SCOPE CAPS (`--max-events`, `--max-writes`): both mandatory for live
 *    execution; positive safe integers only. If the input contains more
 *    record lines than --max-events, the job aborts BEFORE any write. When
 *    the number of inserted rows reaches --max-writes, the job stops safely,
 *    reports the remaining records as `unprocessed`, and exits nonzero —
 *    it never silently continues beyond a cap.
 *  - INPUT HASH PRE-APPROVAL (`--expect-sha256`): mandatory for live
 *    execution; the SHA-256 of the input file is computed before processing
 *    and any mismatch aborts before a single record is processed. The report
 *    carries computed hash, expected hash, byte count, record-line count and
 *    the input file basename only — never event contents.
 *
 * Contract (preserved from the reviewed Part 2 implementation):
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
 *    There is no whole-job automatic retry.
 *  - PRIVACY: raw input lines are NEVER echoed to logs; invalid lines are
 *    written verbatim ONLY to the local `<input>.invalid.ndjson`; audit logs
 *    carry correlation_id + classification only. No credential, token, or
 *    authorization material ever appears in output.
 *  - STATELESS: the original input file is never modified; no checkpoints —
 *    recovery from any interruption is simply re-running the same input.
 *  - EXIT CODES: 0 = every record inserted/would_insert or already present;
 *    1 = any record invalid or failed, or a write-cap stop left records
 *    unprocessed; 2 = usage/confirmation failure (bad or missing options,
 *    unreadable input, input-hash mismatch, target-fingerprint mismatch,
 *    event cap exceeded before writes) or database unreachable at startup
 *    (input untouched).
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { db, pool, preventedBookingRecordsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import {
  PREVENTED_BOOKING_FAILURE_EVT,
  type PreventedBookingFailurePayload,
  type PreventedBookingPath,
} from "../lib/prevented-booking-events.js";

const RETRY_DELAYS_MS = [250, 1_000, 4_000] as const;

/** Length of the credential-free target fingerprint (hex characters). */
export const TARGET_FINGERPRINT_LENGTH = 12;

/** Server-generated UUID shape (app.ts genReqId → crypto.randomUUID). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{12}$/i;

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

// ── CLI options (strict; unknown options are usage errors) ───────────────────

export interface ReplayCliOptions {
  readonly input: string;
  readonly dryRun: boolean;
  readonly confirmTarget: string | null;
  readonly maxEvents: number | null;
  readonly maxWrites: number | null;
  readonly expectSha256: string | null;
}

export type CliParseResult =
  | { readonly ok: true; readonly options: ReplayCliOptions }
  | { readonly ok: false; readonly reason: string };

const VALUE_OPTIONS = new Set([
  "--input",
  "--confirm-target",
  "--max-events",
  "--max-writes",
  "--expect-sha256",
]);
const FLAG_OPTIONS = new Set(["--dry-run"]);

/**
 * Parses a cap value. Accepts only strictly positive safe integers written in
 * plain decimal — rejects zero, negatives, signs, exponents, decimals,
 * whitespace, and anything beyond Number.MAX_SAFE_INTEGER.
 */
function parseCapValue(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/**
 * Strict argv parser. Every failure is a usage error (exit 2) — no partial
 * acceptance, no silent defaults for safety-relevant options.
 */
export function parseCliOptions(argv: readonly string[]): CliParseResult {
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
      if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
        return { ok: false, reason: `missing value for ${arg}` };
      }
      values.set(arg, value);
      i += 1;
      continue;
    }
    return { ok: false, reason: `unknown option ${arg}` };
  }

  const input = values.get("--input") ?? null;
  if (!input) return { ok: false, reason: "missing required option --input" };

  const confirmTarget = values.get("--confirm-target") ?? null;
  if (confirmTarget !== null && !FINGERPRINT_PATTERN.test(confirmTarget)) {
    return {
      ok: false,
      reason:
        "--confirm-target must be exactly 12 hexadecimal characters (see the dry-run report's target_fingerprint)",
    };
  }

  const expectSha256 = values.get("--expect-sha256") ?? null;
  if (expectSha256 !== null && !SHA256_PATTERN.test(expectSha256)) {
    return {
      ok: false,
      reason: "--expect-sha256 must be exactly 64 hexadecimal characters",
    };
  }

  let maxEvents: number | null = null;
  const rawMaxEvents = values.get("--max-events");
  if (rawMaxEvents !== undefined) {
    maxEvents = parseCapValue(rawMaxEvents);
    if (maxEvents === null) {
      return {
        ok: false,
        reason:
          "--max-events must be a strictly positive safe integer (zero, negative, non-numeric, and unsafe values are rejected)",
      };
    }
  }

  let maxWrites: number | null = null;
  const rawMaxWrites = values.get("--max-writes");
  if (rawMaxWrites !== undefined) {
    maxWrites = parseCapValue(rawMaxWrites);
    if (maxWrites === null) {
      return {
        ok: false,
        reason:
          "--max-writes must be a strictly positive safe integer (zero, negative, non-numeric, and unsafe values are rejected)",
      };
    }
  }

  if (!dryRun) {
    if (confirmTarget === null) {
      return {
        ok: false,
        reason:
          "live execution requires --confirm-target <fingerprint>; run with --dry-run first to obtain the target_fingerprint",
      };
    }
    if (maxEvents === null) {
      return { ok: false, reason: "live execution requires --max-events <N>" };
    }
    if (maxWrites === null) {
      return { ok: false, reason: "live execution requires --max-writes <N>" };
    }
    if (expectSha256 === null) {
      return {
        ok: false,
        reason: "live execution requires --expect-sha256 <hash>",
      };
    }
  }

  return {
    ok: true,
    options: { input, dryRun, confirmTarget, maxEvents, maxWrites, expectSha256 },
  };
}

// ── Credential-free target fingerprint ───────────────────────────────────────

/**
 * Derives the credential-free target fingerprint from a PostgreSQL connection
 * URL: the first 12 hex characters of SHA-256("host:port/dbname").
 *
 * Userinfo (username and password), query parameters, and the raw URI are
 * deliberately EXCLUDED from the hash input, so the fingerprint confirms the
 * intended target host/port/database without exposing or depending on any
 * secret material. Returns null when the URL cannot be parsed.
 */
export function deriveTargetFingerprint(databaseUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  if (!host) return null;
  const port = parsed.port !== "" ? parsed.port : "5432";
  const dbname = parsed.pathname.replace(/^\//, "");
  const material = `${host}:${port}/${dbname}`;
  return createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, TARGET_FINGERPRINT_LENGTH);
}

// ── Strict record validation (unchanged) ─────────────────────────────────────

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

/**
 * Dry-run classification: READ-ONLY existence check by correlation_id with
 * the same bounded retry budget. This SELECT is explicitly the only database
 * access a dry-run performs — no INSERT, UPDATE, DELETE, or DDL.
 */
async function existsWithRetry(
  correlationId: string,
): Promise<"would_insert" | "already_present" | "failed"> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { rows } = await pool.query(
        "SELECT 1 FROM prevented_booking_records WHERE correlation_id = $1 LIMIT 1",
        [correlationId],
      );
      return rows.length > 0 ? "already_present" : "would_insert";
    } catch {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
      }
    }
  }
  return "failed";
}

function auditRecord(
  correlationId: string | null,
  classification: Classification | "would_insert",
  dryRun: boolean,
): void {
  // Audit lines carry ONLY correlation_id + classification — never raw input.
  logger.info(
    {
      evt: "prevented_booking_replayed",
      correlationId,
      classification,
      ...(dryRun ? { dryRun: true } : {}),
    },
    dryRun ? "DRY RUN: replay record classified" : "replay record processed",
  );
}

function usageError(reason: string): void {
  logger.error(
    { evt: "prevented_booking_replay_usage_error", reason },
    "usage: replay:prevented-bookings -- --input <file.ndjson> [--dry-run] " +
      "[--confirm-target <12-hex>] [--max-events <N>] [--max-writes <N>] " +
      "[--expect-sha256 <64-hex>] — all four safety options are mandatory " +
      "for live (non-dry-run) execution; see docs/replay-runbook.md",
  );
}

export async function main(): Promise<number> {
  const startedAt = Date.now();

  // 1) Strict option parsing — every failure exits 2 before any file or
  //    database access.
  const parsed = parseCliOptions(process.argv.slice(2));
  if (!parsed.ok) {
    usageError(parsed.reason);
    return 2;
  }
  const options = parsed.options;
  const mode = options.dryRun ? "DRY_RUN" : "LIVE";

  // 2) Input read + integrity metadata — before any database access.
  let inputBytes: Buffer;
  try {
    inputBytes = readFileSync(options.input);
  } catch {
    usageError("input file could not be read");
    return 2;
  }
  const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
  const inputBasename = basename(options.input);
  const allLines = inputBytes.toString("utf8").split(/\r?\n/);
  const recordLineCount = allLines.filter((l) => l.trim().length > 0).length;

  // 3) Input-hash pre-approval — mandatory for live; honored in dry-run when
  //    provided. Mismatch aborts before ANY record is processed. Hashes and
  //    counts are safe to report; event contents never are.
  if (options.expectSha256 !== null) {
    if (inputSha256 !== options.expectSha256.toLowerCase()) {
      logger.error(
        {
          evt: "prevented_booking_replay_hash_mismatch",
          computed_sha256: inputSha256,
          expected_sha256: options.expectSha256.toLowerCase(),
          input_bytes: inputBytes.length,
          input_lines: recordLineCount,
          input_basename: inputBasename,
        },
        "input SHA-256 does not match --expect-sha256 — aborting before processing",
      );
      return 2;
    }
  }

  // 4) Credential-free target fingerprint + production-target guard — checked
  //    before any database connection is attempted.
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
          evt: "prevented_booking_replay_target_mismatch",
          target_fingerprint: targetFingerprint,
          confirmed_fingerprint: options.confirmTarget.toLowerCase(),
        },
        "target fingerprint mismatch — the confirmed target is not the connected target; aborting before any database access",
      );
      return 2;
    }
  }

  // 5) Event cap — abort BEFORE any write (and before connecting) when the
  //    input holds more record lines than --max-events.
  if (options.maxEvents !== null && recordLineCount > options.maxEvents) {
    logger.error(
      {
        evt: "prevented_booking_replay_event_cap_exceeded",
        input_lines: recordLineCount,
        max_events: options.maxEvents,
        input_sha256: inputSha256,
        input_basename: inputBasename,
      },
      "input record count exceeds --max-events — aborting before any write",
    );
    return 2;
  }

  // 6) Fail fast if the database is unreachable at startup — input untouched.
  try {
    await pool.query("SELECT 1");
  } catch {
    logger.error(
      { evt: "prevented_booking_replay_startup_error" },
      "database unreachable at startup — no records processed",
    );
    return 2;
  }

  const invalidPath = `${options.input}.invalid.ndjson`;
  const failedPath = `${options.input}.failed.ndjson`;

  const counters = {
    read: 0,
    inserted: 0,
    would_insert: 0,
    already_present: 0,
    invalid: 0,
    failed: 0,
    unprocessed: 0,
  };
  let writeCapReached = false;

  // In-file duplicate tracking so a dry-run classifies the second occurrence
  // of a correlation id as already_present, exactly like the live ON CONFLICT
  // path does.
  const dryRunSeen = new Set<string>();

  for (const line of allLines) {
    if (line.trim().length === 0) continue; // blank lines are not records

    // Write-cap stop: never silently continue beyond the cap. Remaining
    // records are counted, not processed.
    if (writeCapReached) {
      counters.unprocessed += 1;
      continue;
    }

    counters.read += 1;

    const payload = validateLine(line);
    if (payload === null) {
      counters.invalid += 1;
      // Raw line goes ONLY to the local invalid file — never to logs.
      appendFileSync(invalidPath, `${line}\n`, "utf8");
      auditRecord(null, "invalid", options.dryRun);
      continue;
    }

    if (options.dryRun) {
      let classification: "would_insert" | "already_present" | "failed";
      if (dryRunSeen.has(payload.correlationId)) {
        classification = "already_present";
      } else {
        classification = await existsWithRetry(payload.correlationId);
        if (classification === "would_insert") {
          dryRunSeen.add(payload.correlationId);
        }
      }
      counters[classification] += 1;
      if (classification === "failed") {
        appendFileSync(failedPath, `${line}\n`, "utf8");
      }
      auditRecord(payload.correlationId, classification, true);
      if (
        options.maxWrites !== null &&
        counters.would_insert >= options.maxWrites
      ) {
        writeCapReached = true;
      }
      continue;
    }

    const classification = await insertWithRetry(payload);
    counters[classification] += 1;
    if (classification === "failed") {
      appendFileSync(failedPath, `${line}\n`, "utf8");
    }
    auditRecord(payload.correlationId, classification, false);
    if (
      options.maxWrites !== null &&
      counters.inserted >= options.maxWrites
    ) {
      writeCapReached = true;
    }
  }

  const summary = {
    mode,
    read: counters.read,
    inserted: counters.inserted,
    would_insert: counters.would_insert,
    already_present: counters.already_present,
    invalid: counters.invalid,
    failed: counters.failed,
    unprocessed: counters.unprocessed,
    input_sha256: inputSha256,
    expected_sha256: options.expectSha256?.toLowerCase() ?? null,
    input_bytes: inputBytes.length,
    input_lines: recordLineCount,
    input_basename: inputBasename,
    target_fingerprint: targetFingerprint,
    max_events: options.maxEvents,
    max_writes: options.maxWrites,
    write_cap_reached: writeCapReached,
    duration_ms: Date.now() - startedAt,
  };
  logger.info(
    { evt: "prevented_booking_replay_summary", ...summary },
    options.dryRun
      ? "DRY RUN — reconciliation replay report (no database writes performed)"
      : "reconciliation replay finished",
  );

  if (counters.invalid + counters.failed > 0) return 1;
  if (counters.unprocessed > 0) return 1;
  return 0;
}

// Run only when executed directly (node/tsx script entry); importing this
// module for unit tests never starts a replay.
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
        { evt: "prevented_booking_replay_fatal", err: error },
        "reconciliation replay aborted",
      );
      await pool.end().catch(() => undefined);
      process.exitCode = 2;
    });
}
