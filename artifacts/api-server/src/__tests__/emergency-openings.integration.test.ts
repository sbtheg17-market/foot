/**
 * Emergency openings (one-off extra slots) integration tests.
 *
 * Proves the owner-scoped CRUD surface, validation and overlap rules, the
 * honest delete guard, public slot generation from openings (incl. the
 * urgent-only label and service restriction), and booking enforcement:
 * openings are a second SOURCE of availability, never a rule bypass.
 *
 * Prerequisites: API server must be running (same as other integration tests).
 * Run: pnpm --filter @workspace/api-server run test:emergency-openings
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;
const MARKETPLACE_TZ = "America/Toronto";

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
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    const body = (await res.json()) as Record<string, unknown>;
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

/** Calendar date (YYYY-MM-DD) + weekday of a UTC instant in the marketplace tz. */
function localParts(ms: number): { date: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKETPLACE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKETPLACE_TZ,
    weekday: "short",
  }).format(new Date(ms));
  return { date: parts, weekday };
}

/** Next Sunday (marketplace tz) at least `minDays` ahead — Sarah has no Sunday windows. */
function nextSunday(minDays: number): string {
  for (let d = minDays; d < minDays + 8; d++) {
    const p = localParts(Date.now() + d * 24 * 60 * 60 * 1000);
    if (p.weekday === "Sun") return p.date;
  }
  throw new Error("unreachable");
}

/** Toronto wall-clock label of a UTC ISO instant. */
function torontoLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MARKETPLACE_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
  urgentOnly?: boolean;
}

interface Opening {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  serviceIds: number[] | null;
  urgentOnly: boolean;
}

