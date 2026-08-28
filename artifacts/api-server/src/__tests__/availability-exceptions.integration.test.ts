/**
 * Availability Exceptions (Phase B — blocked dates) integration tests.
 *
 * Proves: provider-owned CRUD on /providers/me/availability/exceptions,
 * validation (format, past date, reason length), duplicate 409, role gating,
 * non-leaking public slots suppression on a blocked date, booking-creation
 * rejection, direct-reschedule target rejection, and restoration after
 * unblocking.
 *
 * Prerequisites: seeded scratch DB + running API server (same as other
 * integration suites — see availability-enforced-booking.test.ts).
 * Run: pnpm --filter @workspace/api-server run test:availability-exceptions
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

// Seeded fixtures (artifacts/api-server/src/seed.ts):
//   Sarah = provider_profiles.id 1, approved, availability Mon–Fri 09:00–17:00.
//   Service 1 = 60 minutes.
const PROVIDER_ID = 1;
const SERVICE_ID = 1;

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

/**
 * A far-future weekday (Mon–Fri) date string, offset to avoid colliding with
 * other suites' far-future Mondays (+60d). 14:00 UTC = 09:00/10:00 Toronto —
 * inside the seeded 09:00–17:00 window year-round.
 */
function futureWeekday(extraDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 120 + extraDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

type ExceptionRow = {
  id: number;
  providerId: number;
  date: string;
  type: string;
  reason: string | null;
};

async function listExceptions(token: string): Promise<ExceptionRow[]> {
  const res = await api("/providers/me/availability/exceptions", { token });
  assert.equal(res.status, 200);
  return res.body["exceptions"] as ExceptionRow[];
}

async function cleanupDates(token: string, dates: string[]): Promise<void> {
  const existing = await listExceptions(token);
  for (const ex of existing) {
    if (dates.includes(ex.date)) {
      await api(`/providers/me/availability/exceptions/${ex.id}`, {
        method: "DELETE",
        token,
      });
    }
  }
}

describe("availability exceptions (blocked dates)", () => {
  let sarah = "";
  let jane = "";
  let blockedDate = "";
  let freeDate = "";
  const trackedDates: string[] = [];

  before(async () => {
    sarah = await login("sarah@oncallfoot.com");
    jane = await login("jane@oncallfoot.com");
    blockedDate = futureWeekday(0);
    freeDate = futureWeekday(7);
    trackedDates.push(blockedDate, freeDate);
    // Idempotent across loop reruns.
    await cleanupDates(sarah, trackedDates);
  });

  after(async () => {
    await cleanupDates(sarah, trackedDates);
  });

  it("requires auth and provider role", async () => {
    const anon = await api("/providers/me/availability/exceptions");
    assert.equal(anon.status, 401);

    const asClient = await api("/providers/me/availability/exceptions", {
      token: jane,
    });
    assert.equal(asClient.status, 403);

    const clientPost = await api("/providers/me/availability/exceptions", {
      method: "POST",
      token: jane,
      body: JSON.stringify({ date: blockedDate }),
    });
    assert.equal(clientPost.status, 403);
  });

  it("rejects malformed, impossible, and past dates plus oversized reasons", async () => {
    for (const bad of ["not-a-date", "2026-13-01", "2026-02-30", "20260101"]) {
      const res = await api("/providers/me/availability/exceptions", {
        method: "POST",
        token: sarah,
        body: JSON.stringify({ date: bad }),
      });
      assert.equal(res.status, 400, `expected 400 for date=${bad}`);
    }

    const past = await api("/providers/me/availability/exceptions", {
      method: "POST",
      token: sarah,
      body: JSON.stringify({ date: "2000-01-03" }),
    });
    assert.equal(past.status, 400);

    const longReason = await api("/providers/me/availability/exceptions", {
      method: "POST",
      token: sarah,
      body: JSON.stringify({ date: blockedDate, reason: "x".repeat(201) }),
    });
    assert.equal(longReason.status, 400);
  });

  it("blocks a future date with a private reason and lists it", async () => {
    const res = await api("/providers/me/availability/exceptions", {
      method: "POST",
      token: sarah,
      body: JSON.stringify({ date: blockedDate, reason: "  Vacation day  " }),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const created = res.body["exception"] as ExceptionRow;
    assert.equal(created.date, blockedDate);
    assert.equal(created.type, "blocked");
    assert.equal(created.reason, "Vacation day"); // trimmed

    const listed = await listExceptions(sarah);
    assert.ok(listed.some((e) => e.date === blockedDate));
  });

  it("rejects a duplicate block for the same date with 409", async () => {
    const res = await api("/providers/me/availability/exceptions", {
      method: "POST",
      token: sarah,
      body: JSON.stringify({ date: blockedDate }),
    });
    assert.equal(res.status, 409);
  });

  it("public slots are empty on the blocked date and unchanged on a free date — no leak", async () => {
    const blocked = await api(
      `/providers/${PROVIDER_ID}/slots?serviceId=${SERVICE_ID}&date=${blockedDate}`,
    );
    assert.equal(blocked.status, 200);
    assert.deepEqual(blocked.body["slots"], []);
    // Non-leaking: same stable shape, no reason/exception fields.
    const serialized = JSON.stringify(blocked.body);
    assert.ok(!serialized.includes("Vacation"));
    assert.ok(!serialized.toLowerCase().includes("exception"));
    assert.ok(!serialized.toLowerCase().includes("blocked"));

    const free = await api(
      `/providers/${PROVIDER_ID}/slots?serviceId=${SERVICE_ID}&date=${freeDate}`,
    );
    assert.equal(free.status, 200);
    assert.ok((free.body["slots"] as unknown[]).length > 0);
  });

  it("rejects new bookings on the blocked date with the existing reason code", async () => {
    const res = await api("/bookings", {
      method: "POST",
      token: jane,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${blockedDate}T14:00:00.000Z`,
        address: "1 Main St",
        city: "Toronto",
      }),
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body["reason"], "outside_availability");
    assert.match(String(res.body["error"]), /not taking bookings/i);
  });

  it("rejects a direct client reschedule onto the blocked date; original booking survives", async () => {
    const create = await api("/bookings", {
      method: "POST",
      token: jane,
      body: JSON.stringify({
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        scheduledAt: `${freeDate}T14:00:00.000Z`,
        address: "1 Main St",
        city: "Toronto",
      }),
    });
    assert.ok([201, 409].includes(create.status), JSON.stringify(create.body));
    // Reuse a leftover active booking from a previous interrupted run.
    const booking = create.body["booking"] as { id: number } | undefined;
    const bookingId =
      create.status === 201 ? booking?.id : (create.body["bookingId"] as number);
    assert.ok(bookingId, "booking id missing");

    try {
      const confirm = await api(`/bookings/${bookingId}/status`, {
        method: "PATCH",
        token: sarah,
        body: JSON.stringify({ status: "confirmed" }),
      });
      assert.ok(
        [200, 409].includes(confirm.status), // 409 = already confirmed (rerun)
        JSON.stringify(confirm.body),
      );

      const reschedule = await api(`/bookings/${bookingId}/status`, {
        method: "PATCH",
        token: jane,
        body: JSON.stringify({
          status: "rescheduled",
          scheduledAt: `${blockedDate}T15:00:00.000Z`,
        }),
      });
      assert.equal(reschedule.status, 400, JSON.stringify(reschedule.body));
      assert.match(String(reschedule.body["error"]), /not taking bookings/i);
    } finally {
      // Cleanup so loop reruns never collide.
      await api(`/bookings/${bookingId}/status`, {
        method: "PATCH",
        token: jane,
        body: JSON.stringify({ status: "cancelled" }),
      });
    }
  });

  it("unblocking the date restores public slots", async () => {
    const listed = await listExceptions(sarah);
    const target = listed.find((e) => e.date === blockedDate);
    assert.ok(target, "blocked date should exist before delete");

    const del = await api(
      `/providers/me/availability/exceptions/${target!.id}`,
      { method: "DELETE", token: sarah },
    );
    assert.equal(del.status, 200);

    const slots = await api(
      `/providers/${PROVIDER_ID}/slots?serviceId=${SERVICE_ID}&date=${blockedDate}`,
    );
    assert.equal(slots.status, 200);
    assert.ok((slots.body["slots"] as unknown[]).length > 0);
  });

  it("deleting a non-existent or foreign exception returns 404", async () => {
    const res = await api("/providers/me/availability/exceptions/999999", {
      method: "DELETE",
      token: sarah,
    });
    assert.equal(res.status, 404);
  });
});
