/**
 * Blocked ranges (vacation / time off) integration tests.
 *
 * Proves the owner-scoped CRUD surface, validation, range-overlap and
 * mutual-exclusion rules (emergency openings ⟷ blocked ranges), the honest
 * active-booking 409 guard at creation, blocked-day slot suppression and
 * booking enforcement, and guard-free deletion that re-opens the days.
 *
 * Prerequisites: API server must be running (same as other integration tests).
 * Run: pnpm --filter @workspace/api-server run test:vacation-ranges
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
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKETPLACE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKETPLACE_TZ,
    weekday: "short",
  }).format(new Date(ms));
  return { date, weekday };
}

/** Next Monday (marketplace tz) at least `minDays` ahead — Sarah works Mon–Fri. */
function nextMonday(minDays: number): string {
  for (let d = minDays; d < minDays + 8; d++) {
    const p = localParts(Date.now() + d * 24 * 60 * 60 * 1000);
    if (p.weekday === "Mon") return p.date;
  }
  throw new Error("unreachable");
}

/** Pure calendar arithmetic on YYYY-MM-DD (no timezone involved). */
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
}

interface BlockedRange {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

describe("blocked ranges (vacation / time off)", () => {
  let sarahToken: string;
  let mikeToken: string;
  let janeToken: string;
  let sarahProviderId: number;
  let serviceA: { id: number; durationMinutes: number };
  let rangeAId = 0;
  let mondayPreSlotStart = "";

  // Test window: Mon..Sun, ≥30 days out to stay clear of other suites' data.
  const monday = nextMonday(30);
  const wednesday = addDays(monday, 2); // range A = Mon..Wed
  const tuesday = addDays(monday, 1);
  const thursday = addDays(monday, 3);
  const sunday = addDays(monday, 6);
  const createdRanges: number[] = [];
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
    assert.ok(list.length >= 1, "Sarah needs at least one active seeded service");
    serviceA = list[0]!;

    // Idempotency: clear residue from earlier aborted runs in the test window.
    const janeBookings = await apiFetch("/bookings", { token: janeToken });
    for (const b of (janeBookings.body["bookings"] as Array<{ id: number; status: string; scheduledAt: string }>) ?? []) {
      if (!["requested", "confirmed", "rescheduled"].includes(b.status)) continue;
      const d = localParts(new Date(b.scheduledAt).getTime()).date;
      if (d < monday || d > sunday) continue;
      await apiFetch(`/bookings/${b.id}/status`, {
        method: "PATCH",
        token: janeToken,
        body: JSON.stringify({ status: "cancelled", cancellationReason: "Test cleanup." }),
      });
    }
    const existingRanges = await apiFetch("/providers/me/availability/blocked-ranges", { token: sarahToken });
    for (const r of (existingRanges.body["ranges"] as BlockedRange[]) ?? []) {
      if (r.endDate < monday || r.startDate > sunday) continue;
      await apiFetch(`/providers/me/availability/blocked-ranges/${r.id}`, {
        method: "DELETE",
        token: sarahToken,
      });
    }
    const existingOpenings = await apiFetch("/providers/me/availability/emergency-openings", { token: sarahToken });
    for (const o of (existingOpenings.body["openings"] as Array<{ id: number; date: string }>) ?? []) {
      if (o.date < monday || o.date > sunday) continue;
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
    for (const id of createdRanges) {
      await apiFetch(`/providers/me/availability/blocked-ranges/${id}`, {
        method: "DELETE",
        token: sarahToken,
      });
    }
  });

  it("requires authentication and the provider role", async () => {
    const anon = await apiFetch("/providers/me/availability/blocked-ranges");
    assert.equal(anon.status, 401);

    const client = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({ startDate: monday, endDate: wednesday }),
    });
    assert.equal(client.status, 403);
  });

  it("rejects invalid create payloads with honest errors", async () => {
    const farOut = addDays(localParts(Date.now()).date, 400);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ startDate: "2026-13-40", endDate: wednesday }, "impossible startDate"],
      [{ startDate: monday, endDate: "2026-02-30" }, "impossible endDate"],
      [{ startDate: "2020-01-01", endDate: wednesday }, "past startDate"],
      [{ startDate: wednesday, endDate: monday }, "endDate before startDate"],
      [{ startDate: monday, endDate: farOut }, "beyond the 365-day horizon"],
      [{ startDate: monday, endDate: wednesday, reason: 123 }, "non-string reason"],
      [{ startDate: monday, endDate: wednesday, reason: "x".repeat(201) }, "reason too long"],
    ];
    for (const [payload, label] of cases) {
      const { status, body } = await apiFetch("/providers/me/availability/blocked-ranges", {
        method: "POST",
        token: sarahToken,
        body: JSON.stringify(payload),
      });
      assert.equal(status, 400, `${label}: ${JSON.stringify(body)}`);
      assert.ok(typeof body["error"] === "string" && (body["error"] as string).length > 0, label);
    }
  });

  it("blocks a range with a trimmed private note and lists it as upcoming", async () => {
    // Monday is a weekly-window day → slots exist BEFORE blocking.
    const pre = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${monday}`
    );
    assert.equal(pre.status, 200);
    const preSlots = pre.body["slots"] as Slot[];
    assert.ok(preSlots.length > 0, "Monday must offer weekly-window slots before blocking");
    mondayPreSlotStart = preSlots[0]!.start;

    const { status, body } = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: monday, endDate: wednesday, reason: "  Family vacation  " }),
    });
    assert.equal(status, 201, JSON.stringify(body));
    const range = body["range"] as BlockedRange;
    rangeAId = range.id;
    createdRanges.push(range.id);
    assert.equal(range.startDate, monday);
    assert.equal(range.endDate, wednesday);
    assert.equal(range.reason, "Family vacation", "reason is trimmed");

    const list = await apiFetch("/providers/me/availability/blocked-ranges", { token: sarahToken });
    assert.equal(list.status, 200);
    const ranges = list.body["ranges"] as BlockedRange[];
    const mine = ranges.find((r) => r.id === range.id);
    assert.ok(mine, "created range must be listed as upcoming");
    assert.equal(mine.reason, "Family vacation", "private note is returned to the owner");
  });

  it("rejects an overlapping range with 409 range_overlap", async () => {
    const { status, body } = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: wednesday, endDate: addDays(wednesday, 2) }),
    });
    assert.equal(status, 409, JSON.stringify(body));
    assert.equal(body["reason"], "range_overlap");
  });

  it("blocked days offer NO public slots; unblocked days are untouched", async () => {
    const blocked = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${monday}`
    );
    assert.equal(blocked.status, 200);
    assert.deepEqual(blocked.body["slots"], [], "blocked Monday must offer zero slots");

    const open = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${thursday}`
    );
    assert.equal(open.status, 200);
    assert.ok((open.body["slots"] as Slot[]).length > 0, "Thursday (outside the range) keeps its slots");
  });

  it("booking on a blocked day is rejected as outside availability", async () => {
    assert.ok(mondayPreSlotStart, "pre-block Monday slot instant must be captured");
    const { status, body } = await apiFetch("/bookings", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({
        providerId: sarahProviderId,
        serviceId: serviceA.id,
        scheduledAt: mondayPreSlotStart,
        address: "12 Test Lane",
        city: "Toronto",
        postalCode: "M6K 3C3",
      }),
    });
    assert.equal(status, 400, JSON.stringify(body));
    assert.equal(body["reason"], "outside_availability");
  });

  it("an emergency opening cannot be created on a blocked date", async () => {
    const { status, body } = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ date: tuesday, startTime: "18:00", endTime: "20:00" }),
    });
    assert.equal(status, 409, JSON.stringify(body));
    assert.equal(body["reason"], "blocked_range_conflict");
  });

  it("a range cannot cover an emergency opening until the opening is deleted", async () => {
    const opening = await apiFetch("/providers/me/availability/emergency-openings", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ date: sunday, startTime: "10:00", endTime: "12:00" }),
    });
    assert.equal(opening.status, 201, JSON.stringify(opening.body));
    const openingId = (opening.body["opening"] as { id: number }).id;
    createdOpenings.push(openingId);

    const guarded = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: sunday, endDate: sunday }),
    });
    assert.equal(guarded.status, 409, JSON.stringify(guarded.body));
    assert.equal(guarded.body["reason"], "emergency_opening_conflict");
    assert.equal(guarded.body["openingCount"], 1);

    const deleted = await apiFetch(
      `/providers/me/availability/emergency-openings/${openingId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(deleted.status, 200);
    createdOpenings.splice(createdOpenings.indexOf(openingId), 1);

    const retry = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: sunday, endDate: sunday }),
    });
    assert.equal(retry.status, 201, JSON.stringify(retry.body));
    const sundayRangeId = (retry.body["range"] as BlockedRange).id;

    const cleanup = await apiFetch(
      `/providers/me/availability/blocked-ranges/${sundayRangeId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(cleanup.status, 200);
  });

  it("a range overlapping active bookings fails honestly, then succeeds after cancel", async () => {
    const slotsRes = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${thursday}`
    );
    const slot = (slotsRes.body["slots"] as Slot[]).find((s) => s.available);
    assert.ok(slot, "Thursday must have a bookable slot");

    const booked = await apiFetch("/bookings", {
      method: "POST",
      token: janeToken,
      body: JSON.stringify({
        providerId: sarahProviderId,
        serviceId: serviceA.id,
        scheduledAt: slot.start,
        address: "12 Test Lane",
        city: "Toronto",
        postalCode: "M6K 3C3",
      }),
    });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    const bookingId = (booked.body["booking"] as { id: number }).id;
    createdBookings.push(bookingId);

    const guarded = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: thursday, endDate: thursday }),
    });
    assert.equal(guarded.status, 409, JSON.stringify(guarded.body));
    assert.equal(guarded.body["reason"], "bookings_exist");
    assert.equal(guarded.body["bookingCount"], 1);
    assert.ok((guarded.body["error"] as string).includes("Cancel or reschedule"));

    const cancelled = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: janeToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Test cleanup." }),
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    createdBookings.splice(createdBookings.indexOf(bookingId), 1);

    const retry = await apiFetch("/providers/me/availability/blocked-ranges", {
      method: "POST",
      token: sarahToken,
      body: JSON.stringify({ startDate: thursday, endDate: thursday }),
    });
    assert.equal(retry.status, 201, JSON.stringify(retry.body));
    const thursdayRangeId = (retry.body["range"] as BlockedRange).id;

    const cleanup = await apiFetch(
      `/providers/me/availability/blocked-ranges/${thursdayRangeId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(cleanup.status, 200);
  });

  it("another provider cannot see or delete the range (non-leaking 404)", async () => {
    const foreign = await apiFetch(
      `/providers/me/availability/blocked-ranges/${rangeAId}`,
      { method: "DELETE", token: mikeToken }
    );
    assert.equal(foreign.status, 404);

    const mikeList = await apiFetch("/providers/me/availability/blocked-ranges", { token: mikeToken });
    assert.equal(mikeList.status, 200);
    assert.ok(!(mikeList.body["ranges"] as BlockedRange[]).some((r) => r.id === rangeAId));
  });

  it("deleting a range needs no guard and re-opens the days", async () => {
    const deleted = await apiFetch(
      `/providers/me/availability/blocked-ranges/${rangeAId}`,
      { method: "DELETE", token: sarahToken }
    );
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    createdRanges.splice(createdRanges.indexOf(rangeAId), 1);

    const list = await apiFetch("/providers/me/availability/blocked-ranges", { token: sarahToken });
    assert.ok(!(list.body["ranges"] as BlockedRange[]).some((r) => r.id === rangeAId));

    const reopened = await apiFetch(
      `/providers/${sarahProviderId}/slots?serviceId=${serviceA.id}&date=${monday}`
    );
    assert.equal(reopened.status, 200);
    assert.ok((reopened.body["slots"] as Slot[]).length > 0, "deleting the range re-opens Monday's slots");
  });
});
