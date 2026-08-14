/**
 * Replay-safety controls — focused tests (Gate 3 preparation).
 *
 * Verifies the safety hardening of
 * `src/scripts/replay-prevented-bookings.ts` (docs/replay-runbook.md):
 *  - dry-run performs zero database writes and classifies
 *    would_insert / already_present correctly (read-only existence checks);
 *  - live execution is rejected without --confirm-target, --max-events,
 *    --max-writes, or --expect-sha256 (exit 2, nothing written);
 *  - target-fingerprint mismatch is rejected before any database access;
 *  - the fingerprint is derived from host:port/dbname ONLY — username and
 *    password never influence or appear in it;
 *  - cap values are strictly validated (zero, negative, non-numeric, unsafe);
 *  - the event cap aborts before any write; the write cap stops safely and
 *    reports unprocessed records;
 *  - SHA-256 mismatch aborts before processing; input metadata (hash, bytes,
 *    record-line count, basename only) is reported;
 *  - correlation-id idempotency, invalid-record isolation, and bounded retry
 *    are unchanged;
 *  - output never contains credentials, connection URIs, or raw invalid-event
 *    content.
 *
 * Prerequisites: DATABASE_URL pointing at the seeded LOCAL scratch database
 * (never managed infrastructure).
 * Run: node --import tsx/esm --test src/__tests__/replay-safety-controls.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import {
  deriveTargetFingerprint,
  parseCliOptions,
  TARGET_FINGERPRINT_LENGTH,
} from "../scripts/replay-prevented-bookings.js";

const API_SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPLAY_SCRIPT = "src/scripts/replay-prevented-bookings.ts";
const EVT = "prevented_booking_record_failed";
const ZERO_SHA = "0".repeat(64);
const WRONG_FINGERPRINT = "0".repeat(12);

const tmp = mkdtempSync(join(tmpdir(), "replay-safety-"));

// Seed-derived ids satisfying the table's FK constraints (resolved in before()).
let actorUserId = 0;
let providerId = 0;
let serviceId = 0;
let subjectBookingId = 0;
let targetFingerprint = "";

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

function runScript(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx/esm", REPLAY_SCRIPT, ...args],
    {
      cwd: API_SERVER_DIR,
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
      timeout: 180_000,
    },
  );
}

/** Standard fully-confirmed live invocation for a given input file. */
function liveArgs(
  input: string,
  overrides: Partial<Record<
    "confirmTarget" | "maxEvents" | "maxWrites" | "expectSha256",
    string
  >> = {},
): string[] {
  return [
    "--input",
    input,
    "--confirm-target",
    overrides.confirmTarget ?? targetFingerprint,
    "--max-events",
    overrides.maxEvents ?? "1000",
    "--max-writes",
    overrides.maxWrites ?? "1000",
    "--expect-sha256",
    overrides.expectSha256 ?? sha256(input),
  ];
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

function hasSummary(stdout: string): boolean {
  return stdout.includes("prevented_booking_replay_summary");
}

async function rowCount(correlationIds: string[]): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM prevented_booking_records WHERE correlation_id = ANY($1)",
    [correlationIds],
  );
  return (rows[0] as { n: number }).n;
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

// ── Suites ───────────────────────────────────────────────────────────────────

describe("Setup", () => {
  before(async () => {
    assert.ok(
      process.env["DATABASE_URL"],
      "DATABASE_URL must point at the local scratch database",
    );
    const derived = deriveTargetFingerprint(process.env["DATABASE_URL"]!);
    assert.ok(derived, "fingerprint must derive from the scratch DATABASE_URL");
    targetFingerprint = derived;

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

    const bookings = await pool.query(
      "SELECT id FROM bookings ORDER BY id LIMIT 1",
    );
    if (bookings.rows[0]) {
      subjectBookingId = (bookings.rows[0] as { id: number }).id;
    } else {
      const inserted = await pool.query(
        `INSERT INTO bookings
           (client_id, provider_id, service_id, status, scheduled_at, address, city)
         VALUES ($1, $2, $3, 'requested', $4, '1 Fixture Way', 'Toronto')
         RETURNING id`,
        [
          actorUserId,
          providerId,
          serviceId,
          new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(),
        ],
      );
      subjectBookingId = (inserted.rows[0] as { id: number }).id;
    }
  });

  it("resolved FK-valid seed identifiers and target fingerprint", () => {
    for (const value of [actorUserId, providerId, serviceId, subjectBookingId]) {
      assert.ok(Number.isInteger(value) && value > 0);
    }
    assert.match(targetFingerprint, /^[0-9a-f]{12}$/);
  });
});

