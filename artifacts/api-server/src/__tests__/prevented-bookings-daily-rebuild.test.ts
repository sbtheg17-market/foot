/**
 * prevented_bookings_daily projection rebuild — focused tests.
 *
 * Verifies `src/scripts/rebuild-prevented-bookings-daily.ts`
 * (docs/projection-rebuild-runbook.md) and the projection schema:
 *  - multi-marketplace / provider / service aggregation with both path
 *    values, metrics-as-columns, and the path-sum CHECK;
 *  - empty source → 0 rows, exit 0;
 *  - NULL provider/service dimensions aggregate into one grain row and the
 *    UNIQUE NULLS NOT DISTINCT constraint rejects duplicates of that grain;
 *  - fixed UTC day boundaries (23:59:59 vs 00:00:01) and invariance to a
 *    non-UTC process timezone;
 *  - bounded --from/--to rebuilds replace ONLY their window;
 *  - repeated full rebuilds are byte-identical (deterministic ids included);
 *  - count reconciliation (SUM = source COUNT, per-path sums, the
 *    distinct-correlation tripwire) is reported in the summary;
 *  - dry-run performs zero writes; target-confirmation mismatch and
 *    malformed options are rejected with exit 2;
 *  - output is credential-free;
 *  - the frozen migration artifact hash is recorded and stable;
 *  - the changed-file scope is exactly the authorized set;
 *  - the source table is byte-untouched after a rebuild.
 *
 * Prerequisites: DATABASE_URL pointing at the seeded LOCAL scratch database
 * (never managed infrastructure). PostgreSQL 15+ (UNIQUE NULLS NOT
 * DISTINCT). Seeded provider_profiles ids 1..2 and services ids 1..2 are
 * used to satisfy source FK constraints.
 * Run: node --import tsx/esm --test src/__tests__/prevented-bookings-daily-rebuild.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import {
  isValidUtcDay,
  parseRebuildCliOptions,
} from "../scripts/rebuild-prevented-bookings-daily.js";
import { deriveTargetFingerprint } from "../scripts/replay-prevented-bookings.js";

const API_SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = resolve(API_SERVER_DIR, "../..");
const REBUILD_SCRIPT = "src/scripts/rebuild-prevented-bookings-daily.ts";
const MIGRATION_ARTIFACT = resolve(
  REPO_ROOT,
  "docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql",
);

/**
 * Frozen B2 artifact hash. Any byte change to
 * docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql fails this test on
 * purpose: the artifact is frozen and must never drift silently.
 */
const FROZEN_MIGRATION_SHA256 =
  "c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876";

/** The exact authorized change set for this milestone. */
const AUTHORIZED_FILES = new Set([
  "lib/db/src/schema/prevented-bookings-daily.ts",
  "lib/db/src/schema/index.ts",
  "docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql",
  "docs/projection-rebuild-runbook.md",
  "artifacts/api-server/src/scripts/rebuild-prevented-bookings-daily.ts",
  "artifacts/api-server/src/__tests__/prevented-bookings-daily-rebuild.test.ts",
]);

const WRONG_FINGERPRINT = "0".repeat(12);
const DAY1 = "2026-03-01";
const DAY2 = "2026-03-02";

let targetFingerprint = "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function runScript(
  args: string[],
  envOverrides: Record<string, string> = {},
) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx/esm", REBUILD_SCRIPT, ...args],
    {
      cwd: API_SERVER_DIR,
      env: { ...process.env, NODE_ENV: "production", ...envOverrides },
      encoding: "utf8",
      timeout: 180_000,
    },
  );
}

function summaryFrom(stdout: string): Record<string, unknown> {
  for (const line of stdout.split("\n")) {
    if (!line.includes("prevented_bookings_daily_rebuild_summary")) continue;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed["evt"] === "prevented_bookings_daily_rebuild_summary") {
        return parsed;
      }
    } catch {
      /* not a JSON line */
    }
  }
  assert.fail("no prevented_bookings_daily_rebuild_summary line in stdout");
}

