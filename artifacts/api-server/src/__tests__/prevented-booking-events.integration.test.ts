/**
 * Prevented duplicate-booking recording — Analytics Step 2, Part 1
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md; operator-approved packet
 * v2 with corrections: server-generated correlation UUID, no SQL artifact in
 * this task).
 *
 * Approved counting rule (verbatim):
 *   One prevented-booking event = one booking request that reaches the API
 *   and returns HTTP 409 with a numeric bookingId.
 *
 * Covers:
 *  - preflight 409 → exactly one row (all fields, marketplace_id=1, path)
 *  - server-generated UUID correlation ids: repeated identical client
 *    X-Request-Id values still produce DISTINCT row correlation ids;
 *    malformed / oversized headers are safely ignored
 *  - 8-way concurrent blast: row count == 409 count (counting-rule proof)
 *  - lock-amplified deterministic race → rows carry path='index_violation'
 *  - 201 success records nothing
 *  - idempotency: same correlation_id inserted twice → one row
 *  - failure isolation: recording table unavailable → byte-identical 409,
 *    no new rows, request never fails
 *
 * Prerequisites: API server running (PORT), seeded demo data, DATABASE_URL
 * pointing at the LOCAL scratch database.
 * Run: node --import tsx/esm --test src/__tests__/prevented-booking-events.integration.test.ts
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

const DUPLICATE_BOOKING_MESSAGE =
  "You already have an active request for this provider, service, and time. Check your bookings before submitting again.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    const text = await response.text();
    try {
      return { status: response.status, body: JSON.parse(text) as Record<string, unknown> };
    } catch {
      return {
        status: response.status,
        body: { error: `Non-JSON response: ${text.slice(0, 200)}` },
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function login(email: string): Promise<string> {
  const result = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "demo1234" }),
  });
  assert.equal(result.status, 200, `Login failed for ${email}: ${JSON.stringify(result.body)}`);
  return result.body["token"] as string;
}

let clientToken: string;
let providerId: number;
let serviceId: number;

/**
 * Real-slot fixtures (availability enforcement): each call returns a fresh,
 * non-overlapping future slot drawn from the public slots endpoint.
 */
const SLOT_SPACING_MS = 120 * 60 * 1000; // covers duration + 30-min travel buffer (roadmap #12)
const slotPool: string[] = [];

async function loadSlotPool(want: number): Promise<void> {
  const base = Date.now();
  let lastMs = 0;
  for (let d = 1; d <= 28 && slotPool.length < want; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { body } = await apiFetch(`/providers/${providerId}/slots?serviceId=${serviceId}&date=${date}`);
    const slots = (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
    for (const s of slots) {
      if (!s.available) continue;
      const ms = Date.parse(s.start);
      if (ms - lastMs >= SLOT_SPACING_MS) {
        slotPool.push(s.start);
        lastMs = ms;
      }
    }
  }
}

function uniqueSlot(_offsetMinutes: number): string {
  const slot = slotPool.shift();
  assert.ok(slot, "fixture slot pool exhausted — widen loadSlotPool()");
  return slot;
}

function bookingPayload(scheduledAt: string) {
  return {
    providerId,
    serviceId,
    scheduledAt,
    address: "42 Telemetry Street",
    city: "Toronto",
    postalCode: "M5V 2B2",
  };
}

async function createBooking(
  slot: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  return apiFetch("/bookings", {
    method: "POST",
    token: clientToken,
    body: JSON.stringify(bookingPayload(slot)),
    headers,
  });
}

type RecordRow = {
  marketplace_id: number;
  correlation_id: string;
  occurred_at: Date;
  actor_user_id: number | null;
  subject_booking_id: number | null;
  provider_id: number | null;
  service_id: number | null;
  scheduled_at: Date;
  path: string;
};

async function rowsForSlot(slotIso: string): Promise<RecordRow[]> {
  const { pool } = await import("@workspace/db");
  const { rows } = await pool.query(
    "SELECT * FROM prevented_booking_records WHERE scheduled_at = $1 ORDER BY id",
    [slotIso],
  );
  return rows as RecordRow[];
}

async function totalRows(): Promise<number> {
  const { pool } = await import("@workspace/db");
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM prevented_booking_records",
  );
  return (rows[0] as { n: number }).n;
}

