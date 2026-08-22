/**
 * Booking concurrency integration tests.
 *
 * Fires concurrent and back-to-back PATCH /bookings/:id/status requests
 * against the running API server to verify that row-level locking prevents
 * duplicate state transitions and protects booking integrity under load.
 *
 * Prerequisites: API server must be running.
 *   pnpm --filter @workspace/api-server run dev
 *
 * Run: pnpm --filter @workspace/api-server run test:integration
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ── Config ─────────────────────────────────────────────────────────────────────

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

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
      // Non-JSON response (e.g. proxy HTML error page) — surface clearly
      body = { _rawBody: text.slice(0, 300), error: `Non-JSON response (HTTP ${res.status})` };
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
  assert.equal(
    status,
    200,
    `Login failed for ${email}: ${JSON.stringify(body)}`
  );
  return body["token"] as string;
}

// Real-slot fixture pool: availability enforcement now rejects bookings that
// fall outside a provider's windows or overlap another active booking, so
// fixtures must schedule inside seeded availability. We pre-fetch real slots
// from the public slots endpoint and hand out globally non-overlapping starts
// (>= the service duration apart) so no two fixture bookings collide.
const SLOT_SPACING_MS = 60 * 60 * 1000; // Sarah's seeded service is 60 minutes
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
      address: "99 Concurrency Lane",
      city: "Toronto",
      postalCode: "M5V 2K3",
    }),
  });
  assert.equal(status, 201, `Failed to create booking: ${JSON.stringify(body)}`);
  const booking = body["booking"] as { id: number };
  return booking.id;
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

// ── Shared state (populated in setup) ─────────────────────────────────────────

let clientToken: string;   // jane@oncallfoot.com
let providerToken: string; // sarah@oncallfoot.com
let providerProfileId: number;
let serviceId: number;

// ── 1. Setup ──────────────────────────────────────────────────────────────────

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

  it("can retrieve Sarah's provider profile and at least one service", async () => {
    const { status, body } = await apiFetch("/providers/me", { token: providerToken });
    assert.equal(status, 200);
    const profile = body["provider"] as Record<string, unknown>;
    providerProfileId = profile["id"] as number;
    assert.ok(providerProfileId > 0, "providerProfileId must be > 0");

    const svcRes = await apiFetch(`/providers/${providerProfileId}/services`, {
      token: providerToken,
    });
    assert.equal(svcRes.status, 200);
    const services = svcRes.body["services"] as Array<{ id: number }>;
    assert.ok(services.length > 0, "Sarah must have at least one active service");
    serviceId = services[0]!.id;

    // Populate the real-slot fixture pool now that provider + service are known.
    await loadSlotPool(providerProfileId, serviceId, 40);
    assert.ok(slotPool.length >= 30, "expected enough seeded availability slots");
  });
});

// ── 2. Concurrent confirms — only one wins ────────────────────────────────────

describe("Concurrent confirms — only one wins", () => {
  it("8 simultaneous confirms: exactly 1 succeeds (200), 7 are rejected (409)", async (t) => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    t.diagnostic(`Booking #${bookingId} created in status 'requested'`);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => patchStatus(bookingId, "confirmed", providerToken))
    );

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    const unexpected = results.filter((r) => r.status !== 200 && r.status !== 409);

    t.diagnostic(
      `Results: ${successes.length}×200  ${conflicts.length}×409  ${unexpected.length}×other`
    );

    assert.equal(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);
    assert.equal(conflicts.length, 7, `Expected 7 conflicts, got ${conflicts.length}`);
    assert.equal(
      unexpected.length,
      0,
      `Unexpected status codes: ${unexpected.map((r) => r.status).join(", ")}`
    );

    // The winning response has the booking in confirmed state
    const winnerBooking = successes[0]!.body["booking"] as Record<string, unknown>;
    assert.equal(winnerBooking["status"], "confirmed");
  });
});

// ── 3. Concurrent cancels (same actor) — only one wins ────────────────────────

describe("Concurrent cancels (same actor) — only one wins", () => {
  it("5 simultaneous provider cancels: exactly 1 succeeds, 4 are rejected", async (t) => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    t.diagnostic(`Booking #${bookingId} created`);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        patchStatus(bookingId, "cancelled", providerToken, {
          cancellationReason: "Concurrent cancel test",
        })
      )
    );

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    t.diagnostic(`Results: ${successes.length}×200  ${conflicts.length}×409`);

    assert.equal(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);
    assert.equal(conflicts.length, 4, `Expected 4 conflicts, got ${conflicts.length}`);
  });
});

// ── 4. Concurrent client + provider cancel race — only one wins ───────────────

describe("Concurrent cross-actor cancel race — only one wins", () => {
  it("4 client cancels + 4 provider cancels simultaneously: exactly 1 wins", async (t) => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    t.diagnostic(`Booking #${bookingId} created`);

    const results = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        patchStatus(bookingId, "cancelled", clientToken, {
          cancellationReason: "Client cancelled (concurrency test)",
        })
      ),
      ...Array.from({ length: 4 }, () =>
        patchStatus(bookingId, "cancelled", providerToken, {
          cancellationReason: "Provider cancelled (concurrency test)",
        })
      ),
    ]);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    t.diagnostic(`Results: ${successes.length}×200  ${conflicts.length}×409`);

    assert.equal(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);
    assert.equal(conflicts.length, 7, `Expected 7 conflicts, got ${conflicts.length}`);

    const winner = successes[0]!.body["booking"] as Record<string, unknown>;
    assert.equal(winner["status"], "cancelled");
  });
});

// ── 5. Back-to-back valid transitions succeed in sequence ─────────────────────

describe("Back-to-back valid transitions", () => {
  it("requested → confirmed → completed succeeds in order", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);

    const confirm = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(confirm.status, 200, `Confirm failed: ${JSON.stringify(confirm.body)}`);

    const complete = await patchStatus(bookingId, "completed", providerToken);
    assert.equal(complete.status, 200, `Complete failed: ${JSON.stringify(complete.body)}`);

    const finalBooking = complete.body["booking"] as Record<string, unknown>;
    assert.equal(finalBooking["status"], "completed");
  });

  it("requested → confirmed → client cancels succeeds in order", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);

    const confirm = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(confirm.status, 200, `Confirm failed: ${JSON.stringify(confirm.body)}`);

    const cancel = await patchStatus(bookingId, "cancelled", clientToken, {
      cancellationReason: "Change of plans",
    });
    assert.equal(cancel.status, 200, `Cancel failed: ${JSON.stringify(cancel.body)}`);

    const finalBooking = cancel.body["booking"] as Record<string, unknown>;
    assert.equal(finalBooking["status"], "cancelled");
  });

  it("requested → confirmed → rescheduled → confirmed succeeds in order", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    // Rescheduling now enforces the same real-slot rules as creation, so the
    // new time must come from the availability-backed fixture pool.
    const newTime = nextAvailableSlot();

    const confirm = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(confirm.status, 200);

    const reschedule = await patchStatus(bookingId, "rescheduled", clientToken, {
      scheduledAt: newTime,
    });
    assert.equal(reschedule.status, 200, `Reschedule failed: ${JSON.stringify(reschedule.body)}`);

    const reconfirm = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(reconfirm.status, 200, `Reconfirm failed: ${JSON.stringify(reconfirm.body)}`);

    const finalBooking = reconfirm.body["booking"] as Record<string, unknown>;
    assert.equal(finalBooking["status"], "confirmed");
  });
});

// ── 6. Invalid transitions still fail safely ──────────────────────────────────

describe("Invalid transitions fail safely", () => {
  it("cannot transition out of a terminal (completed) booking", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    await patchStatus(bookingId, "confirmed", providerToken);
    await patchStatus(bookingId, "completed", providerToken);

    const results = await Promise.all([
      patchStatus(bookingId, "confirmed", providerToken),
      patchStatus(bookingId, "cancelled", providerToken, { cancellationReason: "test" }),
      patchStatus(bookingId, "completed", providerToken),
    ]);

    for (const r of results) {
      assert.equal(r.status, 409, `Expected 409, got ${r.status}: ${JSON.stringify(r.body)}`);
    }
  });

  it("cannot transition out of a terminal (cancelled) booking", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    await patchStatus(bookingId, "cancelled", providerToken, { cancellationReason: "test" });

    const retry = await patchStatus(bookingId, "cancelled", providerToken, {
      cancellationReason: "retry cancel",
    });
    assert.equal(retry.status, 409);
  });

  it("client cannot confirm a booking (provider-only action → 409)", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    const result = await patchStatus(bookingId, "confirmed", clientToken);
    assert.equal(result.status, 409);
  });

  it("provider cannot complete a booking in requested state (skipped step → 409)", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    const result = await patchStatus(bookingId, "completed", providerToken);
    assert.equal(result.status, 409);
  });

  it("cancellation without reason returns 400", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    const result = await patchStatus(bookingId, "cancelled", providerToken);
    // No cancellationReason → should fail validation before the lock
    assert.equal(result.status, 400);
  });
});

// ── 7. 409 response body is informative ───────────────────────────────────────

describe("409 conflict response body", () => {
  it("includes a human-readable error string", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    await patchStatus(bookingId, "confirmed", providerToken);

    // Second confirm on an already-confirmed booking
    const result = await patchStatus(bookingId, "confirmed", providerToken);
    assert.equal(result.status, 409);
    assert.ok(
      typeof result.body["error"] === "string" && result.body["error"].length > 10,
      `409 body should include a meaningful error string, got: ${JSON.stringify(result.body)}`
    );
  });
});

// ── 8. Unauthenticated requests are rejected ──────────────────────────────────

describe("Auth enforcement", () => {
  it("unauthenticated PATCH returns 401", async () => {
    const bookingId = await createBooking(clientToken, providerProfileId, serviceId);
    const res = await fetch(`${BASE}/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(res.status, 401);
  });
});
