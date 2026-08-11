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

/** Unique future timestamp per test run so reruns never collide with leftovers. */
function uniqueSlot(offsetMinutes: number): string {
  const base = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const runJitter = (Date.now() % 100_000) * 60;
  return new Date(base + runJitter + offsetMinutes * 60 * 1000).toISOString();
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

  it("does not let one client's active booking block another client", async () => {
    const slot = uniqueSlot(180);

    const jane = await createBooking(slot);
    assert.equal(jane.status, 201, JSON.stringify(jane.body));

    const tom = await createBooking(slot, otherClientToken);
    assert.equal(tom.status, 201, `Other client blocked: ${JSON.stringify(tom.body)}`);
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