describe("Setup", () => {
  before(async () => {
    assert.ok(process.env["DATABASE_URL"], "DATABASE_URL must point at the local scratch database");
    clientToken = await login("jane@oncallfoot.com");
    const providers = await apiFetch("/providers", { token: clientToken });
    assert.equal(providers.status, 200, JSON.stringify(providers.body));
    const list = (providers.body["providers"] ?? providers.body["data"] ?? providers.body) as Array<{ id: number }>;
    providerId = (Array.isArray(list) ? list[0] : undefined)?.id ?? 1;
    const services = await apiFetch(`/providers/${providerId}/services`, { token: clientToken });
    assert.equal(services.status, 200, JSON.stringify(services.body));
    const svc = (services.body["services"] ?? services.body["data"] ?? services.body) as Array<{ id: number }>;
    serviceId = (Array.isArray(svc) ? svc[0] : undefined)?.id ?? 1;

    await loadSlotPool(30);
    assert.ok(slotPool.length >= 20, "expected enough seeded availability slots");
  });

  it("API server is reachable", async () => {
    const response = await fetch(`${BASE}/healthz`);
    assert.ok(response.status < 500);
  });
});

describe("Preflight 409 recording", () => {
  it("records exactly one complete row for a sequential duplicate", async () => {
    const slot = uniqueSlot(10);
    const first = await createBooking(slot);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const winnerId = (first.body["booking"] as { id: number }).id;

    const dup = await createBooking(slot);
    assert.equal(dup.status, 409, JSON.stringify(dup.body));
    assert.equal(dup.body["bookingId"], winnerId);

    const rows = await rowsForSlot(slot);
    assert.equal(rows.length, 1, `expected exactly one record: ${JSON.stringify(rows)}`);
    const row = rows[0]!;
    assert.equal(row.marketplace_id, 1, "explicit DEFAULT_MARKETPLACE_ID");
    assert.equal(row.path, "preflight");
    assert.equal(row.subject_booking_id, winnerId);
    assert.equal(row.provider_id, providerId);
    assert.equal(row.service_id, serviceId);
    assert.ok(typeof row.actor_user_id === "number", "actor recorded");
    assert.ok(UUID_PATTERN.test(row.correlation_id), `server UUID expected: ${row.correlation_id}`);
    assert.ok(row.occurred_at instanceof Date || typeof row.occurred_at === "object");
  });
});

describe("Server-generated correlation ids (defensive X-Request-Id)", () => {
  it("repeated identical client X-Request-Id values still produce distinct row correlation ids", async () => {
    const slot = uniqueSlot(20);
    const first = await createBooking(slot);
    assert.equal(first.status, 201, JSON.stringify(first.body));

    const sharedHeader = { "X-Request-Id": "repeated-client-value-123" };
    const dup1 = await createBooking(slot, sharedHeader);
    const dup2 = await createBooking(slot, sharedHeader);
    assert.equal(dup1.status, 409);
    assert.equal(dup2.status, 409);

    const rows = await rowsForSlot(slot);
    assert.equal(rows.length, 2, `two 409s → two rows: ${JSON.stringify(rows)}`);
    const [a, b] = rows as [RecordRow, RecordRow];
    assert.notEqual(a.correlation_id, b.correlation_id, "ids must be distinct");
    for (const row of [a, b]) {
      assert.ok(UUID_PATTERN.test(row.correlation_id), "must be a server UUID");
      assert.notEqual(row.correlation_id, "repeated-client-value-123", "client header must never become the idempotency key");
    }
  });

  it("malformed and oversized headers are safely ignored (recording still works)", async () => {
    const slot = uniqueSlot(30);
    const first = await createBooking(slot);
    assert.equal(first.status, 201, JSON.stringify(first.body));

    const oversized = await createBooking(slot, { "X-Request-Id": "x".repeat(300) });
    assert.equal(oversized.status, 409, JSON.stringify(oversized.body));
    const malformed = await createBooking(slot, { "X-Request-Id": "bad header !! $$" });
    assert.equal(malformed.status, 409, JSON.stringify(malformed.body));

    const rows = await rowsForSlot(slot);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.ok(UUID_PATTERN.test(row.correlation_id), `UUID expected: ${row.correlation_id}`);
    }
  });
});

