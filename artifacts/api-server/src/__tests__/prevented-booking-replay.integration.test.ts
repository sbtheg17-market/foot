/**
 * Part 2 reconciliation replay — integration tests
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md §4 step 3; operator-approved
 * Phase 2 scope with Option A DLQ).
 *
 * Covers (LOCAL scratch PostgreSQL only — never managed infrastructure):
 *  - valid record → inserted; source-payload-to-row equality
 *  - same input replayed → already_present, single row
 *  - duplicate correlation ids within one file → one row
 *  - malformed JSON → `<input>.invalid.ndjson`
 *  - unknown / missing payload fields → `.invalid.ndjson`
 *  - invalid enum/path value → `.invalid.ndjson`
 *  - mixed input → correct partitions and exit status; input unchanged
 *  - table outage → `.failed.ndjson`, nonzero exit, input unchanged; recovery
 *  - DLQ receives the complete PII-free payload on double failure
 *  - DLQ write failure never alters the client's 409 contract
 *
 * Prerequisites: DATABASE_URL pointing at the seeded LOCAL scratch database.
 * Run: node --import tsx/esm --test src/__tests__/prevented-booking-replay.integration.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const API_SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPLAY_SCRIPT = "src/scripts/replay-prevented-bookings.ts";
const EVT = "prevented_booking_record_failed";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICATE_BOOKING_MESSAGE =
  "You already have an active request for this provider, service, and time. Check your bookings before submitting again.";
const PAYLOAD_KEYS = [
  "actorUserId",
  "correlationId",
  "marketplaceId",
  "occurredAt",
  "path",
  "providerId",
  "scheduledAt",
  "serviceId",
  "subjectBookingId",
];

const tmp = mkdtempSync(join(tmpdir(), "replay-test-"));

// Seed-derived ids satisfying the table's FK constraints (resolved in before()).
let actorUserId = 0;
let providerId = 0;
let serviceId = 0;
let subjectBookingId = 0;

let fixtureCounter = 0;

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    marketplaceId: 1,
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorUserId,
    subjectBookingId,
    providerId,
    serviceId,
    scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    path: "preflight",
    ...overrides,
  };
}

function lineFor(payload: unknown, envelope: Record<string, unknown> = {}) {
  return JSON.stringify({ evt: EVT, payload, ...envelope });
}

function writeFixture(lines: string[]): string {
  fixtureCounter += 1;
  const file = join(tmp, `fixture-${fixtureCounter}.ndjson`);
  writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return file;
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function runJob(input: string, extraEnv: Record<string, string> = {}) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", REPLAY_SCRIPT, "--input", input],
    {
      cwd: API_SERVER_DIR,
      env: { ...process.env, NODE_ENV: "production", ...extraEnv },
      encoding: "utf8",
      timeout: 180_000,
    },
  );
  return result;
}

function summaryFrom(stdout: string): Record<string, unknown> {
  for (const line of stdout.split("\n")) {
    if (!line.includes("prevented_booking_replay_summary")) continue;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed["evt"] === "prevented_booking_replay_summary") return parsed;
    } catch {
      /* not a JSON line */
    }
  }
  assert.fail("no prevented_booking_replay_summary line in job stdout");
}

async function rowsByCorrelation(correlationId: string) {
  const { rows } = await pool.query(
    "SELECT * FROM prevented_booking_records WHERE correlation_id = $1",
    [correlationId],
  );
  return rows as Array<Record<string, unknown>>;
}

async function withTableOutage(fn: () => Promise<void>): Promise<void> {
  await pool.query(
    "ALTER TABLE prevented_booking_records RENAME TO prevented_booking_records_outage_tmp",
  );
  try {
    await fn();
  } finally {
    await pool.query(
      "ALTER TABLE prevented_booking_records_outage_tmp RENAME TO prevented_booking_records",
    );
  }
}

// ── API-server child helpers (DLQ behavior tests) ────────────────────────────

const servers: ChildProcess[] = [];

async function startServer(
  port: number,
  extraEnv: Record<string, string>,
): Promise<void> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx/esm", "src/index.ts"],
    {
      cwd: API_SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        JWT_SECRET: process.env["JWT_SECRET"] ?? "local-scratch-test-secret",
        ...extraEnv,
      },
      stdio: "ignore",
    },
  );
  servers.push(child);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "jane@oncallfoot.com",
          password: "demo1234",
        }),
      });
      if (response.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.fail(`API server on port ${port} did not become ready`);
}

