/**
 * Focused integration tests: availability-enforced booking
 * ("Real slots, no double-booking").
 *
 * Exercises the public availability + slots endpoints and the booking-creation
 * enforcement path (availability window fit, provider-level overlap rejection,
 * same-client duplicate handling) against a running API server on a seeded
 * scratch PostgreSQL.
 *
 * Prerequisites:
 *   DATABASE_URL=<scratch>  JWT_SECRET=<any>  PORT=<port>
 *   pnpm --filter @workspace/db run push && pnpm run seed
 *   pnpm --filter @workspace/api-server run dev   (or built dist)
 *
 * Run: node --import tsx/esm --test src/__tests__/availability-enforced-booking.test.ts
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

// Seeded fixtures (see artifacts/api-server/src/seed.ts):
//   Sarah = provider_profiles.id 1, approved, availability Mon–Fri 09:00–17:00.
//   Service 1 = 60 minutes.
const PROVIDER_ID = 1;
const SERVICE_ID = 1;
const SERVICE_DURATION_MIN = 60;

async function api(
  path: string,
  options: RequestInit & { token?: string } = {},
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
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty body */
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email: string): Promise<string> {
  const res = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "demo1234" }),
  });
  assert.equal(res.status, 200, `login failed for ${email}`);
  return res.body["token"] as string;
}

/** A calendar Monday, well in the future, at the given local hour (UTC label). */
function futureMondayISO(hourUtc: number): { date: string; iso: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 60);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const date = d.toISOString().slice(0, 10);
  const iso = `${date}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`;
  return { date, iso };
}

describe("availability-enforced booking", () => {
  let jane = "";
  let tom = "";
  let date = "";

  before(async () => {
    jane = await login("jane@oncallfoot.com");
    tom = await login("tom@oncallfoot.com");
    // Use a far-future Monday to avoid colliding with other suites' data.
    date = futureMondayISO(13).date;
  });

  it("public availability exposes timezone + windows and no private data", async () => {
    const res = await api(`/providers/${PROVIDER_ID}/availability`);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body["timezone"], "string");
    assert.ok(Array.isArray(res.body["windows"]));
    const serialized = JSON.stringify(res.body);
    assert.ok(!serialized.includes("clientId"));
    assert.ok(!serialized.includes("bookingId"));
    assert.ok(!serialized.includes("careNotes"));
  });

  it("slots endpoint returns 30-min slots that fit the service duration", async () => {
    const res = await api(
      `/providers/${PROVIDER_ID}/slots?serviceId=${SERVICE_ID}&date=${date}`,
    );
    assert.equal(res.status, 200);
    assert.equal(typeof res.body["timezone"], "string");
    const slots = res.body["slots"] as Array<{
      start: string;
      end: string;
      available: boolean;
    }>;
    assert.ok(slots.length > 0);
    for (const s of slots) {
      const span = new Date(s.end).getTime() - new Date(s.start).getTime();
      assert.equal(span, SERVICE_DURATION_MIN * 60000);
      assert.equal(typeof s.available, "boolean");
    }
    // 30-minute cadence between consecutive starts.
    const first = new Date(slots[0]!.start).getTime();
    const second = new Date(slots[1]!.start).getTime();
    assert.equal(second - first, 30 * 60000);
  });

  it("rejects a booking outside availability with reason outside_availability", async () => {
    const res = await api("/bookings", {
      method: "POST",
      token: tom,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${date}T03:00:00.000Z`, // 23:00 previous local day
        address: "2 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body["reason"], "outside_availability");
  });

  it("rejects a past booking with reason invalid_request", async () => {
    const res = await api("/bookings", {
      method: "POST",
      token: tom,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: "2000-01-03T14:00:00.000Z",
        address: "2 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body["reason"], "invalid_request");
  });

  it("enforces real slots, no double-booking end to end", async () => {
    const start = `${date}T13:00:00.000Z`; // 09:00 local — window start, valid

    // 1) First client books the slot.
    const first = await api("/bookings", {
      method: "POST",
      token: jane,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: start,
        address: "1 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(first.status, 201);

    // 2) A DIFFERENT client requesting the same slot → provider_unavailable,
    //    and the response leaks no ids.
    const conflict = await api("/bookings", {
      method: "POST",
      token: tom,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: start,
        address: "2 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body["reason"], "provider_unavailable");
    assert.equal(conflict.body["bookingId"], undefined);

    // 3) The SAME client re-requesting the same slot → duplicate_booking
    //    (additive reason; existing bookingId behavior preserved).
    const dup = await api("/bookings", {
      method: "POST",
      token: jane,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: start,
        address: "1 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.body["reason"], "duplicate_booking");
    assert.equal(typeof dup.body["bookingId"], "number");

    // 4) A back-to-back booking (starts exactly when the first ends) is now
    //    rejected: the 30-minute travel/setup buffer (roadmap #12) needs a
    //    gap between appointments for the same provider.
    const adjacent = await api("/bookings", {
      method: "POST",
      token: tom,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${date}T14:00:00.000Z`,
        address: "2 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(adjacent.status, 409);
    assert.equal(adjacent.body["reason"], "travel_buffer_conflict");

    // 5) A booking separated by exactly the buffer (ends 14:00Z + 30m gap →
    //    starts 14:30Z) is allowed — the buffer boundary is inclusive.
    const buffered = await api("/bookings", {
      method: "POST",
      token: tom,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${date}T14:30:00.000Z`,
        address: "2 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(buffered.status, 201);
  });

  it("allows a booking that ends exactly at the window end", async () => {
    // 16:00 local (20:00Z) + 60m = 17:00 local == window end.
    const res = await api("/bookings", {
      method: "POST",
      token: jane,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${date}T20:00:00.000Z`,
        address: "1 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(res.status, 201);
  });
});