describe("Counting rule under concurrency", () => {
  it("8 simultaneous identical POSTs: row count equals the 409 count", async () => {
    const slot = uniqueSlot(40);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createBooking(slot)),
    );
    const created = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const serverErrors = results.filter((r) => r.status >= 500);
    assert.equal(serverErrors.length, 0, JSON.stringify(serverErrors.map((r) => r.body)));
    assert.equal(created.length, 1);

    const rows = await rowsForSlot(slot);
    assert.equal(
      rows.length,
      conflicts.length,
      `one row per API 409 (rule): rows=${rows.length} conflicts=${conflicts.length}`,
    );
    const winnerId = (created[0]!.body["booking"] as { id: number }).id;
    const uniqueIds = new Set(rows.map((r) => r.correlation_id));
    assert.equal(uniqueIds.size, rows.length, "distinct correlation ids");
    for (const row of rows) {
      assert.equal(row.subject_booking_id, winnerId);
      assert.ok(["preflight", "index_violation"].includes(row.path));
    }
  });

  it("lock-amplified deterministic race records path='index_violation'", async (t) => {
    if (!process.env["DATABASE_URL"]) {
      t.skip("DATABASE_URL not set");
      return;
    }
    const { pool } = await import("@workspace/db");
    const locker = await pool.connect();
    const slot = uniqueSlot(50);

    let results: Array<{ status: number; body: Record<string, unknown> }>;
    try {
      await locker.query("BEGIN");
      await locker.query("LOCK TABLE bookings IN ACCESS EXCLUSIVE MODE");
      const racers = Promise.all(Array.from({ length: 4 }, () => createBooking(slot)));
      await new Promise((resolve) => setTimeout(resolve, 500));
      await locker.query("COMMIT");
      results = await racers;
    } finally {
      locker.release();
    }

    const conflicts = results.filter((r) => r.status === 409);
    assert.equal(results.filter((r) => r.status >= 500).length, 0);
    assert.equal(conflicts.length, 3, JSON.stringify(results.map((r) => r.status)));

    const rows = await rowsForSlot(slot);
    assert.equal(rows.length, 3, "one row per 409");
    for (const row of rows) {
      assert.equal(row.path, "index_violation", "index-caught race must record its path");
    }
  });
});

describe("Non-emission paths", () => {
  it("a 201 success records nothing", async () => {
    const before = await totalRows();
    const slot = uniqueSlot(60);
    const created = await createBooking(slot);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const after = await totalRows();
    assert.equal(after, before, "success must not add records");
  });
});

describe("Idempotency", () => {
  it("the same correlation_id inserted twice yields exactly one row", async () => {
    const { randomUUID } = await import("node:crypto");
    const { pool } = await import("@workspace/db");
    const { recordPreventedBooking } = await import("../lib/prevented-booking-events.js");

    const slot = uniqueSlot(70);
    const first = await createBooking(slot);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const bookingId = (first.body["booking"] as { id: number }).id;

    const fixedId = randomUUID();
    const event = {
      correlationId: fixedId,
      actorUserId: 4,
      subjectBookingId: bookingId,
      providerId,
      serviceId,
      scheduledAt: new Date(slot),
      path: "preflight" as const,
    };
    await recordPreventedBooking(event);
    await recordPreventedBooking(event); // replay — must be a no-op

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM prevented_booking_records WHERE correlation_id = $1",
      [fixedId],
    );
    assert.equal((rows[0] as { n: number }).n, 1, "ON CONFLICT DO NOTHING must deduplicate");
  });
});

describe("Failure isolation", () => {
  it("recording-table outage never changes or fails the client's 409", async (t) => {
    if (!process.env["DATABASE_URL"]) {
      t.skip("DATABASE_URL not set");
      return;
    }
    const { pool } = await import("@workspace/db");
    const slot = uniqueSlot(80);
    const first = await createBooking(slot);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const winnerId = (first.body["booking"] as { id: number }).id;

    await pool.query(
      "ALTER TABLE prevented_booking_records RENAME TO prevented_booking_records_outage_sim",
    );
    try {
      const dup = await createBooking(slot);
      assert.equal(dup.status, 409, "409 must survive a recording outage");
      assert.equal(dup.body["error"], DUPLICATE_BOOKING_MESSAGE, "message byte-identical");
      assert.equal(dup.body["bookingId"], winnerId, "bookingId unchanged");
    } finally {
      await pool.query(
        "ALTER TABLE prevented_booking_records_outage_sim RENAME TO prevented_booking_records",
      );
    }

    const rows = await rowsForSlot(slot);
    assert.equal(rows.length, 0, "no row could land during the outage (reconciliation log carries it)");
  });
});