async function api(
  port: number,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://localhost:${port}/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function login(port: number): Promise<string> {
  const result = await api(port, "/auth/login", {
    method: "POST",
    body: { email: "jane@oncallfoot.com", password: "demo1234" },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body["token"] as string;
}

function uniqueSlot(offsetMinutes: number): string {
  const base = Date.now() + 42 * 24 * 60 * 60 * 1000;
  const jitter = (Date.now() % 100_000) * 60;
  return new Date(base + jitter + offsetMinutes * 60_000).toISOString();
}

async function createBooking(port: number, token: string, slot: string) {
  return api(port, "/bookings", {
    method: "POST",
    token,
    body: {
      providerId,
      serviceId,
      scheduledAt: slot,
      address: "42 Telemetry Street",
      city: "Toronto",
      postalCode: "M5V 2B2",
    },
  });
}

// ── Suites ───────────────────────────────────────────────────────────────────

describe("Setup", () => {
  before(async () => {
    assert.ok(
      process.env["DATABASE_URL"],
      "DATABASE_URL must point at the local scratch database",
    );
    const users = await pool.query(
      "SELECT id FROM users WHERE email = 'jane@oncallfoot.com' LIMIT 1",
    );
    assert.ok(users.rows[0], "seeded client user missing");
    actorUserId = (users.rows[0] as { id: number }).id;

    const providers = await pool.query(
      "SELECT id FROM provider_profiles ORDER BY id LIMIT 1",
    );
    assert.ok(providers.rows[0], "seeded provider profile missing");
    providerId = (providers.rows[0] as { id: number }).id;

    const services = await pool.query(
      "SELECT id FROM services ORDER BY id LIMIT 1",
    );
    assert.ok(services.rows[0], "seeded service missing");
    serviceId = (services.rows[0] as { id: number }).id;

    const bookings = await pool.query("SELECT id FROM bookings ORDER BY id LIMIT 1");
    if (bookings.rows[0]) {
      subjectBookingId = (bookings.rows[0] as { id: number }).id;
    } else {
      const inserted = await pool.query(
        `INSERT INTO bookings
           (client_id, provider_id, service_id, status, scheduled_at, address, city)
         VALUES ($1, $2, $3, 'requested', $4, '1 Fixture Way', 'Toronto')
         RETURNING id`,
        [actorUserId, providerId, serviceId, uniqueSlot(1)],
      );
      subjectBookingId = (inserted.rows[0] as { id: number }).id;
    }
  });

  it("resolved FK-valid seed identifiers", () => {
    for (const value of [actorUserId, providerId, serviceId, subjectBookingId]) {
      assert.ok(Number.isInteger(value) && value > 0);
    }
  });
});

describe("Replay: valid records and idempotency", () => {
  it("valid record → inserted with exact source-payload-to-row equality; exit 0", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);

    const result = runJob(input);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["read"], 1);
    assert.equal(summary["inserted"], 1);
    assert.equal(summary["already_present"], 0);
    assert.equal(summary["invalid"], 0);
    assert.equal(summary["failed"], 0);
    assert.equal(summary["input_sha256"], sha256(input));
    assert.ok(typeof summary["duration_ms"] === "number");

    const rows = await rowsByCorrelation(payload.correlationId);
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.equal(row["marketplace_id"], payload.marketplaceId);
    assert.equal(row["correlation_id"], payload.correlationId);
    assert.equal(row["actor_user_id"], payload.actorUserId);
    assert.equal(row["subject_booking_id"], payload.subjectBookingId);
    assert.equal(row["provider_id"], payload.providerId);
    assert.equal(row["service_id"], payload.serviceId);
    assert.equal(row["path"], payload.path);
    assert.equal(
      (row["occurred_at"] as Date).getTime(),
      new Date(payload.occurredAt).getTime(),
    );
    assert.equal(
      (row["scheduled_at"] as Date).getTime(),
      new Date(payload.scheduledAt).getTime(),
    );
  });

  it("same input replayed → already_present, still exactly one row, exit 0", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);

    assert.equal(runJob(input).status, 0);
    const rerun = runJob(input);
    assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
    const summary = summaryFrom(rerun.stdout);
    assert.equal(summary["inserted"], 0);
    assert.equal(summary["already_present"], 1);

    assert.equal((await rowsByCorrelation(payload.correlationId)).length, 1);
  });

  it("duplicate correlation ids within one file → one row, exit 0", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload), lineFor(payload)]);

    const result = runJob(input);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["read"], 2);
    assert.equal(summary["inserted"], 1);
    assert.equal(summary["already_present"], 1);

    assert.equal((await rowsByCorrelation(payload.correlationId)).length, 1);
  });

  it("tolerates the pino envelope fields on exported log lines", async () => {
    const payload = makePayload();
    const input = writeFixture([
      lineFor(payload, {
        level: 50,
        time: Date.now(),
        pid: 7,
        hostname: "container",
        msg: "prevented-booking record write failed after bounded retry — queued for reconciliation replay",
      }),
    ]);

    const result = runJob(input);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(summaryFrom(result.stdout)["inserted"], 1);
  });
});