function hasSummary(stdout: string): boolean {
  return stdout.includes("prevented_bookings_daily_rebuild_summary");
}

async function clearTables(): Promise<void> {
  await pool.query("DELETE FROM prevented_bookings_daily");
  await pool.query("DELETE FROM prevented_booking_records");
}

/**
 * Inserts a source fixture row. `occurredAt` travels as a plain
 * 'YYYY-MM-DD HH:MM:SS' string cast to timestamp (without time zone) inside
 * PostgreSQL — deliberately never a JS Date, so fixtures are process-TZ
 * independent.
 */
async function insertSource(row: {
  marketplaceId: number;
  providerId: number | null;
  serviceId: number | null;
  occurredAt: string;
  path: "preflight" | "index_violation";
}): Promise<void> {
  await pool.query(
    `INSERT INTO prevented_booking_records
       (marketplace_id, correlation_id, occurred_at, actor_user_id,
        subject_booking_id, provider_id, service_id, scheduled_at, path)
     VALUES ($1, $2, $3::timestamp, NULL, NULL, $4, $5, $3::timestamp, $6)`,
    [
      row.marketplaceId,
      randomUUID(),
      row.occurredAt,
      row.providerId,
      row.serviceId,
      row.path,
    ],
  );
}

/**
 * Full, deterministic projection dump (ids included — full rebuilds restart
 * the sequence and insert in grain order, so ids are part of the
 * byte-identical contract). day_utc is cast to text so no client-side Date
 * / timezone conversion can ever touch the comparison.
 */
async function projectionDump(): Promise<string> {
  const { rows } = await pool.query(
    `SELECT id, marketplace_id, provider_id, service_id, day_utc::text AS day_utc,
            attempts_total, preflight_count, index_violation_count
       FROM prevented_bookings_daily
      ORDER BY marketplace_id, provider_id NULLS FIRST, service_id NULLS FIRST, day_utc`,
  );
  return JSON.stringify(rows);
}

/** Full source dump with all timestamps as text — byte-untouched checks. */
async function sourceDump(): Promise<string> {
  const { rows } = await pool.query(
    `SELECT id, marketplace_id, correlation_id, occurred_at::text AS occurred_at,
            recorded_at::text AS recorded_at, actor_user_id, subject_booking_id,
            provider_id, service_id, scheduled_at::text AS scheduled_at, path
       FROM prevented_booking_records
      ORDER BY id`,
  );
  return JSON.stringify(rows);
}

async function projectionCount(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM prevented_bookings_daily",
  );
  return (rows[0] as { n: number }).n;
}

async function grainRow(
  marketplaceId: number,
  providerId: number | null,
  serviceId: number | null,
  dayUtc: string,
): Promise<
  | {
      id: number;
      attempts_total: number;
      preflight_count: number;
      index_violation_count: number;
    }
  | undefined
> {
  const { rows } = await pool.query(
    `SELECT id, attempts_total, preflight_count, index_violation_count
       FROM prevented_bookings_daily
      WHERE marketplace_id = $1
        AND provider_id IS NOT DISTINCT FROM $2
        AND service_id IS NOT DISTINCT FROM $3
        AND day_utc = $4::date`,
    [marketplaceId, providerId, serviceId, dayUtc],
  );
  return rows[0] as
    | {
        id: number;
        attempts_total: number;
        preflight_count: number;
        index_violation_count: number;
      }
    | undefined;
}

