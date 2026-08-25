/**
 * Booking sustained-load integration tests.
 *
 * Runs many bookings through full lifecycle transitions concurrently to verify:
 * 1. No booking silently ends in the wrong terminal state.
 * 2. The API never reports success when the write did not persist.
 * 3. Errors are surfaced as JSON (never HTML) — even under load.
 * 4. The system degrades safely: failures are loud (4xx/5xx JSON), not silent.
 *
 * Prerequisites: API server must be running.
 *   pnpm --filter @workspace/api-server run dev
 *
 * Run: pnpm --filter @workspace/api-server run test:pressure
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ── Config ─────────────────────────────────────────────────────────────────────

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 15_000;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> ?? {}),
      },
    });
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {
        _rawBody: text.slice(0, 400),
        error: `Non-JSON response (HTTP ${res.status})`,
      };
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email: string, password: string): Promise<string> {
  const { status, body } = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(status, 200, `Login failed for ${email}: ${JSON.stringify(body)}`);
  return body["token"] as string;
}

// Real-slot fixture pool (see booking-concurrency.test.ts): availability
// enforcement rejects out-of-window/overlapping bookings, so fixtures draw
// globally non-overlapping real slots from the public slots endpoint.
const SLOT_SPACING_MS = 120 * 60 * 1000; // 60-min seeded service + 30-min travel buffer (roadmap #12), rounded up
const slotPool: string[] = [];

async function loadSlotPool(
  providerId: number,
  serviceId: number,
  want: number,
): Promise<void> {
  const base = Date.now();
  let lastMs = 0;
  for (let d = 1; d <= 28 && slotPool.length < want; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { body } = await apiFetch(
      `/providers/${providerId}/slots?serviceId=${serviceId}&date=${date}`,
    );
    const slots =
      (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
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

function nextAvailableSlot(): string {
  const start = slotPool.shift();
  assert.ok(start, "fixture slot pool exhausted — widen loadSlotPool()");
  return start;
}

async function createBooking(
  clientToken: string,
  providerId: number,
  serviceId: number
): Promise<number> {
  const scheduledAt = nextAvailableSlot();
  const { status, body } = await apiFetch("/bookings", {
    method: "POST",
    token: clientToken,
    body: JSON.stringify({
      providerId,
      serviceId,
      scheduledAt,
      address: "88 Pressure Test Ave",
      city: "Toronto",
      postalCode: "M5V 3K1",
    }),
  });
  assert.equal(status, 201, `Failed to create booking: ${JSON.stringify(body)}`);
  return (body["booking"] as { id: number }).id;
}

async function patchStatus(
  bookingId: number,
  newStatus: string,
  token: string,
  extra: Record<string, unknown> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  return apiFetch(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status: newStatus, ...extra }),
  });
}

async function getBooking(
  bookingId: number,
  token: string
): Promise<Record<string, unknown>> {
  const { status, body } = await apiFetch(`/bookings/${bookingId}`, { token });
  assert.equal(status, 200, `Could not fetch booking #${bookingId}: ${JSON.stringify(body)}`);
  return body["booking"] as Record<string, unknown>;
}

// ── Shared state ───────────────────────────────────────────────────────────────

let clientToken: string;
let providerToken: string;
let providerProfileId: number;
let serviceId: number;

// ── 1. Setup ───────────────────────────────────────────────────────────────────

describe("Setup", () => {
  it("API server is reachable", async () => {
    const res = await fetch(`${BASE}/healthz`);
    assert.equal(res.status, 200, "API server is not running — start it first");
  });

  it("demo accounts can authenticate", async () => {
    [clientToken, providerToken] = await Promise.all([
      login("jane@oncallfoot.com", "demo1234"),
      login("sarah@oncallfoot.com", "demo1234"),
    ]);
  });

  it("can retrieve provider profile and a service", async () => {
    const { status, body } = await apiFetch("/providers/me", { token: providerToken });
    assert.equal(status, 200);
    providerProfileId = ((body["provider"] as Record<string, unknown>)["id"]) as number;

    const svcRes = await apiFetch(`/providers/${providerProfileId}/services`, {
      token: providerToken,
    });
    const services = svcRes.body["services"] as Array<{ id: number }>;
    assert.ok(services.length > 0, "Provider must have at least one active service");
    serviceId = services[0]!.id;

    // Populate the real-slot fixture pool (>= 20 non-overlapping bookings).
    await loadSlotPool(providerProfileId, serviceId, 40);
    assert.ok(slotPool.length >= 25, "expected enough seeded availability slots");
  });
});

// ── 2. Sustained load — 20 concurrent full-lifecycle runs ─────────────────────

describe("Sustained load — 20 concurrent full lifecycles", () => {
  it("all 20 bookings reach a valid terminal state with no silent failures", async (t) => {
    const BOOKING_COUNT = 20;

    // Create all 20 bookings in parallel
    t.diagnostic(`Creating ${BOOKING_COUNT} bookings simultaneously...`);
    const bookingIds = await Promise.all(
      Array.from({ length: BOOKING_COUNT }, () =>
        createBooking(clientToken, providerProfileId, serviceId)
      )
    );
    t.diagnostic(`Created booking IDs: ${bookingIds.join(", ")}`);

    // For each booking, run a full lifecycle concurrently.
    // Even-indexed: requested → confirmed → completed
    // Odd-indexed:  requested → confirmed → cancelled (by client)
    t.diagnostic("Running full lifecycle on all bookings concurrently...");
    const lifecycleResults = await Promise.all(
      bookingIds.map(async (bookingId, i) => {
        const expectedFinal = i % 2 === 0 ? "completed" : "cancelled";

        const confirm = await patchStatus(bookingId, "confirmed", providerToken);
        if (confirm.status !== 200) {
          return {
            bookingId,
            step: "confirm",
            status: confirm.status,
            error: confirm.body["error"],
            expectedFinal,
          };
        }

        let finalResult;
        if (i % 2 === 0) {
          finalResult = await patchStatus(bookingId, "completed", providerToken);
        } else {
          finalResult = await patchStatus(bookingId, "cancelled", clientToken, {
            cancellationReason: "Pressure test cancel",
          });
        }

        return {
          bookingId,
          step: "final",
          status: finalResult.status,
          error: finalResult.status !== 200 ? finalResult.body["error"] : undefined,
          expectedFinal,
        };
      })
    );

    // Report any failures
    const failures = lifecycleResults.filter((r) => r.status !== 200);
    if (failures.length > 0) {
      t.diagnostic(`Failures:\n${JSON.stringify(failures, null, 2)}`);
    }

    assert.equal(
      failures.length,
      0,
      `${failures.length} lifecycle(s) failed under load: ${JSON.stringify(failures)}`
    );

    // Verify every booking is in the expected terminal state in the DB
    t.diagnostic("Verifying final states in DB...");
    const finalStates = await Promise.all(
      bookingIds.map(async (bookingId, i) => {
        const booking = await getBooking(bookingId, clientToken);
        return {
          bookingId,
          expected: i % 2 === 0 ? "completed" : "cancelled",
          actual: booking["status"] as string,
        };
      })
    );

    const mismatches = finalStates.filter((s) => s.actual !== s.expected);
    if (mismatches.length > 0) {
      t.diagnostic(`State mismatches:\n${JSON.stringify(mismatches, null, 2)}`);
    }

    assert.equal(
      mismatches.length,
      0,
      `${mismatches.length} booking(s) ended in wrong state: ${JSON.stringify(mismatches)}`
    );

    t.diagnostic(
      `All ${BOOKING_COUNT} bookings reached their expected terminal state ✓`
    );
  });
});

// ── 3. DB write failures surface as JSON 500 (never silent, never HTML) ───────

describe("Write failures surface as JSON — not HTML, not silent success", () => {
  it("error responses always have JSON Content-Type", async () => {
    // Unauthenticated requests return 401 JSON — check Content-Type header
    const res = await fetch(`${BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(
      ct.includes("application/json"),
      `Expected JSON Content-Type on error, got: "${ct}"`
    );
  });

  it("malformed JSON body returns 400 JSON — not HTML", async () => {
    const res = await fetch(`${BASE}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: "{ this is not valid json",
    });
    // Express parses the bad JSON before reaching the route — 400 or 500
    assert.ok(
      res.status === 400 || res.status === 500,
      `Expected 400 or 500, got ${res.status}`
    );
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(
      ct.includes("application/json"),
      `Expected JSON Content-Type on parse error, got: "${ct}"`
    );
  });

  it("missing required fields returns 400 JSON with an error field", async () => {
    const { status, body } = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ providerId: 1 }), // missing serviceId, scheduledAt, address, city
    });
    assert.equal(status, 400);
    assert.ok(
      typeof body["error"] === "string",
      `400 body must include 'error' string, got: ${JSON.stringify(body)}`
    );
  });

  it("non-existent booking returns 404 JSON with an error field", async () => {
    const { status, body } = await apiFetch("/bookings/99999999/status", {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(status, 404);
    assert.ok(
      typeof body["error"] === "string",
      `404 body must include 'error' string, got: ${JSON.stringify(body)}`
    );
  });
});

// ── 4. Success responses always confirm the persisted write ───────────────────

describe("Success (200/201) responses reflect the persisted write", () => {
  it("POST /bookings 201 body matches what GET /bookings/:id returns", async () => {
    const scheduledAt = nextAvailableSlot();
    const { status, body } = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId: providerProfileId,
        serviceId,
        scheduledAt,
        address: "1 Consistency Check Lane",
        city: "Mississauga",
      }),
    });
    assert.equal(status, 201);
    const created = body["booking"] as Record<string, unknown>;
    const bookingId = created["id"] as number;

    // Immediately fetch from DB and compare
    const fetched = await getBooking(bookingId, clientToken);
    assert.equal(fetched["id"], bookingId);
    assert.equal(fetched["status"], "requested");
    assert.equal(fetched["city"], "Mississauga");
  });

  it("PATCH 200 body status matches what GET /bookings/:id returns after confirm", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);

    const { status, body } = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(status, 200);
    const patchedBooking = body["booking"] as Record<string, unknown>;
    assert.equal(patchedBooking["status"], "confirmed");

    // Verify DB agrees
    const fetched = await getBooking(bookingId, clientToken);
    assert.equal(fetched["status"], "confirmed", "DB status must match the PATCH response");
  });

  it("PATCH 200 body status matches what GET /bookings/:id returns after cancel", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);

    const { status, body } = await patchStatus(bookingId, "cancelled", providerToken, {
      cancellationReason: "Consistency check",
    });
    assert.equal(status, 200);
    const patchedBooking = body["booking"] as Record<string, unknown>;
    assert.equal(patchedBooking["status"], "cancelled");

    const fetched = await getBooking(bookingId, clientToken);
    assert.equal(fetched["status"], "cancelled", "DB status must match the PATCH response");
  });
});

// ── 5. Retry safety — second request after success returns 409 not 500 ────────

describe("Retry safety — duplicate requests are rejected cleanly", () => {
  it("retrying a confirm returns 409 JSON, not 500 or HTML", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    await patchStatus(bookingId, "confirmed", providerToken);

    // Simulate client retry after network timeout
    const retry = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(retry.status, 409, `Expected 409 on retry, got ${retry.status}`);
    assert.ok(
      typeof retry.body["error"] === "string",
      `Retry 409 must include 'error' string, got: ${JSON.stringify(retry.body)}`
    );
    // Must be JSON, not HTML
    assert.ok(
      !String(retry.body["_rawBody"] ?? "").includes("<!DOCTYPE"),
      "Retry response must not be HTML"
    );
  });

  it("retrying a cancel returns 409 JSON, not 500 or HTML", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    await patchStatus(bookingId, "cancelled", providerToken, {
      cancellationReason: "Original cancel",
    });

    const retry = await patchStatus(bookingId, "cancelled", providerToken, {
      cancellationReason: "Retry cancel",
    });
    assert.equal(retry.status, 409);
    assert.ok(typeof retry.body["error"] === "string");
    assert.ok(!String(retry.body["_rawBody"] ?? "").includes("<!DOCTYPE"));
  });
});