describe("Replay: strict validation partitions", () => {
  it("malformed JSON → .invalid.ndjson, exit 1", async () => {
    const rawLine = "this is {{ not json";
    const input = writeFixture([rawLine]);

    const result = runJob(input);
    assert.equal(result.status, 1);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["invalid"], 1);
    assert.equal(summary["inserted"], 0);

    const invalidFile = `${input}.invalid.ndjson`;
    assert.ok(existsSync(invalidFile));
    assert.equal(readFileSync(invalidFile, "utf8").trim(), rawLine);
    // Raw invalid input is never echoed to logs.
    assert.ok(!result.stdout.includes("not json"));
    assert.ok(!result.stderr.includes("not json"));
  });

  it("unknown payload field → invalid; nothing inserted", async () => {
    const payload = makePayload({ email: "leak@example.com" });
    const input = writeFixture([lineFor(payload)]);

    const result = runJob(input);
    assert.equal(result.status, 1);
    assert.equal(summaryFrom(result.stdout)["invalid"], 1);
    assert.equal(
      (await rowsByCorrelation(payload.correlationId as string)).length,
      0,
    );
    assert.ok(existsSync(`${input}.invalid.ndjson`));
  });

  it("missing payload field → invalid", async () => {
    const payload = makePayload() as Record<string, unknown>;
    delete payload["providerId"];
    const input = writeFixture([lineFor(payload)]);

    const result = runJob(input);
    assert.equal(result.status, 1);
    assert.equal(summaryFrom(result.stdout)["invalid"], 1);
  });

  it("invalid path enum value → invalid", async () => {
    const payload = makePayload({ path: "sql_injection" });
    const input = writeFixture([lineFor(payload)]);

    const result = runJob(input);
    assert.equal(result.status, 1);
    assert.equal(summaryFrom(result.stdout)["invalid"], 1);
    assert.equal(
      (await rowsByCorrelation(payload.correlationId as string)).length,
      0,
    );
  });

  it("unknown top-level field → invalid", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload, { injected: true })]);

    const result = runJob(input);
    assert.equal(result.status, 1);
    assert.equal(summaryFrom(result.stdout)["invalid"], 1);
  });

  it("mixed input → correct partitions, exit 1, input unchanged", async () => {
    const good = makePayload();
    const bad = makePayload({ path: "nope" });
    const input = writeFixture([
      lineFor(good),
      "garbage-line",
      lineFor(good), // duplicate of the valid record
      lineFor(bad),
    ]);
    const before = sha256(input);

    const result = runJob(input);
    assert.equal(result.status, 1);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["read"], 4);
    assert.equal(summary["inserted"], 1);
    assert.equal(summary["already_present"], 1);
    assert.equal(summary["invalid"], 2);
    assert.equal(summary["failed"], 0);

    assert.equal(sha256(input), before, "input file must never be modified");
    const invalidLines = readFileSync(`${input}.invalid.ndjson`, "utf8")
      .trim()
      .split("\n");
    assert.equal(invalidLines.length, 2);
    assert.equal((await rowsByCorrelation(good.correlationId)).length, 1);
  });
});

describe("Replay: outage, dead-letter, recovery", () => {
  it("table outage → .failed.ndjson, nonzero exit, input unchanged; re-run recovers", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const before = sha256(input);

    await withTableOutage(async () => {
      const result = runJob(input);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const summary = summaryFrom(result.stdout);
      assert.equal(summary["failed"], 1);
      assert.equal(summary["inserted"], 0);

      const failedFile = `${input}.failed.ndjson`;
      assert.ok(existsSync(failedFile));
      assert.equal(readFileSync(failedFile, "utf8").trim(), lineFor(payload));
      assert.equal(sha256(input), before, "input file must never be modified");
    });

    // Stateless recovery: simply re-run the same input after the outage.
    const recovery = runJob(input);
    assert.equal(recovery.status, 0, recovery.stdout + recovery.stderr);
    assert.equal(summaryFrom(recovery.stdout)["inserted"], 1);
    assert.equal((await rowsByCorrelation(payload.correlationId)).length, 1);
  });
});