describe("Target fingerprint derivation (credential-free by construction)", () => {
  it("hashes host:port/dbname only — username and password never change it", () => {
    const withAlice = deriveTargetFingerprint(
      "postgresql://alice:super-secret-a@db.example.com:6543/postgres",
    );
    const withBob = deriveTargetFingerprint(
      "postgresql://bob:other-secret-b@db.example.com:6543/postgres",
    );
    const noUserinfo = deriveTargetFingerprint(
      "postgresql://db.example.com:6543/postgres",
    );
    assert.ok(withAlice);
    assert.equal(withAlice, withBob);
    assert.equal(withAlice, noUserinfo);
  });

  it("is exactly 12 lowercase hex characters and matches the raw SHA-256 prefix", () => {
    const fp = deriveTargetFingerprint(
      "postgresql://u:p@host.internal:6543/dbname",
    );
    assert.ok(fp);
    assert.equal(fp.length, TARGET_FINGERPRINT_LENGTH);
    assert.match(fp, /^[0-9a-f]{12}$/);
    const expected = createHash("sha256")
      .update("host.internal:6543/dbname")
      .digest("hex")
      .slice(0, 12);
    assert.equal(fp, expected);
  });

  it("never contains credential material and differs across targets", () => {
    const fp = deriveTargetFingerprint(
      "postgresql://leaky-user:leaky-password@host-a:5432/db-a",
    );
    assert.ok(fp);
    assert.ok(!fp.includes("leaky"));
    const otherHost = deriveTargetFingerprint(
      "postgresql://leaky-user:leaky-password@host-b:5432/db-a",
    );
    const otherDb = deriveTargetFingerprint(
      "postgresql://leaky-user:leaky-password@host-a:5432/db-b",
    );
    const otherPort = deriveTargetFingerprint(
      "postgresql://leaky-user:leaky-password@host-a:6543/db-a",
    );
    assert.notEqual(fp, otherHost);
    assert.notEqual(fp, otherDb);
    assert.notEqual(fp, otherPort);
  });

  it("defaults the port to 5432 when the URL omits it", () => {
    assert.equal(
      deriveTargetFingerprint("postgresql://u:p@host-a/db-a"),
      deriveTargetFingerprint("postgresql://u:p@host-a:5432/db-a"),
    );
  });

  it("returns null for unparseable URLs", () => {
    assert.equal(deriveTargetFingerprint("not a url"), null);
    assert.equal(deriveTargetFingerprint(""), null);
  });
});