/** The standard 12-row fixture matrix (8 grains across 2 days). */
async function insertFixtureMatrix(): Promise<void> {
  const rows: Parameters<typeof insertSource>[0][] = [
    // (1,1,1,DAY1): 3 attempts = 2 preflight + 1 index_violation
    { marketplaceId: 1, providerId: 1, serviceId: 1, occurredAt: `${DAY1} 10:00:00`, path: "preflight" },
    { marketplaceId: 1, providerId: 1, serviceId: 1, occurredAt: `${DAY1} 11:00:00`, path: "preflight" },
    { marketplaceId: 1, providerId: 1, serviceId: 1, occurredAt: `${DAY1} 12:00:00`, path: "index_violation" },
    // (1,1,2,DAY1): 1 preflight — distinct service dimension
    { marketplaceId: 1, providerId: 1, serviceId: 2, occurredAt: `${DAY1} 10:30:00`, path: "preflight" },
    // (1,2,1,DAY1): 1 index_violation — distinct provider dimension
    { marketplaceId: 1, providerId: 2, serviceId: 1, occurredAt: `${DAY1} 09:00:00`, path: "index_violation" },
    // (2,1,1,DAY1): 2 preflight — distinct marketplace (tenant isolation)
    { marketplaceId: 2, providerId: 1, serviceId: 1, occurredAt: `${DAY1} 08:00:00`, path: "preflight" },
    { marketplaceId: 2, providerId: 1, serviceId: 1, occurredAt: `${DAY1} 08:05:00`, path: "preflight" },
    // (1,1,1,DAY2): 1 preflight — distinct day
    { marketplaceId: 1, providerId: 1, serviceId: 1, occurredAt: `${DAY2} 10:00:00`, path: "preflight" },
    // UTC day boundary: 23:59:59 belongs to DAY1, 00:00:01 to DAY2
    { marketplaceId: 1, providerId: 2, serviceId: 2, occurredAt: `${DAY1} 23:59:59`, path: "preflight" },
    { marketplaceId: 1, providerId: 2, serviceId: 2, occurredAt: `${DAY2} 00:00:01`, path: "index_violation" },
    // Anonymized dimensions: NULL provider + NULL service, same grain
    { marketplaceId: 1, providerId: null, serviceId: null, occurredAt: `${DAY1} 14:00:00`, path: "preflight" },
    { marketplaceId: 1, providerId: null, serviceId: null, occurredAt: `${DAY1} 15:00:00`, path: "index_violation" },
  ];
  for (const row of rows) {
    await insertSource(row);
  }
}

// Fixture matrix expectations.
const FIXTURE_SOURCE_ROWS = 12;
const FIXTURE_GROUPS = 8;
const FIXTURE_PREFLIGHT = 8;
const FIXTURE_INDEX_VIOLATION = 4;

// ── Suites (ordered; state flows top to bottom) ──────────────────────────────

describe("Setup", () => {
  before(async () => {
    assert.ok(
      process.env["DATABASE_URL"],
      "DATABASE_URL must point at the local scratch database",
    );
    const derived = deriveTargetFingerprint(process.env["DATABASE_URL"]!);
    assert.ok(derived, "fingerprint must derive from the scratch DATABASE_URL");
    targetFingerprint = derived;
    await clearTables();
  });

  it("resolved the target fingerprint", () => {
    assert.match(targetFingerprint, /^[0-9a-f]{12}$/);
  });
});

