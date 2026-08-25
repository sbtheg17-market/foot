/**
 * Focused integration tests: rescheduling enforcement.
 *
 * A rescheduled booking must obey the SAME safety principles as a new booking:
 * client/provider authorization, valid booking state and allowed transition,
 * active service, availability-window fit, future real datetime, no provider
 * overlap, and no active duplicate reservation — with consistent friendly
 * error behavior (no PostgreSQL internals ever leaked).
 *
 * Exercises PATCH /bookings/:bookingId/status with status="rescheduled"
 * against a running API server on a seeded scratch PostgreSQL.
 *
 * Prerequisites:
 *   DATABASE_URL=<scratch>  JWT_SECRET=<any>  PORT=<port>
 *   pnpm --filter @workspace/db run push && pnpm run seed
 *   pnpm --filter @workspace/api-server run dev   (or built dist)
 *
 * Run: node --import tsx/esm --test src/__tests__/rescheduling-enforcement.integration.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import {
  db,
  pool,
  bookingsTable,
  servicesTable,
  invoicesTable,
  marketplaceEventsTable,
  preventedBookingRecordsTable,
  reviewsTable,
  rescheduleProposalsTable,
  rescheduleHistoryTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

// Seeded fixtures (see artifacts/api-server/src/seed.ts):
//   Sarah = provider_profiles.id 1, approved, availability Mon–Fri 09:00–17:00
//   local (America/Toronto). Service 1 = 60 minutes, active.
const PROVIDER_ID = 1;
const SERVICE_ID = 1;

// Friendly messages — must stay byte-identical to booking creation.
const DUPLICATE_BOOKING_MESSAGE =
  "You already have an active request for this provider, service, and time. Check your bookings before submitting again.";
const PROVIDER_UNAVAILABLE_MESSAGE =
  "That time overlaps another appointment for this provider. Please choose another available time.";

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
 * A calendar Monday ~90 days out (other suites use ~60 days — no collisions).
 * All UTC hour labels used below (15:00–19:00Z) fall inside Sarah's local
 * 09:00–17:00 window under both EDT (UTC-4) and EST (UTC-5), so the suite is
 * stable across DST boundaries.
 */
function futureMondayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 90);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function createBooking(
  token: string,
  scheduledAt: string,
): Promise<number> {
  const res = await api("/bookings", {
    method: "POST",
    token,
    body: JSON.stringify({
      providerId: PROVIDER_ID,
      serviceId: SERVICE_ID,
      scheduledAt,
      address: "1 Test St",
      city: "Toronto",
    }),
  });
  assert.equal(res.status, 201, `booking create failed: ${JSON.stringify(res.body)}`);
  return (res.body["booking"] as { id: number }).id;
}

async function patchStatus(
  token: string,
  bookingId: number,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return api(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

/** Remove this suite's far-future bookings (and FK dependents) so reruns are clean. */
async function cleanupTestWindow(date: string): Promise<void> {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, PROVIDER_ID),
        gte(bookingsTable.scheduledAt, start),
        lt(bookingsTable.scheduledAt, end),
      ),
    );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  await db
    .delete(rescheduleHistoryTable)
    .where(inArray(rescheduleHistoryTable.bookingId, ids));
  await db
    .delete(rescheduleProposalsTable)
    .where(inArray(rescheduleProposalsTable.bookingId, ids));
  await db.delete(reviewsTable).where(inArray(reviewsTable.bookingId, ids));
  await db.delete(invoicesTable).where(inArray(invoicesTable.bookingId, ids));
  await db
    .delete(marketplaceEventsTable)
    .where(inArray(marketplaceEventsTable.bookingId, ids));
  await db
    .delete(preventedBookingRecordsTable)
    .where(inArray(preventedBookingRecordsTable.subjectBookingId, ids));
  await db.delete(bookingsTable).where(inArray(bookingsTable.id, ids));
}

