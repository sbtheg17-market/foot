/**
 * Client care-history integration coverage.
 *
 * Prerequisites: API server must be running and seeded.
 * Run: pnpm --filter @workspace/api-server run test:care-history
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
const janeHistoryIds: number[] = [];

async function createCompletedBooking(clientTokenForBooking: string, index: number): Promise<number> {
  const created = await apiFetch("/bookings", {
    method: "POST",
    token: clientTokenForBooking,
    body: JSON.stringify({
      providerId,
      serviceId,
      scheduledAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      address: `${100 + index} History Lane`,
      city: "Toronto",
      postalCode: "M5V 2K3",
      careNotes: `Private care note ${index} must never be returned to clients.`,
      clientNotes: `Client-visible visit note ${index}`,
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

describe("Care-history integration setup", () => {
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
});

describe("Client-safe care history", () => {
  it("returns only the authenticated client's bounded history with provider and service summaries", async () => {
    const createdIds = await Promise.all([
      createCompletedBooking(clientToken, 0),
      createCompletedBooking(clientToken, 1),
      createCompletedBooking(clientToken, 2),
    ]);
    janeHistoryIds.push(...createdIds);

    const result = await apiFetch("/bookings/history?limit=2&offset=0", { token: clientToken });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body["limit"], 2);
    assert.equal(result.body["offset"], 0);
    assert.equal((result.body["total"] as number) >= 3, true);

    const history = result.body["history"] as Array<Record<string, unknown>>;
    assert.equal(history.length, 2);
    assert.equal(JSON.stringify(result.body).includes("careNotes"), false);
    assert.equal(JSON.stringify(result.body).includes("Private care note"), false);

    const fullResult = await apiFetch("/bookings/history?limit=50&offset=0", { token: clientToken });
    assert.equal(fullResult.status, 200);
    const fullHistory = fullResult.body["history"] as Array<Record<string, unknown>>;
    const entry = fullHistory.find((item) => Number(item["id"]) === createdIds[0]);
    assert.ok(entry);
    assert.equal(entry["status"], "completed");
    assert.equal(entry["clientNotes"], "Client-visible visit note 0");
    assert.deepEqual(Object.keys(entry["provider"] as object).sort(), [
      "avatarUrl",
      "city",
      "firstName",
      "id",
      "lastName",
      "title",
    ]);
    assert.deepEqual(Object.keys(entry["service"] as object).sort(), [
      "category",
      "durationMinutes",
      "id",
      "priceCents",
      "title",
    ]);
  });

  it("denies non-client roles and unauthenticated requests", async () => {
    const providerResult = await apiFetch("/bookings/history", { token: providerToken });
    assert.equal(providerResult.status, 403);

    const adminResult = await apiFetch("/bookings/history", { token: adminToken });
    assert.equal(adminResult.status, 403);

    const unauthenticatedResult = await apiFetch("/bookings/history");
    assert.equal(unauthenticatedResult.status, 401);
  });

  it("does not expose another client's history", async () => {
    const otherClientResult = await apiFetch("/bookings/history", { token: otherClientToken });
    assert.equal(otherClientResult.status, 200);
    const otherHistory = otherClientResult.body["history"] as Array<Record<string, unknown>>;
    assert.equal(otherHistory.some((item) => janeHistoryIds.includes(item["id"] as number)), false);
    assert.equal(JSON.stringify(otherClientResult.body).includes("Private care note"), false);
  });

  it("keeps care notes out of the client's regular booking list and detail responses", async () => {
    const bookingId = await createCompletedBooking(clientToken, 10);

    const listResult = await apiFetch("/bookings?limit=1&offset=0", { token: clientToken });
    assert.equal(listResult.status, 200);
    assert.equal(JSON.stringify(listResult.body).includes("careNotes"), false);
    assert.equal(JSON.stringify(listResult.body).includes("Private care note"), false);

    const detailResult = await apiFetch(`/bookings/${bookingId}`, { token: clientToken });
    assert.equal(detailResult.status, 200);
    assert.equal(JSON.stringify(detailResult.body).includes("careNotes"), false);
    assert.equal(JSON.stringify(detailResult.body).includes("Private care note"), false);
  });
});