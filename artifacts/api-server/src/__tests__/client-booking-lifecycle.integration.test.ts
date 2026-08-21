/**
 * Client booking-lifecycle integration coverage (Session 070 slice).
 *
 * Reimplemented from test-report evidence; original uncommitted working tree
 * unavailable (see docs/roadmap/SESSION_070_RECON_FOOT_WORKTREE.evidence.md).
 *
 * Covers:
 *  - duplicate-submit protection on POST /bookings (409 + bookingId)
 *  - cancellation flow (reason required, in-app confirm is frontend-side,
 *    double-cancel conflict, re-request after cancel)
 *  - one-review-per-completed-booking (first 201, duplicate 409)
 *  - foreign-client isolation on cancellation
 *
 * Prerequisites: API server must be running and seeded.
 * Run: pnpm --filter @workspace/api-server run test:lifecycle
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { isActiveBookingDuplicateViolation } from "../routes/bookings.js";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

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
        ...(rest.headers as Record<string, string> ?? {}),
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
let otherClientToken: string;
let providerToken: string;
let providerId: number;
let serviceId: number;

/**
 * Real-slot fixtures. Availability enforcement rejects out-of-window bookings,
 * so each distinct logical offset maps to a distinct, non-overlapping real slot
 * drawn from the public slots endpoint. The same offset always returns the same
 * slot within a run, so duplicate/overlap tests stay deterministic.
 */
const SLOT_SPACING_MS = 60 * 60 * 1000;
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
    address: "77 Lifecycle Way",
    city: "Toronto",
    postalCode: "M5V 1A1",
  };
}

async function createBooking(
  scheduledAt: string,
  token = clientToken,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return apiFetch("/bookings", {
    method: "POST",
    token,
    body: JSON.stringify(bookingPayload(scheduledAt)),
  });
}

describe("Booking lifecycle setup", () => {
  before(async () => {
    [clientToken, otherClientToken, providerToken] = await Promise.all([
      login("jane@oncallfoot.com"),
      login("tom@oncallfoot.com"),
      login("sarah@oncallfoot.com"),
    ]);

    const profile = await apiFetch("/providers/me", { token: providerToken });
    assert.equal(profile.status, 200);
    providerId = (profile.body["provider"] as { id: number }).id;

    const services = await apiFetch(`/providers/${providerId}/services`, { token: providerToken });
    assert.equal(services.status, 200);
    serviceId = ((services.body["services"] as Array<{ id: number }>)[0]!).id;

    await loadSlotPool(24);
    assert.ok(slotPool.length >= 10, "expected enough seeded availability slots");
  });

  it("API server is reachable", async () => {
    const response = await fetch(`${BASE}/healthz`);
    assert.equal(response.status, 200);
  });
});

describe("Duplicate-submit protection", () => {
  it("returns 409 with the existing bookingId for an identical active request", async () => {
    const slot = uniqueSlot(0);

    const first = await createBooking(slot);
    assert.equal(first.status, 201, `First booking failed: ${JSON.stringify(first.body)}`);
    const firstId = (first.body["booking"] as { id: number }).id;

    const duplicate = await createBooking(slot);
    assert.equal(duplicate.status, 409, `Expected duplicate conflict: ${JSON.stringify(duplicate.body)}`);
    assert.equal(typeof duplicate.body["error"], "string");
    assert.equal(duplicate.body["bookingId"], firstId);
  });

  it("allows the same client to book a different scheduled time", async () => {
    const result = await createBooking(uniqueSlot(90));
    assert.equal(result.status, 201, JSON.stringify(result.body));
  });

  it("rejects a different client overlapping the same provider with provider_unavailable", async () => {
    const slot = uniqueSlot(180);

    const jane = await createBooking(slot);
    assert.equal(jane.status, 201, JSON.stringify(jane.body));

    // Approved milestone behavior: a DIFFERENT client requesting the same
    // provider slot is now rejected with provider_unavailable (no ids leaked),
    // rather than being allowed. The transactional advisory-lock overlap check
    // is authoritative.
    const tom = await createBooking(slot, otherClientToken);
    assert.equal(tom.status, 409, `Expected provider_unavailable: ${JSON.stringify(tom.body)}`);
    assert.equal(tom.body["reason"], "provider_unavailable");
    assert.equal(tom.body["bookingId"], undefined);
  });
});