describe("rescheduling enforcement", () => {
  let jane = "";
  let tom = "";
  let sarah = "";
  let date = "";
  let bookingA = 0; // jane's confirmed booking — the reschedule subject
  let bookingB = 0; // jane's requested booking at 18:00Z — duplicate target

  before(async () => {
    [jane, tom, sarah] = await Promise.all([
      login("jane@oncallfoot.com"),
      login("tom@oncallfoot.com"),
      login("sarah@oncallfoot.com"),
    ]);
    date = futureMondayDate();
    await cleanupTestWindow(date);

    // Jane books 15:00Z and Sarah confirms — a reschedulable booking.
    bookingA = await createBooking(jane, `${date}T15:00:00.000Z`);
    const confirm = await patchStatus(sarah, bookingA, { status: "confirmed" });
    assert.equal(confirm.status, 200, "provider confirm failed");

    // Jane also holds an ACTIVE requested booking at 18:00Z (duplicate target).
    bookingB = await createBooking(jane, `${date}T18:00:00.000Z`);
  });

  after(async () => {
    await pool.end();
  });

  it("rejects a reschedule by a client who does not own the booking", async () => {
    const res = await patchStatus(tom, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T16:00:00.000Z`,
    });
    assert.equal(res.status, 403);
  });

  it("rejects a client reschedule of a merely requested booking (state machine)", async () => {
    const res = await patchStatus(jane, bookingB, {
      status: "rescheduled",
      scheduledAt: `${date}T16:00:00.000Z`,
    });
    assert.equal(res.status, 409);
  });

  it("requires scheduledAt when rescheduling", async () => {
    const res = await patchStatus(jane, bookingA, { status: "rescheduled" });
    assert.equal(res.status, 400);
    assert.match(String(res.body["error"]), /scheduledAt is required/);
  });

  it("rejects a malformed scheduledAt with a friendly 400 (never a 500)", async () => {
    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: "not-a-real-datetime",
    });
    assert.equal(res.status, 400);
    assert.match(String(res.body["error"]), /valid date-time/);
  });

  it("rejects rescheduling into the past", async () => {
    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: "2000-01-03T15:00:00.000Z",
    });
    assert.equal(res.status, 400);
    assert.match(String(res.body["error"]), /future/);
  });

  it("rejects a time outside the provider's availability", async () => {
    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T03:00:00.000Z`, // pre-dawn local — outside window
    });
    assert.equal(res.status, 400);
    assert.match(String(res.body["error"]), /outside this provider's availability/);
  });

  it("rejects a reschedule overlapping another client's active booking", async () => {
    // Tom holds 16:30Z–17:30Z (requested = active) — 30 min clear of
    // bookingA's 15:00Z–16:00Z (travel/setup buffer, roadmap #12).
    const tomBooking = await createBooking(tom, `${date}T16:30:00.000Z`);
    assert.ok(tomBooking > 0);

    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T17:00:00.000Z`, // overlaps 16:30–17:30
    });
    assert.equal(res.status, 409);
    assert.equal(res.body["error"], PROVIDER_UNAVAILABLE_MESSAGE);
  });

  it("rejects a reschedule onto the client's own active duplicate tuple", async () => {
    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T18:00:00.000Z`, // exactly bookingB's active slot
    });
    assert.equal(res.status, 409);
    assert.equal(res.body["error"], DUPLICATE_BOOKING_MESSAGE);
  });

  it("rejects rescheduling a booking whose service is no longer active", async () => {
    await db
      .update(servicesTable)
      .set({ isActive: false })
      .where(eq(servicesTable.id, SERVICE_ID));
    try {
      const res = await patchStatus(jane, bookingA, {
        status: "rescheduled",
        scheduledAt: `${date}T17:00:00.000Z`,
      });
      assert.equal(res.status, 409);
      assert.match(String(res.body["error"]), /no longer offered/);
    } finally {
      await db
        .update(servicesTable)
        .set({ isActive: true })
        .where(eq(servicesTable.id, SERVICE_ID));
    }
  });

  it("client reschedules: too-close times are buffer-blocked, buffered slot succeeds", async () => {
    // 17:30Z starts exactly when Tom's 16:30Z booking ends — back-to-back is
    // now rejected by the 30-minute travel/setup buffer (roadmap #12).
    const adjacent = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T17:30:00.000Z`,
    });
    assert.equal(adjacent.status, 409);
    assert.equal(adjacent.body["reason"], "travel_buffer_conflict");

    // 20:00Z is ≥30 min clear of every other booking and ends exactly at the
    // window end — a valid free slot under the buffer rule.
    const res = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T20:00:00.000Z`,
    });
    assert.equal(res.status, 200);
    const booking = res.body["booking"] as Record<string, unknown>;
    assert.equal(booking["status"], "rescheduled");
    assert.equal(
      new Date(String(booking["scheduledAt"])).toISOString(),
      `${date}T20:00:00.000Z`,
    );
    // Client-safe projection still holds on the reschedule path.
    assert.ok(!("careNotes" in booking));
  });

  it("provider re-confirms; direct provider reschedule is refused (consent-first)", async () => {
    const confirm = await patchStatus(sarah, bookingA, { status: "confirmed" });
    assert.equal(confirm.status, 200);

    // Consent-first policy: a provider can no longer overwrite the client's
    // confirmed time — the status route points to the proposal workflow.
    const res = await patchStatus(sarah, bookingA, {
      status: "rescheduled",
      scheduledAt: `${date}T19:00:00.000Z`,
    });
    assert.equal(res.status, 409);
    assert.match(String(res.body["error"]), /require client consent/i);

    // The confirmed time is untouched.
    const detail = await api(`/bookings/${bookingA}`, { token: sarah });
    assert.equal(detail.status, 200);
    const booking = detail.body["booking"] as Record<string, unknown>;
    assert.equal(booking["status"], "confirmed");
    assert.equal(
      new Date(String(booking["scheduledAt"])).toISOString(),
      `${date}T20:00:00.000Z`,
    );
  });

  it("terminal bookings can never be rescheduled", async () => {
    const cancel = await patchStatus(jane, bookingB, {
      status: "cancelled",
      cancellationReason: "test cleanup",
    });
    assert.equal(cancel.status, 200);

    const res = await patchStatus(jane, bookingB, {
      status: "rescheduled",
      scheduledAt: `${date}T17:00:00.000Z`,
    });
    assert.equal(res.status, 409);
  });
});