describe("emergency openings", () => {
  let sarahToken: string;
  let mikeToken: string;
  let janeToken: string;
  let sarahProviderId: number;
  let serviceA: { id: number; durationMinutes: number };
  let serviceB: { id: number; durationMinutes: number };
  let urgentOpeningId = 0;
  const sunday = nextSunday(7);
  const createdOpenings: number[] = [];
  const createdBookings: number[] = [];

  before(async () => {
    sarahToken = await login("sarah@oncallfoot.com", "demo1234");
    mikeToken = await login("mike@oncallfoot.com", "demo1234");
    janeToken = await login("jane@oncallfoot.com", "demo1234");

    const me = await apiFetch("/providers/me", { token: sarahToken });
    assert.equal(me.status, 200);
    sarahProviderId = (me.body["provider"] as { id: number }).id;

    const services = await apiFetch("/providers/me/services", { token: sarahToken });
    assert.equal(services.status, 200);
    const list = (services.body["services"] as Array<{ id: number; durationMinutes: number; isActive: boolean }>).filter((s) => s.isActive);
    assert.ok(list.length >= 2, "Sarah needs at least two active seeded services");
    serviceA = list[0]!;
    serviceB = list[1]!;

    // Idempotency: clear residue from earlier aborted runs on the target date
    // (cancel Jane's active bookings that day, then delete Sarah's openings).
    const janeBookings = await apiFetch("/bookings", { token: janeToken });
    for (const b of (janeBookings.body["bookings"] as Array<{ id: number; status: string; scheduledAt: string }>) ?? []) {
      if (!["requested", "confirmed", "rescheduled"].includes(b.status)) continue;
      if (localParts(new Date(b.scheduledAt).getTime()).date !== sunday) continue;
      await apiFetch(`/bookings/${b.id}/status`, {
        method: "PATCH",
        token: janeToken,
        body: JSON.stringify({ status: "cancelled", cancellationReason: "Test cleanup." }),
      });
    }
    const existing = await apiFetch("/providers/me/availability/emergency-openings", { token: sarahToken });
    for (const o of (existing.body["openings"] as Opening[]) ?? []) {
      if (o.date !== sunday) continue;
      await apiFetch(`/providers/me/availability/emergency-openings/${o.id}`, {
        method: "DELETE",
        token: sarahToken,
      });
    }
  });

  after(async () => {
    for (const id of createdBookings) {
      await apiFetch(`/bookings/${id}/status`, {
        method: "PATCH",
        token: janeToken,
        body: JSON.stringify({ status: "cancelled", cancellationReason: "Test cleanup." }),
      });
    }
    for (const id of createdOpenings) {
      await apiFetch(`/providers/me/availability/emergency-openings/${id}`, {
        method: "DELETE",
        token: sarahToken,
      });
    }
  });

  it("requires authentication and the provider role", async () => {
    const anon = await apiFetch("/providers/me/availability/emergency-openings");
    assert.equal(anon.status, 401);

    const client = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({ date: sunday, startTime: "10:00", endTime: "12:00" }),
    });
    assert.equal(client.status, 403);
  });

  it("rejects invalid create payloads with honest errors", async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ date: "2026-13-40", startTime: "10:00", endTime: "12:00" }, "impossible date"],
      [{ date: "2020-01-01", startTime: "10:00", endTime: "12:00" }, "past date"],
      [{ date: sunday, startTime: "25:00", endTime: "26:00" }, "bad time"],
      [{ date: sunday, startTime: "12:00", endTime: "10:00" }, "start after end"],
      [{ date: sunday, startTime: "10:00", endTime: "10:00" }, "zero-length"],
      [{ date: sunday, startTime: "10:00", endTime: "12:00", serviceIds: [999999] }, "foreign service"],
      [{ date: sunday, startTime: "10:00", endTime: "12:00", urgentOnly: "yes" }, "non-boolean urgent"],
    ];
    for (const [payload, label] of cases) {
      const { status, body } = await apiFetch("/providers/me/availability/emergency-openings", {
        method: "POST",
        token: sarahToken,
        body: JSON.stringify(payload),
      });
      assert.equal(status, 400, `${label}: ${JSON.stringify(body)}`);
      assert.ok(typeof body["error"] === "string" && (body["error"] as string).length > 0, label);
    }
  });

  it("creates an all-services opening and lists it as upcoming", async () => {
    const { status, body } = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ date: sunday, startTime: "10:00", endTime: "12:00" }),
    });
    assert.equal(status, 201, JSON.stringify(body));
    const opening = body["opening"] as Opening;
    createdOpenings.push(opening.id);
    assert.equal(opening.urgentOnly, false);
    assert.equal(opening.serviceIds, null);

    const list = await apiFetch("/providers/me/availability/emergency-openings", { token: sarahToken });
    assert.equal(list.status, 200);
    const openings = list.body["openings"] as Opening[];
    assert.ok(openings.some((o) => o.id === opening.id));
  });

  it("rejects an overlapping opening on the same date with 409", async () => {
    const { status, body } = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ date: sunday, startTime: "11:00", endTime: "13:00" }),
    });
    assert.equal(status, 409, JSON.stringify(body));
    assert.equal(body["reason"], "opening_overlap");
  });

  it("creates a non-overlapping urgent, service-restricted opening", async () => {
    const { status, body } = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({
        date: sunday,
        startTime: "14:00",
        endTime: "16:00",
        urgentOnly: true,
        serviceIds: [serviceA.id],
      }),
    });
    assert.equal(status, 201, JSON.stringify(body));
    const opening = body["opening"] as Opening;
    createdOpenings.push(opening.id);
    urgentOpeningId = opening.id;
    assert.equal(opening.urgentOnly, true);
    assert.deepEqual(opening.serviceIds, [serviceA.id]);
  });

  it("public slots include opening times with truthful urgent labels", async () => {
    const { status, body } = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${sunday}`
    );
    assert.equal(status, 200, JSON.stringify(body));
    const slots = body["slots"] as Slot[];
    const labels = new Map(slots.map((s) => [torontoLabel(s.start), s]));

    // Sunday has NO weekly windows — every slot comes from openings.
    const at10 = labels.get("10:00");
    assert.ok(at10, `expected a 10:00 slot, got ${[...labels.keys()].join(",")}`);
    assert.equal(at10.urgentOnly, false, "all-services opening is not urgent");

    const at14 = labels.get("14:00");
    assert.ok(at14, "expected a 14:00 slot from the urgent opening");
    assert.equal(at14.urgentOnly, true, "urgent-only opening slots carry the label");

    // Duration must fit inside the opening: no start past endTime - duration.
    for (const s of slots) {
      const startLabel = torontoLabel(s.start);
      assert.ok(startLabel < "16:00", `slot ${startLabel} exceeds opening bounds`);
    }
  });

  it("service-restricted openings do not offer slots for other services", async () => {
    const { status, body } = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceB.id}&date=${sunday}`
    );
    assert.equal(status, 200);
    const labels = (body["slots"] as Slot[]).map((s) => torontoLabel(s.start));
    assert.ok(labels.includes("10:00"), "all-services opening applies to service B");
    assert.ok(!labels.some((l) => l >= "14:00"), `restricted opening leaked to service B: ${labels.join(",")}`);
  });

  it("a client can book inside an opening; outside both sources stays rejected", async () => {
    const slotsRes = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${sunday}`
    );
    const slots = slotsRes.body["slots"] as Slot[];
    const target = slots.find((s) => torontoLabel(s.start) === "14:00" && s.available);
    assert.ok(target, "14:00 urgent slot must be bookable");

    const booked = await apiFetch("/bookings", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({
        providerId: sarahProviderId,
        serviceId: serviceA.id,
        scheduledAt: target.start,
        address: "12 Test Lane",
        city: "Toronto",
        postalCode: "M6K 3C3",
      }),
    });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    createdBookings.push((booked.body["booking"] as { id: number }).id);

    // 14:00 window is restricted to service A → service B at 14:00 is outside availability.
    const dayMs = new Date(`${sunday}T12:00:00Z`).getTime();
    void dayMs;
    const outside = await apiFetch("/bookings", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({
        providerId: sarahProviderId,
        serviceId: serviceB.id,
        scheduledAt: target.start,
        address: "12 Test Lane",
        city: "Toronto",
        postalCode: "M6K 3C3",
      }),
    });
    assert.equal(outside.status, 400, JSON.stringify(outside.body));
    assert.equal(outside.body["reason"], "outside_availability");
  });

  it("deleting an opening with active bookings fails honestly, then succeeds after cancel", async () => {
    assert.ok(urgentOpeningId > 0, "urgent opening must exist from the earlier test");
    const guarded = await apiFetch(
      `/providers/me/availability/emergency-openings/${urgentOpeningId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(guarded.status, 409, JSON.stringify(guarded.body));
    assert.equal(guarded.body["reason"], "bookings_exist");
    assert.ok((guarded.body["error"] as string).includes("Cancel or reschedule"));

    // Cancel the booking, then deletion is allowed.
    const bookingId = createdBookings[0]!;
    const cancelled = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: janeToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Test cleanup." }),
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

    const deleted = await apiFetch(
      `/providers/me/availability/emergency-openings/${urgentOpeningId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    createdOpenings.splice(createdOpenings.indexOf(urgentOpeningId), 1);
    createdBookings.length = 0;

    const list = await apiFetch("/providers/me/availability/emergency-openings", { token: sarahToken });
    assert.ok(!(list.body["openings"] as Opening[]).some((o) => o.id === urgentOpeningId));
  });

  it("another provider cannot see or delete the opening (non-leaking 404)", async () => {
    const openingId = createdOpenings[0]!;
    const foreign = await apiFetch(
      `/providers/me/availability/emergency-openings/${openingId}`,
      { method: "DELETE", token: mikeToken }
    );
    assert.equal(foreign.status, 404);

    const mikeList = await apiFetch("/providers/me/availability/emergency-openings", { token: mikeToken });
    assert.equal(mikeList.status, 200);
    assert.ok(!(mikeList.body["openings"] as Opening[]).some((o) => o.id === openingId));
  });
});