describe("CLI validation (strict, fail-fast, exit 2)", () => {
  it("rejects zero, negative, non-numeric, decimal, and unsafe cap values", () => {
    for (const bad of ["0", "-1", "abc", "1.5", "+5", "1e3", " 7", "9007199254740993"]) {
      const viaEvents = parseCliOptions([
        "--input", "x.ndjson", "--dry-run", "--max-events", bad,
      ]);
      assert.equal(viaEvents.ok, false, `--max-events ${bad} must be rejected`);
      const viaWrites = parseCliOptions([
        "--input", "x.ndjson", "--dry-run", "--max-writes", bad,
      ]);
      assert.equal(viaWrites.ok, false, `--max-writes ${bad} must be rejected`);
    }
  });

  it("rejects unknown options, duplicates, and malformed confirmation values", () => {
    assert.equal(parseCliOptions(["--input", "x", "--dryrun"]).ok, false);
    assert.equal(
      parseCliOptions(["--input", "x", "--input", "y", "--dry-run"]).ok,
      false,
    );
    assert.equal(
      parseCliOptions(["--input", "x", "--dry-run", "--confirm-target", "zz"]).ok,
      false,
    );
    assert.equal(
      parseCliOptions(["--input", "x", "--dry-run", "--expect-sha256", "1234"]).ok,
      false,
    );
  });

  it("missing --confirm-target is rejected for live mode (exit 2, no summary, no rows)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript([
      "--input", input,
      "--max-events", "10",
      "--max-writes", "10",
      "--expect-sha256", sha256(input),
    ]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(!hasSummary(result.stdout));
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("missing --max-events is rejected for live mode", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript([
      "--input", input,
      "--confirm-target", targetFingerprint,
      "--max-writes", "10",
      "--expect-sha256", sha256(input),
    ]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("missing --max-writes is rejected for live mode", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript([
      "--input", input,
      "--confirm-target", targetFingerprint,
      "--max-events", "10",
      "--expect-sha256", sha256(input),
    ]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("missing --expect-sha256 is rejected for live mode", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript([
      "--input", input,
      "--confirm-target", targetFingerprint,
      "--max-events", "10",
      "--max-writes", "10",
    ]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("zero cap value is rejected by the spawned script too (exit 2)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript(liveArgs(input, { maxWrites: "0" }));
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(await rowCount([payload.correlationId]), 0);
  });
});

describe("Production-target guard", () => {
  it("fingerprint mismatch is rejected before any write (exit 2)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript(
      liveArgs(input, { confirmTarget: WRONG_FINGERPRINT }),
    );
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(result.stdout.includes("prevented_booking_replay_target_mismatch"));
    assert.ok(!hasSummary(result.stdout));
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("matching fingerprint allows a fully-confirmed live run (exit 0)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript(liveArgs(input));
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["inserted"], 1);
    assert.equal(summary["target_fingerprint"], targetFingerprint);
    assert.equal(await rowCount([payload.correlationId]), 1);
  });
});

describe("Input hash pre-approval", () => {
  it("SHA-256 mismatch is rejected before processing (exit 2, no rows)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript(liveArgs(input, { expectSha256: ZERO_SHA }));
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(result.stdout.includes("prevented_booking_replay_hash_mismatch"));
    assert.ok(!hasSummary(result.stdout));
    // Hashes are reported; event contents are not.
    assert.ok(!result.stdout.includes(payload.correlationId));
    assert.equal(await rowCount([payload.correlationId]), 0);
  });

  it("input metadata is reported correctly (hash, bytes, record lines, basename only)", async () => {
    const a = makePayload();
    const b = makePayload();
    const input = writeFixture([lineFor(a), "", lineFor(b)]); // blank line is not a record
    const result = runScript(["--input", input, "--dry-run"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["input_sha256"], sha256(input));
    assert.equal(summary["input_bytes"], readFileSync(input).length);
    assert.equal(summary["input_lines"], 2);
    assert.equal(summary["input_basename"], basename(input));
    assert.ok(!(summary["input_basename"] as string).includes("/"));
    assert.equal(summary["expected_sha256"], null);
    assert.ok(typeof summary["duration_ms"] === "number");
  });
});

describe("Dry-run", () => {
  it("performs zero database writes and classifies would_insert (exit 0)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const result = runScript(["--input", input, "--dry-run"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["mode"], "DRY_RUN");
    assert.equal(summary["would_insert"], 1);
    assert.equal(summary["inserted"], 0);
    assert.equal(summary["already_present"], 0);
    assert.ok(
      (result.stdout.match(/DRY RUN/g) ?? []).length > 0,
      "report must be clearly labeled DRY RUN",
    );
    assert.equal(
      await rowCount([payload.correlationId]),
      0,
      "dry-run must never insert",
    );
  });

  it("classifies new vs already-present records correctly, including in-file duplicates", async () => {
    const existing = makePayload();
    const fresh = makePayload();
    // Arrange: `existing` is present via a fully-confirmed live run.
    const seedInput = writeFixture([lineFor(existing)]);
    assert.equal(runScript(liveArgs(seedInput)).status, 0);

    const input = writeFixture([
      lineFor(existing),
      lineFor(fresh),
      lineFor(fresh), // duplicate correlation id within the same file
    ]);
    const result = runScript(["--input", input, "--dry-run"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["read"], 3);
    assert.equal(summary["would_insert"], 1);
    assert.equal(summary["already_present"], 2);
    assert.equal(
      await rowCount([fresh.correlationId]),
      0,
      "dry-run must never insert",
    );
  });

  it("honors provided safety options identically (rehearsal) and still writes nothing", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const rehearsal = runScript([
      "--input", input, "--dry-run",
      "--confirm-target", targetFingerprint,
      "--max-events", "5",
      "--max-writes", "5",
      "--expect-sha256", sha256(input),
    ]);
    assert.equal(rehearsal.status, 0, rehearsal.stdout + rehearsal.stderr);
    assert.equal(summaryFrom(rehearsal.stdout)["would_insert"], 1);
    assert.equal(await rowCount([payload.correlationId]), 0);

    // A mismatched fingerprint fails the rehearsal exactly like a live run.
    const badRehearsal = runScript([
      "--input", input, "--dry-run",
      "--confirm-target", WRONG_FINGERPRINT,
    ]);
    assert.equal(badRehearsal.status, 2);
  });
});

describe("Scope caps", () => {
  it("event cap is enforced before any write (exit 2, zero rows)", async () => {
    const payloads = [makePayload(), makePayload(), makePayload()];
    const input = writeFixture(payloads.map((p) => lineFor(p)));
    const result = runScript(liveArgs(input, { maxEvents: "2" }));
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(
      result.stdout.includes("prevented_booking_replay_event_cap_exceeded"),
    );
    assert.ok(!hasSummary(result.stdout));
    assert.equal(
      await rowCount(payloads.map((p) => p.correlationId)),
      0,
      "no write may occur when the event cap is exceeded",
    );
  });

  it("write cap stops safely, reports unprocessed, and exits nonzero", async () => {
    const payloads = [makePayload(), makePayload(), makePayload()];
    const input = writeFixture(payloads.map((p) => lineFor(p)));
    const result = runScript(liveArgs(input, { maxWrites: "2" }));
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["inserted"], 2);
    assert.equal(summary["unprocessed"], 1);
    assert.equal(summary["write_cap_reached"], true);
    assert.equal(summary["max_writes"], 2);
    assert.equal(summary["max_events"], 1000);
    assert.equal(
      await rowCount(payloads.map((p) => p.correlationId)),
      2,
      "exactly max-writes rows may be inserted",
    );
  });

  it("a run exactly at the caps completes with exit 0 and write_cap_reached reported", async () => {
    const payloads = [makePayload(), makePayload()];
    const input = writeFixture(payloads.map((p) => lineFor(p)));
    const result = runScript(
      liveArgs(input, { maxEvents: "2", maxWrites: "2" }),
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["inserted"], 2);
    assert.equal(summary["unprocessed"], 0);
    assert.equal(summary["write_cap_reached"], true);
  });
});

describe("Preserved guarantees", () => {
  it("correlation-id idempotency is unchanged (re-run → already_present, one row)", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    assert.equal(runScript(liveArgs(input)).status, 0);
    const rerun = runScript(liveArgs(input));
    assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
    const summary = summaryFrom(rerun.stdout);
    assert.equal(summary["inserted"], 0);
    assert.equal(summary["already_present"], 1);
    assert.equal(await rowCount([payload.correlationId]), 1);
  });

  it("invalid records remain isolated to the local invalid file; input unchanged (exit 1)", async () => {
    const good = makePayload();
    const rawGarbage = "credential-looking {{ garbage password=hunter2";
    const input = writeFixture([lineFor(good), rawGarbage]);
    const before = sha256(input);

    const result = runScript(liveArgs(input));
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = summaryFrom(result.stdout);
    assert.equal(summary["invalid"], 1);
    assert.equal(summary["inserted"], 1);

    const invalidFile = `${input}.invalid.ndjson`;
    assert.ok(existsSync(invalidFile));
    assert.equal(readFileSync(invalidFile, "utf8").trim(), rawGarbage);
    // Raw invalid content is never echoed to stdout/stderr.
    assert.ok(!result.stdout.includes("hunter2"));
    assert.ok(!result.stderr.includes("hunter2"));
    assert.equal(sha256(input), before, "input file must never be modified");
  });

  it("retry stays bounded on outage → failed classification, .failed.ndjson, exit 1; re-run recovers", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);

    await withTableOutage(async () => {
      const startedAt = Date.now();
      const result = runScript(liveArgs(input));
      const elapsed = Date.now() - startedAt;
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const summary = summaryFrom(result.stdout);
      assert.equal(summary["failed"], 1);
      assert.equal(summary["inserted"], 0);
      assert.ok(existsSync(`${input}.failed.ndjson`));
      // One attempt + three bounded retries (250ms + 1s + 4s) — a whole-job
      // or unbounded retry loop would blow well past this ceiling.
      assert.ok(
        elapsed < 60_000,
        `bounded retry must finish promptly (took ${elapsed}ms)`,
      );
    });

    const recovery = runScript(liveArgs(input));
    assert.equal(recovery.status, 0, recovery.stdout + recovery.stderr);
    assert.equal(summaryFrom(recovery.stdout)["inserted"], 1);
    assert.equal(await rowCount([payload.correlationId]), 1);
  });

  it("output contains no credentials, no connection URI, and no authorization material", async () => {
    const payload = makePayload();
    const input = writeFixture([lineFor(payload)]);
    const live = runScript(liveArgs(input));
    assert.equal(live.status, 0);
    const dry = runScript(["--input", input, "--dry-run"]);
    assert.equal(dry.status, 0);

    const url = new URL(process.env["DATABASE_URL"]!);
    for (const output of [
      live.stdout + live.stderr,
      dry.stdout + dry.stderr,
    ]) {
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

after(async () => {
  await pool.end().catch(() => undefined);
});