describe("CLI validation (strict, fail-fast, exit 2)", () => {
  it("isValidUtcDay accepts real UTC days and rejects impossible ones", () => {
    assert.equal(isValidUtcDay("2026-02-28"), true);
    assert.equal(isValidUtcDay("2028-02-29"), true); // leap year
    assert.equal(isValidUtcDay("2026-02-29"), false); // not a leap year
    assert.equal(isValidUtcDay("2026-02-30"), false);
    assert.equal(isValidUtcDay("2026-13-01"), false);
    assert.equal(isValidUtcDay("2026-3-01"), false);
    assert.equal(isValidUtcDay("20260301"), false);
    assert.equal(isValidUtcDay("2026-03-01T00:00:00Z"), false);
  });

  it("rejects unknown options, duplicates, and malformed values", () => {
    assert.equal(parseRebuildCliOptions(["--dryrun"]).ok, false);
    assert.equal(parseRebuildCliOptions(["--max-writes", "10"]).ok, false);
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--dry-run"]).ok,
      false,
    );
    assert.equal(
      parseRebuildCliOptions([
        "--dry-run", "--confirm-target", "abcdefabcdef", "--confirm-target", "abcdefabcdef",
      ]).ok,
      false,
    );
    assert.equal(parseRebuildCliOptions(["--confirm-target"]).ok, false);
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--confirm-target", "zz"]).ok,
      false,
    );
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--confirm-target", "abcdefabcdef0"]).ok,
      false,
    );
  });

  it("rejects a one-sided or inverted day window and malformed days", () => {
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--from", DAY1]).ok,
      false,
    );
    assert.equal(parseRebuildCliOptions(["--dry-run", "--to", DAY2]).ok, false);
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--from", DAY2, "--to", DAY1]).ok,
      false,
    );
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--from", "2026-02-30", "--to", DAY2]).ok,
      false,
    );
    assert.equal(
      parseRebuildCliOptions(["--dry-run", "--from", DAY1, "--to", "junk"]).ok,
      false,
    );
  });

  it("accepts a valid full-rebuild dry-run and a valid bounded live run", () => {
    const dry = parseRebuildCliOptions(["--dry-run"]);
    assert.equal(dry.ok, true);
    const live = parseRebuildCliOptions([
      "--confirm-target", "abcdefabcdef", "--from", DAY1, "--to", DAY2,
    ]);
    assert.equal(live.ok, true);
    if (live.ok) {
      assert.equal(live.options.fromDay, DAY1);
      assert.equal(live.options.toDay, DAY2);
    }
  });

  it("live execution without --confirm-target is rejected (parse level and spawned, exit 2)", async () => {
    assert.equal(parseRebuildCliOptions([]).ok, false);
    const result = runScript([]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(
      result.stdout.includes("prevented_bookings_daily_rebuild_usage_error"),
    );
    assert.ok(!hasSummary(result.stdout));
  });

  it("spawned malformed options are rejected (exit 2, no summary)", async () => {
    for (const args of [
      ["--unknown-option"],
      ["--dry-run", "--from", DAY1],
      ["--dry-run", "--from", DAY2, "--to", DAY1],
      ["--dry-run", "--confirm-target", "not-hex-here"],
    ]) {
      const result = runScript(args);
      assert.equal(
        result.status,
        2,
        `args ${args.join(" ")}: ${result.stdout}${result.stderr}`,
      );
      assert.ok(!hasSummary(result.stdout));
    }
  });
});