describe("Concurrent duplicate race — database index maps to friendly 409", () => {
  it("8 simultaneous identical POSTs: exactly one 201, seven 409s, zero 500s", async () => {
    const slot = uniqueSlot(360);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => createBooking(slot)),
    );

    const created = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const serverErrors = results.filter((r) => r.status >= 500);

    assert.equal(
      serverErrors.length,
      0,
      `Race path must never 500: ${JSON.stringify(serverErrors.map((r) => r.body))}`,
    );
    assert.equal(created.length, 1, `Expected exactly one winner: ${JSON.stringify(results.map((r) => r.status))}`);
    assert.equal(conflicts.length, 7, `Expected seven conflicts: ${JSON.stringify(results.map((r) => r.status))}`);

    const winnerId = (created[0]!.body["booking"] as { id: number }).id;
    for (const conflict of conflicts) {
      assert.equal(typeof conflict.body["error"], "string", JSON.stringify(conflict.body));
      assert.equal(conflict.body["bookingId"], winnerId, JSON.stringify(conflict.body));
      const message = conflict.body["error"] as string;
      assert.ok(!message.includes("23505"), "SQLSTATE must never reach the client");
      assert.ok(
        !message.includes("bookings_active_booking_unique_idx"),
        "index name must never reach the client",
      );
      assert.ok(!/duplicate key value/i.test(message), "raw PostgreSQL text must never reach the client");
    }
  });

  it("database index rejection reaches the friendly 409 (lock-amplified deterministic race)", async (t) => {
    if (!process.env["DATABASE_URL"]) {
      t.skip("DATABASE_URL not set — HTTP-only run cannot amplify the race window");
      return;
    }

    // Hold an ACCESS EXCLUSIVE lock on bookings so every racer blocks at the
    // preflight SELECT; on COMMIT they all resume together, all see an empty
    // slot, and all reach INSERT — forcing the partial unique index (not the
    // preflight) to reject the losers. Local test database only.
    const { pool } = await import("@workspace/db");
    const locker = await pool.connect();
    const slot = uniqueSlot(420);

    let results: Array<{ status: number; body: Record<string, unknown> }>;
    try {
      await locker.query("BEGIN");
      await locker.query("LOCK TABLE bookings IN ACCESS EXCLUSIVE MODE");

      const racers = Promise.all(Array.from({ length: 4 }, () => createBooking(slot)));
      // Give every request time to reach (and block on) the preflight SELECT.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await locker.query("COMMIT");

      results = await racers;
    } finally {
      locker.release();
    }

    const created = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const serverErrors = results.filter((r) => r.status >= 500);

    assert.equal(
      serverErrors.length,
      0,
      `DB rejection must map to 409, never 500: ${JSON.stringify(serverErrors.map((r) => r.body))}`,
    );
    assert.equal(created.length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(conflicts.length, 3, JSON.stringify(results.map((r) => r.status)));

    const winnerId = (created[0]!.body["booking"] as { id: number }).id;
    for (const conflict of conflicts) {
      assert.equal(typeof conflict.body["error"], "string", JSON.stringify(conflict.body));
      assert.equal(conflict.body["bookingId"], winnerId, JSON.stringify(conflict.body));
    }

    // Database-level invariant: exactly one row persisted for the slot.
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM bookings WHERE scheduled_at = $1",
      [slot],
    );
    assert.equal((rows[0] as { n: number }).n, 1, "exactly one booking row must persist");
  });
});

describe("isActiveBookingDuplicateViolation detector", () => {
  const INDEX = "bookings_active_booking_unique_idx";

  it("matches when the index name is nested under cause chains", () => {
    const error = {
      message: "query failed",
      cause: {
        message: "insert rejected",
        cause: { code: "23505", constraint: INDEX, message: "duplicate key value" },
      },
    };
    assert.equal(isActiveBookingDuplicateViolation(error), true);
  });

  it("matches a message-only wrapped error carrying the index name (code lost)", () => {
    const error = {
      message: `duplicate key value violates unique constraint "${INDEX}"`,
    };
    assert.equal(isActiveBookingDuplicateViolation(error), true);
  });

  it("returns false for an unrelated 23505 unique violation", () => {
    const error = {
      code: "23505",
      constraint: "reviews_booking_id_unique",
      message: 'duplicate key value violates unique constraint "reviews_booking_id_unique"',
    };
    assert.equal(isActiveBookingDuplicateViolation(error), false);
  });

  it("returns false for generic duplicate-key text without the index name", () => {
    const error = { code: "23505", message: "duplicate key value violates unique constraint" };
    assert.equal(isActiveBookingDuplicateViolation(error), false);
  });

  it("returns false for null, undefined, and non-object inputs", () => {
    assert.equal(isActiveBookingDuplicateViolation(null), false);
    assert.equal(isActiveBookingDuplicateViolation(undefined), false);
    assert.equal(isActiveBookingDuplicateViolation("23505"), false);
    assert.equal(isActiveBookingDuplicateViolation(23505), false);
  });
});

describe("Cancellation flow", () => {
  it("requires a cancellationReason, cancels once, conflicts on double-cancel, and frees the slot", async () => {
    const slot = uniqueSlot(270);

    const created = await createBooking(slot);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const bookingId = (created.body["booking"] as { id: number }).id;

    const missingReason = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(missingReason.status, 400, JSON.stringify(missingReason.body));

    const cancelled = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Change of plans" }),
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

    const doubleCancel = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Repeat tap" }),
    });
    assert.equal(doubleCancel.status, 409, JSON.stringify(doubleCancel.body));

    // A cancelled booking must never block re-requesting the same slot.
    const rebooked = await createBooking(slot);
    assert.equal(rebooked.status, 201, `Rebooking after cancel failed: ${JSON.stringify(rebooked.body)}`);
    const rebookedId = (rebooked.body["booking"] as { id: number }).id;
    assert.notEqual(rebookedId, bookingId);
  });

  it("blocks a foreign client from cancelling someone else's booking", async () => {
    const created = await createBooking(uniqueSlot(360));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const bookingId = (created.body["booking"] as { id: number }).id;

    const foreign = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: otherClientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Not my booking" }),
    });
    assert.equal(foreign.status, 403, JSON.stringify(foreign.body));
  });
});

describe("One review per completed booking", () => {
  it("accepts the first review and rejects a duplicate with 409", async () => {
    const created = await createBooking(uniqueSlot(450));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const bookingId = (created.body["booking"] as { id: number }).id;

    const confirmed = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

    const completed = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "completed" }),
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));

    const review = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId, rating: 5, comment: "Wonderful home visit." }),
    });
    assert.equal(review.status, 201, JSON.stringify(review.body));

    const duplicateReview = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId, rating: 4, comment: "Trying to review twice." }),
    });
    assert.equal(duplicateReview.status, 409, JSON.stringify(duplicateReview.body));
  });
});