describe("DLQ behavior at the recording isolation boundary", () => {
  const DLQ_PORT = 8095;
  const BLOCKED_PORT = 8096;
  const dlqPath = join(tmp, "dlq-dir", "prevented-booking-dlq.ndjson");
  const blockerFile = join(tmp, "blocker");

  before(async () => {
    writeFileSync(blockerFile, "regular file blocking mkdir\n", "utf8");
    await startServer(DLQ_PORT, { PREVENTED_BOOKING_DLQ_PATH: dlqPath });
    await startServer(BLOCKED_PORT, {
      PREVENTED_BOOKING_DLQ_PATH: join(blockerFile, "sub", "dlq.ndjson"),
    });
  });

  it("writes the complete PII-free payload to the DLQ on double failure without altering the 409", async () => {
    const token = await login(DLQ_PORT);
    const slot = uniqueSlot(10);

    const created = await createBooking(DLQ_PORT, token, slot);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    // Recording healthy: 409 contract baseline, and no DLQ write occurs.
    const healthyDup = await createBooking(DLQ_PORT, token, slot);
    assert.equal(healthyDup.status, 409, JSON.stringify(healthyDup.body));
    assert.equal(healthyDup.body["error"], DUPLICATE_BOOKING_MESSAGE);
    assert.ok(!existsSync(dlqPath), "no DLQ write when recording succeeds");

    await withTableOutage(async () => {
      const outageDup = await createBooking(DLQ_PORT, token, slot);
      assert.equal(outageDup.status, 409, JSON.stringify(outageDup.body));
      // Byte-identical contract: same body as the healthy-recording 409.
      assert.deepEqual(outageDup.body, healthyDup.body);
    });

    assert.ok(existsSync(dlqPath), "double failure must append to the DLQ");
    const dlqLines = readFileSync(dlqPath, "utf8").trim().split("\n");
    assert.equal(dlqLines.length, 1);
    const rawLine = dlqLines[0]!;
    const entry = JSON.parse(rawLine) as {
      evt: string;
      payload: Record<string, unknown>;
    };
    assert.equal(entry.evt, EVT);
    assert.deepEqual(Object.keys(entry.payload).sort(), PAYLOAD_KEYS);
    assert.ok(UUID_PATTERN.test(entry.payload["correlationId"] as string));
    assert.equal(entry.payload["path"], "preflight");
    assert.equal(entry.payload["marketplaceId"], 1);
    assert.equal(entry.payload["actorUserId"], actorUserId);
    assert.equal(entry.payload["subjectBookingId"], healthyDup.body["bookingId"]);
    assert.ok(!Number.isNaN(Date.parse(entry.payload["occurredAt"] as string)));
    assert.ok(!Number.isNaN(Date.parse(entry.payload["scheduledAt"] as string)));
    // No PII and no raw database internals — ever. (\brelation\b avoids a
    // false positive on the legitimate "correlationId" key.)
    assert.ok(
      !/Telemetry|Toronto|postal|address|city|note|email|@|\brelation\b|does not exist|42P01|SQLSTATE|constraint/i.test(
        rawLine,
      ),
      `DLQ line leaked PII or database internals: ${rawLine}`,
    );

    // The replay job accepts the DLQ file directly and closes the gap.
    const result = runJob(dlqPath);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(summaryFrom(result.stdout)["inserted"], 1);
  });

  it("unwritable DLQ path never throws and never alters the 409 contract", async () => {
    const token = await login(BLOCKED_PORT);
    const slot = uniqueSlot(20);

    const created = await createBooking(BLOCKED_PORT, token, slot);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const winnerId = (created.body["booking"] as { id: number }).id;

    await withTableOutage(async () => {
      const outageDup = await createBooking(BLOCKED_PORT, token, slot);
      assert.equal(outageDup.status, 409, JSON.stringify(outageDup.body));
      assert.deepEqual(outageDup.body, {
        error: DUPLICATE_BOOKING_MESSAGE,
        bookingId: winnerId,
      });
    });

    // Server survives the DLQ write failure and keeps serving.
    const alive = await createBooking(BLOCKED_PORT, token, slot);
    assert.equal(alive.status, 409);
    assert.ok(!existsSync(join(blockerFile, "sub")));
  });
});

after(async () => {
  for (const child of servers) child.kill("SIGTERM");
  await pool.end().catch(() => undefined);
});