describe("Target guard", () => {
  it("live fingerprint mismatch is rejected before any database write (exit 2)", async () => {
    await insertSource({
      marketplaceId: 1,
      providerId: 1,
      serviceId: 1,
      occurredAt: `${DAY1} 06:00:00`,
      path: "preflight",
    });
    const result = runScript(["--confirm-target", WRONG_FINGERPRINT]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(
      result.stdout.includes("prevented_bookings_daily_rebuild_target_mismatch"),
    );
    assert.ok(!hasSummary(result.stdout));
    assert.equal(await projectionCount(), 0, "nothing may be written");
    await clearTables();
  });

  it("dry-run rehearsal honors a mismatched fingerprint identically (exit 2)", () => {
    const result = runScript(["--dry-run", "--confirm-target", WRONG_FINGERPRINT]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(!hasSummary(result.stdout));
  });
});

describe("Empty source", () => {
  it("full rebuild of an empty source produces 0 rows and exits 0", async () => {
    assert.equal(await projectionCount(), 0);
    const result = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["mode"], "LIVE");
    assert.equal(summary["scope"], "FULL");
    assert.equal(summary["source_rows"], 0);
    assert.equal(summary["deleted"], 0);
    assert.equal(summary["inserted"], 0);
    assert.equal(summary["reconciliation"], "passed");
    assert.equal(await projectionCount(), 0);
  });
});

describe("Aggregation correctness (multi-tenant, both paths, UTC day boundaries)", () => {
  before(async () => {
    await clearTables();
    await insertFixtureMatrix();
  });

  it("full rebuild aggregates every grain with correct metric columns", async () => {
    const result = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["source_rows"], FIXTURE_SOURCE_ROWS);
    assert.equal(summary["inserted"], FIXTURE_GROUPS);
    assert.equal(await projectionCount(), FIXTURE_GROUPS);

    const m1p1s1d1 = await grainRow(1, 1, 1, DAY1);
    assert.deepEqual(
      {
        attempts_total: m1p1s1d1?.attempts_total,
        preflight_count: m1p1s1d1?.preflight_count,
        index_violation_count: m1p1s1d1?.index_violation_count,
      },
      { attempts_total: 3, preflight_count: 2, index_violation_count: 1 },
    );

    const m1p1s2d1 = await grainRow(1, 1, 2, DAY1);
    assert.equal(m1p1s2d1?.attempts_total, 1);
    assert.equal(m1p1s2d1?.preflight_count, 1);

    const m1p2s1d1 = await grainRow(1, 2, 1, DAY1);
    assert.equal(m1p2s1d1?.attempts_total, 1);
    assert.equal(m1p2s1d1?.index_violation_count, 1);

    const m2p1s1d1 = await grainRow(2, 1, 1, DAY1);
    assert.equal(m2p1s1d1?.attempts_total, 2);
    assert.equal(m2p1s1d1?.preflight_count, 2);

    const m1p1s1d2 = await grainRow(1, 1, 1, DAY2);
    assert.equal(m1p1s1d2?.attempts_total, 1);
  });

  it("23:59:59 and 00:00:01 land on their own UTC days", async () => {
    const day1Row = await grainRow(1, 2, 2, DAY1);
    const day2Row = await grainRow(1, 2, 2, DAY2);
    assert.equal(day1Row?.attempts_total, 1);
    assert.equal(day1Row?.preflight_count, 1);
    assert.equal(day2Row?.attempts_total, 1);
    assert.equal(day2Row?.index_violation_count, 1);
  });

  it("NULL provider/service rows aggregate into one anonymized grain row", async () => {
    const anonymized = await grainRow(1, null, null, DAY1);
    assert.deepEqual(
      {
        attempts_total: anonymized?.attempts_total,
        preflight_count: anonymized?.preflight_count,
        index_violation_count: anonymized?.index_violation_count,
      },
      { attempts_total: 2, preflight_count: 1, index_violation_count: 1 },
    );
  });

  it("summary reconciles: totals and per-path sums match source counts", async () => {
    const result = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(result.status, 0);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["source_rows"], FIXTURE_SOURCE_ROWS);
    assert.equal(summary["distinct_correlations"], FIXTURE_SOURCE_ROWS);
    assert.equal(summary["source_preflight"], FIXTURE_PREFLIGHT);
    assert.equal(summary["source_index_violation"], FIXTURE_INDEX_VIOLATION);
    assert.equal(summary["projection_attempts_total"], FIXTURE_SOURCE_ROWS);
    assert.equal(summary["projection_preflight_sum"], FIXTURE_PREFLIGHT);
    assert.equal(
      summary["projection_index_violation_sum"],
      FIXTURE_INDEX_VIOLATION,
    );
    assert.equal(summary["reconciliation"], "passed");
  });
});

describe("Database-enforced invariants", () => {
  it("the UNIQUE NULLS NOT DISTINCT grain rejects duplicates of the anonymized grain", async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO prevented_bookings_daily
           (marketplace_id, provider_id, service_id, day_utc,
            attempts_total, preflight_count, index_violation_count)
         VALUES (1, NULL, NULL, $1::date, 1, 1, 0)`,
        [DAY1],
      ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "23505");
        return true;
      },
      "a second NULL-dimension row for the same grain must violate the unique constraint",
    );
  });

  it("the path-sum CHECK rejects rows where the paths do not account for every attempt", async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO prevented_bookings_daily
           (marketplace_id, provider_id, service_id, day_utc,
            attempts_total, preflight_count, index_violation_count)
         VALUES (99, 1, 1, $1::date, 3, 1, 1)`,
        [DAY1],
      ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "23514");
        return true;
      },
    );
  });
});

describe("Repeated-rebuild idempotency (byte-identical)", () => {
  it("two consecutive full rebuilds produce byte-identical projections, ids included", async () => {
    const first = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const dumpA = await projectionDump();

    const second = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    const dumpB = await projectionDump();

    assert.equal(dumpA, dumpB, "full rebuilds must be byte-identical");
  });
});

