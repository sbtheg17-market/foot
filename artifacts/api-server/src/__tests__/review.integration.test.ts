/**
 * Client review integration coverage.
 *
 * Prerequisites: API server must be running and seeded.
 * Run: pnpm --filter @workspace/api-server run test:reviews
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
let adminToken: string;
let providerId: number;
let serviceId: number;

async function createCompletedBooking(): Promise<number> {
  const created = await apiFetch("/bookings", {
    method: "POST",
    token: clientToken,
    body: JSON.stringify({
      providerId,
      serviceId,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      address: "99 Review Lane",
      city: "Toronto",
      postalCode: "M5V 2K3",
      careNotes: "Private clinical note that must never appear in review responses.",
    }),
  });
  assert.equal(created.status, 201, `Booking creation failed: ${JSON.stringify(created.body)}`);
  const bookingId = (created.body["booking"] as { id: number }).id;

  const confirmed = await apiFetch(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    token: providerToken,
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(confirmed.status, 200);

  const completed = await apiFetch(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    token: providerToken,
    body: JSON.stringify({ status: "completed" }),
  });
  assert.equal(completed.status, 200);
  return bookingId;
}

describe("Review integration setup", () => {
  before(async () => {
    [clientToken, otherClientToken, providerToken, adminToken] = await Promise.all([
      login("jane@oncallfoot.com"),
      login("tom@oncallfoot.com"),
      login("sarah@oncallfoot.com"),
      login("admin@oncallfoot.com"),
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

describe("Eligible completed-booking reviews", () => {
  it("allows the client to submit and retrieve a review without private care notes", async () => {
    const bookingId = await createCompletedBooking();
    const submitted = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId, rating: 5, comment: "Kind, careful, and thorough." }),
    });

    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal(JSON.stringify(submitted.body).includes("careNotes"), false);
    const review = submitted.body["review"] as Record<string, unknown> | undefined;
    assert.ok(review);
    assert.equal(review["bookingId"], bookingId);
    assert.equal((review["clientId"] as number) > 0, true);
    assert.equal(review["providerId"], providerId);

    const retrieved = await apiFetch(`/reviews/booking/${bookingId}`, { token: clientToken });
    assert.equal(retrieved.status, 200);
    assert.equal(JSON.stringify(retrieved.body).includes("careNotes"), false);
    const retrievedReview = retrieved.body["review"] as Record<string, unknown> | undefined;
    assert.ok(retrievedReview);
    assert.equal(retrievedReview["comment"], "Kind, careful, and thorough.");
  });

  it("rejects non-completed bookings", async () => {
    const created = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId,
        serviceId,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        address: "99 Review Lane",
        city: "Toronto",
      }),
    });
    const bookingId = (created.body["booking"] as { id: number }).id;
    const result = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId, rating: 4 }),
    });
    assert.equal(result.status, 400);
  });

  it("rejects a different client, providers, and admins", async () => {
    const bookingId = await createCompletedBooking();
    for (const [token, expectedStatus] of [
      [otherClientToken, 403],
      [providerToken, 403],
      [adminToken, 403],
    ] as const) {
      const result = await apiFetch("/reviews", {
        method: "POST",
        token,
        body: JSON.stringify({ bookingId, rating: 4 }),
      });
      assert.equal(result.status, expectedStatus);
    }

    const lookup = await apiFetch(`/reviews/booking/${bookingId}`, { token: otherClientToken });
    assert.equal(lookup.status, 404);
  });

  it("rejects invalid ratings and overlong comments", async () => {
    const bookingId = await createCompletedBooking();
    for (const payload of [
      { bookingId, rating: 0 },
      { bookingId, rating: 6 },
      { bookingId, rating: 2.5 },
      { bookingId, rating: 4, comment: "x".repeat(1001) },
    ]) {
      const result = await apiFetch("/reviews", {
        method: "POST",
        token: clientToken,
        body: JSON.stringify(payload),
      });
      assert.equal(result.status, 400);
    }
  });
});

describe("Review duplicate protection", () => {
  it("rejects a repeated submission", async () => {
    const bookingId = await createCompletedBooking();
    const payload = { bookingId, rating: 4, comment: "A helpful visit." };
    const first = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 201);

    const second = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(payload),
    });
    assert.equal(second.status, 409);
  });

  it("allows exactly one winner for concurrent submissions", async () => {
    const bookingId = await createCompletedBooking();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        apiFetch("/reviews", {
          method: "POST",
          token: clientToken,
          body: JSON.stringify({ bookingId, rating: (index % 5) + 1 }),
        }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 201).length, 1);
    assert.equal(results.filter((result) => result.status === 409).length, 7);
  });
});