describe("Process timezone invariance", () => {
  it("a full rebuild under a non-UTC process timezone is byte-identical", async () => {
    const utcRun = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(utcRun.status, 0, utcRun.stdout + utcRun.stderr);
    const utcDump = await projectionDump();

    // Half-hour-offset timezone stresses day bucketing hardest.
    const offsetRun = runScript(["--confirm-target", targetFingerprint], {
      TZ: "Asia/Kolkata",
    });
    assert.equal(offsetRun.status, 0, offsetRun.stdout + offsetRun.stderr);
    const offsetDump = await projectionDump();
    assert.equal(utcDump, offsetDump);

    const negativeOffsetRun = runScript(["--confirm-target", targetFingerprint], {
      TZ: "America/New_York",
    });
    assert.equal(negativeOffsetRun.status, 0);
    assert.equal(await projectionDump(), utcDump);
  });
});

describe("Dry-run", () => {
  it("performs zero writes, reports would_delete/would_insert, and is labeled DRY RUN", async () => {
    const beforeDump = await projectionDump();
    const result = runScript(["--dry-run"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["mode"], "DRY_RUN");
    assert.equal(summary["would_delete"], FIXTURE_GROUPS);
    assert.equal(summary["would_insert"], FIXTURE_GROUPS);
    assert.equal(summary["deleted"], 0);
    assert.equal(summary["inserted"], 0);
    assert.equal(summary["source_rows"], FIXTURE_SOURCE_ROWS);
    assert.ok(
      (result.stdout.match(/DRY RUN/g) ?? []).length > 0,
      "report must be clearly labeled DRY RUN",
    );
    assert.equal(await projectionDump(), beforeDump, "dry-run must never write");
  });

  it("rehearses the full confirmation set and a bounded window without writing", async () => {
    const beforeDump = await projectionDump();
    const rehearsal = runScript([
      "--dry-run",
      "--confirm-target", targetFingerprint,
      "--from", DAY1,
      "--to", DAY1,
    ]);
    assert.equal(rehearsal.status, 0, rehearsal.stdout + rehearsal.stderr);
    const summary = summaryFrom(rehearsal.stdout);
    assert.equal(summary["scope"], "BOUNDED");
    assert.equal(summary["from_day"], DAY1);
    assert.equal(summary["to_day"], DAY1);
    // 6 of the 8 grains are DAY1 grains; 10 of the 12 source rows are DAY1.
    assert.equal(summary["would_delete"], 6);
    assert.equal(summary["would_insert"], 6);
    assert.equal(summary["source_rows"], 10);
    assert.equal(await projectionDump(), beforeDump);
  });
});

describe("Source table is never written", () => {
  it("the source is byte-untouched by dry-run and live full rebuild", async () => {
    const beforeSource = await sourceDump();
    assert.equal(runScript(["--dry-run"]).status, 0);
    assert.equal(await sourceDump(), beforeSource);
    assert.equal(runScript(["--confirm-target", targetFingerprint]).status, 0);
    assert.equal(
      await sourceDump(),
      beforeSource,
      "rebuild must perform zero source writes",
    );
  });
});

describe("Bounded rebuild replaces only its window", () => {
  it("re-aggregates the window and leaves rows outside it untouched, ids included", async () => {
    // Rows outside the DAY1 window, captured with their surrogate ids.
    const day2BeforeA = await grainRow(1, 1, 1, DAY2);
    const day2BeforeB = await grainRow(1, 2, 2, DAY2);
    assert.ok(day2BeforeA && day2BeforeB);

    // New source activity inside the DAY1 window.
    await insertSource({
      marketplaceId: 1,
      providerId: 1,
      serviceId: 1,
      occurredAt: `${DAY1} 13:00:00`,
      path: "preflight",
    });

    const result = runScript([
      "--confirm-target", targetFingerprint,
      "--from", DAY1,
      "--to", DAY1,
    ]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["scope"], "BOUNDED");
    assert.equal(summary["deleted"], 6);
    assert.equal(summary["inserted"], 6);
    assert.equal(summary["source_rows"], 11); // 10 DAY1 rows + the new one
    assert.equal(summary["reconciliation"], "passed");

    // Window content re-aggregated.
    const updated = await grainRow(1, 1, 1, DAY1);
    assert.deepEqual(
      {
        attempts_total: updated?.attempts_total,
        preflight_count: updated?.preflight_count,
        index_violation_count: updated?.index_violation_count,
      },
      { attempts_total: 4, preflight_count: 3, index_violation_count: 1 },
    );

    // Rows outside the window untouched — same ids, same values.
    const day2AfterA = await grainRow(1, 1, 1, DAY2);
    const day2AfterB = await grainRow(1, 2, 2, DAY2);
    assert.deepEqual(day2AfterA, day2BeforeA);
    assert.deepEqual(day2AfterB, day2BeforeB);
    assert.equal(await projectionCount(), FIXTURE_GROUPS);
  });
});

describe("Credential-free output", () => {
  it("neither dry-run nor live output contains credentials, URIs, or auth material", async () => {
    const live = runScript(["--confirm-target", targetFingerprint]);
    assert.equal(live.status, 0);
    const dry = runScript(["--dry-run"]);
    assert.equal(dry.status, 0);

    const url = new URL(process.env["DATABASE_URL"]!);
    for (const output of [live.stdout + live.stderr, dry.stdout + dry.stderr]) {
      if (url.password) assert.ok(!output.includes(url.password));
      if (url.username && url.password) {
        assert.ok(!output.includes(`${url.username}:${url.password}`));
      }
      assert.ok(!output.includes("postgres://"));
      assert.ok(!output.includes("postgresql://"));
      assert.ok(!/authorization/i.test(output));
      assert.ok(!/Bearer /.test(output));
    }
  });
});

describe("Frozen migration artifact", () => {
  it("hash is recorded and stable (frozen B2 artifact)", () => {
    const artifact = readFileSync(MIGRATION_ARTIFACT);
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    assert.equal(
      sha256,
      FROZEN_MIGRATION_SHA256,
      "docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql changed — the B2 artifact is frozen and must not drift",
    );
  });

  it("keeps the B2 conventions: additive-only, single transaction, no IF NOT EXISTS, no DOWN", () => {
    const text = readFileSync(MIGRATION_ARTIFACT, "utf8");
    const executable = text
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    assert.equal((executable.match(/\bBEGIN;/g) ?? []).length, 1);
    assert.equal((executable.match(/\bCOMMIT;/g) ?? []).length, 1);
    assert.equal((executable.match(/CREATE TABLE/g) ?? []).length, 1);
    assert.ok(!/IF NOT EXISTS/i.test(executable));
    assert.ok(!/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i.test(executable));
    assert.ok(executable.includes("UNIQUE NULLS NOT DISTINCT"));
    assert.ok(
      executable.includes(
        "CHECK (attempts_total = preflight_count + index_violation_count)",
      ),
    );
  });
});

describe("Changed-file scope", () => {
  it("every changed or new file is inside the exact authorized set", () => {
    const collected = new Set<string>();

    const status = spawnSync("git", ["status", "--porcelain=v1"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(status.status, 0, status.stderr);
    for (const line of status.stdout.split("\n")) {
      if (line.trim().length === 0) continue;
      // "XY path" or "XY old -> new" for renames.
      const raw = line.slice(3);
      const path = raw.includes(" -> ") ? raw.split(" -> ")[1]! : raw;
      collected.add(path.trim());
    }

    const diff = spawnSync("git", ["diff", "--name-only", "main"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    if (diff.status === 0) {
      for (const line of diff.stdout.split("\n")) {
        if (line.trim().length > 0) collected.add(line.trim());
      }
    }

    for (const path of collected) {
      assert.ok(
        AUTHORIZED_FILES.has(path),
        `unauthorized changed file: ${path}`,
      );
    }
  });
});

after(async () => {
  await pool.end().catch(() => undefined);
});
