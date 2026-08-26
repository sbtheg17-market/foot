/**
 * Focused integration tests: consent-first provider rescheduling proposals.
 *
 * Policy (docs/rescheduling-policy.md): a provider proposal NEVER changes the
 * client's confirmed time; the client must accept. Covers authorization,
 * idempotency, single-pending enforcement, staleness, expiry, concurrency,
 * the manual-review limit, decline feasibility, cancellation interaction,
 * append-only history, and no-show state handling.
 *
 * Prerequisites: seeded scratch PostgreSQL + running API server on $PORT
 * (same as the other integration suites).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import {
  db,
  pool,
  bookingsTable,
  invoicesTable,
  reviewsTable,
  marketplaceEventsTable,
  preventedBookingRecordsTable,
  rescheduleProposalsTable,
  rescheduleHistoryTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

// Seeded fixtures: Sarah = provider profile 1 (Mon–Fri 09:00–17:00 Toronto),
// service 1 = 60 minutes active. All UTC hours used (15:00–19:00Z) fall
// inside that window under both EDT and EST.
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

/** A calendar Monday ~120 days out (other suites use ~60/~90 — no collisions). */
function futureMondayDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 120);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dayStr(base: Date, offsetDays: number): string {
  const d = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function createBooking(token: string, scheduledAt: string): Promise<number> {
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

async function propose(
  token: string,
  bookingId: number,
  proposedScheduledAt: string,
  idempotencyKey: string,
  reason?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return api(`/bookings/${bookingId}/reschedule-requests`, {
    method: "POST",
    token,
    body: JSON.stringify({ proposedScheduledAt, idempotencyKey, ...(reason ? { reason } : {}) }),
  });
}

function proposalOf(body: Record<string, unknown>): Record<string, unknown> {
  return body["proposal"] as Record<string, unknown>;
}

/** Remove this suite's far-future bookings and dependents so reruns are clean. */
async function cleanupTestWindow(base: Date): Promise<void> {
  const start = base;
  const end = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
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
  await db.delete(rescheduleHistoryTable).where(inArray(rescheduleHistoryTable.bookingId, ids));
  await db.delete(rescheduleProposalsTable).where(inArray(rescheduleProposalsTable.bookingId, ids));
  await db.delete(reviewsTable).where(inArray(reviewsTable.bookingId, ids));
  await db.delete(invoicesTable).where(inArray(invoicesTable.bookingId, ids));
  await db.delete(marketplaceEventsTable).where(inArray(marketplaceEventsTable.bookingId, ids));
  await db
    .delete(preventedBookingRecordsTable)
    .where(inArray(preventedBookingRecordsTable.subjectBookingId, ids));
  await db.delete(bookingsTable).where(inArray(bookingsTable.id, ids));
}

describe("consent-first reschedule proposals", () => {
  let jane = "";
  let tom = "";
  let sarah = "";
  let mike = "";
  let base = new Date(0);
  let d1 = ""; // Monday
  let d2 = ""; // Tuesday
  let d3 = ""; // Wednesday
  let bookingA = 0;
  let p1 = 0;

  before(async () => {
    [jane, tom, sarah, mike] = await Promise.all([
      login("jane@oncallfoot.com"),
      login("tom@oncallfoot.com"),
      login("sarah@oncallfoot.com"),
      login("mike@oncallfoot.com"),
    ]);
    base = futureMondayDate();
    d1 = dayStr(base, 0);
    d2 = dayStr(base, 1);
    d3 = dayStr(base, 2);
    await cleanupTestWindow(base);

    bookingA = await createBooking(jane, `${d1}T15:00:00.000Z`);
    const confirm = await patchStatus(sarah, bookingA, { status: "confirmed" });
    assert.equal(confirm.status, 200, "provider confirm failed");
  });

  after(async () => {
    await pool.end();
  });

  it("a client cannot create a proposal (uses the direct reschedule flow)", async () => {
    const res = await propose(jane, bookingA, `${d1}T16:00:00.000Z`, "k-client-1");
    assert.equal(res.status, 403);
  });

  it("an unrelated provider gets 404 (booking existence is not leaked)", async () => {
    const res = await propose(mike, bookingA, `${d1}T16:00:00.000Z`, "k-mike-1");
    assert.equal(res.status, 404);
  });

  it("requires an idempotency key and a valid future time", async () => {
    const missingKey = await api(`/bookings/${bookingA}/reschedule-requests`, {
      method: "POST",
      token: sarah,
      body: JSON.stringify({ proposedScheduledAt: `${d1}T16:00:00.000Z` }),
    });
    assert.equal(missingKey.status, 400);

    const malformed = await propose(sarah, bookingA, "not-a-date", "k-bad-1");
    assert.equal(malformed.status, 400);

    const past = await propose(sarah, bookingA, "2020-01-06T15:00:00.000Z", "k-bad-2");
    assert.equal(past.status, 400);

    const outside = await propose(sarah, bookingA, `${d1}T03:00:00.000Z`, "k-bad-3");
    assert.equal(outside.status, 400);
    assert.match(String(outside.body["error"]), /outside this provider's availability/);
  });

  it("provider creates a pending proposal; the confirmed time is NOT changed", async () => {
    const res = await propose(sarah, bookingA, `${d1}T16:00:00.000Z`, "k-p1", "Earlier visit ran long");
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const proposal = proposalOf(res.body);
    p1 = proposal["id"] as number;
    assert.equal(proposal["status"], "pending");
    assert.equal(proposal["requesterRole"], "provider");
    assert.equal(proposal["reason"], "Earlier visit ran long");
    assert.ok(proposal["deadlineAt"]);
    // No internal identifiers are exposed.
    assert.ok(!("requesterUserId" in proposal));
    assert.ok(!("idempotencyKey" in proposal));

    const detail = await api(`/bookings/${bookingA}`, { token: jane });
    const booking = detail.body["booking"] as Record<string, unknown>;
    assert.equal(booking["status"], "confirmed");
    assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d1}T15:00:00.000Z`);
  });

  it("an idempotency-key retry returns the SAME proposal (no second row)", async () => {
    const res = await propose(sarah, bookingA, `${d1}T16:00:00.000Z`, "k-p1");
    assert.equal(res.status, 200);
    assert.equal(proposalOf(res.body)["id"], p1);
  });

  it("a second concurrent proposal is refused (single pending per booking)", async () => {
    const res = await propose(sarah, bookingA, `${d1}T18:00:00.000Z`, "k-p1b");
    assert.equal(res.status, 409);
    assert.match(String(res.body["error"]), /already awaiting/);
  });

  it("only the owning client sees and can act on the proposal", async () => {
    const list = await api(`/bookings/${bookingA}/reschedule-requests`, { token: jane });
    assert.equal(list.status, 200);
    assert.equal((list.body["proposals"] as unknown[]).length, 1);

    const listTom = await api(`/bookings/${bookingA}/reschedule-requests`, { token: tom });
    assert.equal(listTom.status, 404);

    const acceptTom = await api(`/reschedule-requests/${p1}/accept`, { method: "POST", token: tom });
    assert.equal(acceptTom.status, 404);

    const acceptSarah = await api(`/reschedule-requests/${p1}/accept`, { method: "POST", token: sarah });
    assert.equal(acceptSarah.status, 403);
  });

  it("client accept applies the proposed time atomically with a history row", async () => {
    const res = await api(`/reschedule-requests/${p1}/accept`, { method: "POST", token: jane });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const booking = res.body["booking"] as Record<string, unknown>;
    assert.equal(booking["status"], "confirmed");
    assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d1}T16:00:00.000Z`);
    assert.ok(!("careNotes" in booking));
    assert.equal(proposalOf(res.body)["status"], "accepted");

    const history = await api(`/bookings/${bookingA}/rescheduling-history`, { token: jane });
    assert.equal(history.status, 200);
    const entries = history.body["history"] as Array<Record<string, unknown>>;
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!["requesterRole"], "provider");
    assert.equal(new Date(String(entries[0]!["originalScheduledAt"])).toISOString(), `${d1}T15:00:00.000Z`);
    assert.equal(new Date(String(entries[0]!["newScheduledAt"])).toISOString(), `${d1}T16:00:00.000Z`);
  });

  it("an accept replay by the same client is idempotent (no second history row)", async () => {
    const res = await api(`/reschedule-requests/${p1}/accept`, { method: "POST", token: jane });
    assert.equal(res.status, 200);
    const history = await api(`/bookings/${bookingA}/rescheduling-history`, { token: jane });
    assert.equal((history.body["history"] as unknown[]).length, 1);
  });

  it("a client direct reschedule cancels the pending proposal (stale accept → 409) and writes history", async () => {
    const p2res = await propose(sarah, bookingA, `${d1}T18:00:00.000Z`, "k-p2");
    assert.equal(p2res.status, 201);
    const p2 = proposalOf(p2res.body)["id"] as number;

    // Client keeps their immediate reschedule right (goes to `rescheduled`).
    const move = await patchStatus(jane, bookingA, {
      status: "rescheduled",
      scheduledAt: `${d1}T17:00:00.000Z`,
    });
    assert.equal(move.status, 200);

    const list = await api(`/bookings/${bookingA}/reschedule-requests`, { token: jane });
    const p2row = (list.body["proposals"] as Array<Record<string, unknown>>).find((p) => p["id"] === p2);
    assert.equal(p2row?.["status"], "cancelled");

    const staleAccept = await api(`/reschedule-requests/${p2}/accept`, { method: "POST", token: jane });
    assert.equal(staleAccept.status, 409);

    const history = await api(`/bookings/${bookingA}/rescheduling-history`, { token: jane });
    const entries = history.body["history"] as Array<Record<string, unknown>>;
    assert.equal(entries.length, 2); // newest first: the client's direct change
    assert.equal(entries[0]!["requesterRole"], "client");
    assert.equal(entries[0]!["newStatus"], "rescheduled");

    const reconfirm = await patchStatus(sarah, bookingA, { status: "confirmed" });
    assert.equal(reconfirm.status, 200);
  });

  it("client decline keeps the original time and reports feasibility", async () => {
    const p3res = await propose(sarah, bookingA, `${d1}T18:00:00.000Z`, "k-p3");
    assert.equal(p3res.status, 201);
    const p3 = proposalOf(p3res.body)["id"] as number;

    const res = await api(`/reschedule-requests/${p3}/decline`, { method: "POST", token: jane });
    assert.equal(res.status, 200);
    assert.equal(proposalOf(res.body)["status"], "declined");
    assert.equal(res.body["originalTimeFeasible"], true);

    const detail = await api(`/bookings/${bookingA}`, { token: jane });
    const booking = detail.body["booking"] as Record<string, unknown>;
    assert.equal(booking["status"], "confirmed");
    assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d1}T17:00:00.000Z`);
  });

  it("after the documented limit, further provider proposals route to manual review", async () => {
    // p1 accepted + p2 cancelled + p3 declined = 3 provider proposals (limit).
    const res = await propose(sarah, bookingA, `${d1}T18:00:00.000Z`, "k-p4");
    assert.equal(res.status, 409);
    assert.match(String(res.body["error"]), /limit .* contact support/i);
  });

  it("a proposal past its deadline lazily expires; expired proposals cannot be accepted", async () => {
    const bookingB = await createBooking(jane, `${d2}T15:00:00.000Z`);
    await patchStatus(sarah, bookingB, { status: "confirmed" });
    const pres = await propose(sarah, bookingB, `${d2}T16:00:00.000Z`, "k-exp-1");
    assert.equal(pres.status, 201);
    const pid = proposalOf(pres.body)["id"] as number;

    // Force the deadline into the past (test-only DB manipulation).
    await db
      .update(rescheduleProposalsTable)
      .set({ deadlineAt: new Date(Date.now() - 60_000) })
      .where(eq(rescheduleProposalsTable.id, pid));

    const list = await api(`/bookings/${bookingB}/reschedule-requests`, { token: jane });
    const row = (list.body["proposals"] as Array<Record<string, unknown>>).find((p) => p["id"] === pid);
    // Original time is far-future and inside availability → `expired`.
    assert.equal(row?.["status"], "expired");

    const accept = await api(`/reschedule-requests/${pid}/accept`, { method: "POST", token: jane });
    assert.equal(accept.status, 409);

    const detail = await api(`/bookings/${bookingB}`, { token: jane });
    const booking = detail.body["booking"] as Record<string, unknown>;
    assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d2}T15:00:00.000Z`);
  });

  it("concurrent accept/decline storms resolve the proposal exactly once", async (t) => {
    const bookingC = await createBooking(jane, `${d2}T17:00:00.000Z`);
    await patchStatus(sarah, bookingC, { status: "confirmed" });
    const pres = await propose(sarah, bookingC, `${d2}T18:00:00.000Z`, "k-conc-1");
    assert.equal(pres.status, 201);
    const pid = proposalOf(pres.body)["id"] as number;

    const results = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        api(`/reschedule-requests/${pid}/accept`, { method: "POST", token: jane }),
      ),
      ...Array.from({ length: 4 }, () =>
        api(`/reschedule-requests/${pid}/decline`, { method: "POST", token: jane }),
      ),
    ]);
    t.diagnostic(`statuses: ${results.map((r) => r.status).join(",")}`);

    const [row] = await db
      .select()
      .from(rescheduleProposalsTable)
      .where(eq(rescheduleProposalsTable.id, pid));
    assert.ok(row);
    assert.ok(["accepted", "declined"].includes(row!.status));

    const historyRows = await db
      .select({ id: rescheduleHistoryTable.id })
      .from(rescheduleHistoryTable)
      .where(eq(rescheduleHistoryTable.proposalId, pid));
    const detail = await api(`/bookings/${bookingC}`, { token: jane });
    const booking = detail.body["booking"] as Record<string, unknown>;
    if (row!.status === "accepted") {
      assert.equal(historyRows.length, 1);
      assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d2}T18:00:00.000Z`);
    } else {
      assert.equal(historyRows.length, 0);
      assert.equal(new Date(String(booking["scheduledAt"])).toISOString(), `${d2}T17:00:00.000Z`);
    }
  });

  it("acceptance re-validates the proposed time (slot taken since → 409, proposal stays pending)", async () => {
    const bookingE = await createBooking(jane, `${d3}T15:00:00.000Z`);
    await patchStatus(sarah, bookingE, { status: "confirmed" });
    // 16:30Z is 30 min clear of bookingE's 15:00Z–16:00Z, so Tom can take it
    // under the travel/setup buffer (roadmap #12) while still colliding with
    // the proposed time exactly.
    const pres = await propose(sarah, bookingE, `${d3}T16:30:00.000Z`, "k-taken-1");
    assert.equal(pres.status, 201);
    const pid = proposalOf(pres.body)["id"] as number;

    // Tom takes the proposed slot while the proposal is pending.
    await createBooking(tom, `${d3}T16:30:00.000Z`);

    const accept = await api(`/reschedule-requests/${pid}/accept`, { method: "POST", token: jane });
    assert.equal(accept.status, 409);
    assert.match(String(accept.body["error"]), /overlaps another appointment/);

    const list = await api(`/bookings/${bookingE}/reschedule-requests`, { token: jane });
    const row = (list.body["proposals"] as Array<Record<string, unknown>>).find((p) => p["id"] === pid);
    assert.equal(row?.["status"], "pending"); // client can still decline / pick another

    // Cancellation interaction: cancelling the booking resolves the proposal.
    const cancel = await patchStatus(jane, bookingE, {
      status: "cancelled",
      cancellationReason: "test: cancellation resolves proposals",
    });
    assert.equal(cancel.status, 200);
    const list2 = await api(`/bookings/${bookingE}/reschedule-requests`, { token: jane });
    const row2 = (list2.body["proposals"] as Array<Record<string, unknown>>).find((p) => p["id"] === pid);
    assert.equal(row2?.["status"], "cancelled");
  });

  it("no-show classification: provider-only, from confirmed only (never from rescheduled)", async () => {
    const bookingF = await createBooking(jane, `${d3}T18:00:00.000Z`);
    await patchStatus(sarah, bookingF, { status: "confirmed" });
    const move = await patchStatus(jane, bookingF, {
      status: "rescheduled",
      scheduledAt: `${d3}T19:00:00.000Z`,
    });
    assert.equal(move.status, 200);

    const blocked = await patchStatus(sarah, bookingF, { status: "no_show" });
    assert.equal(blocked.status, 409);

    await patchStatus(sarah, bookingF, { status: "confirmed" });
    const clientNoShow = await patchStatus(jane, bookingF, { status: "no_show" });
    assert.equal(clientNoShow.status, 409); // clients can never mark no-show

    const ok = await patchStatus(sarah, bookingF, { status: "no_show" });
    assert.equal(ok.status, 200);
  });

  it("history is owner-only, append-only, and has no mutation routes", async () => {
    const foreign = await api(`/bookings/${bookingA}/rescheduling-history`, { token: tom });
    assert.equal(foreign.status, 404);

    const patch = await api(`/bookings/${bookingA}/rescheduling-history`, {
      method: "PATCH",
      token: jane,
      body: JSON.stringify({ reason: "tamper" }),
    });
    assert.ok(patch.status === 404 || patch.status === 405);

    const del = await api(`/bookings/${bookingA}/rescheduling-history`, {
      method: "DELETE",
      token: jane,
    });
    assert.ok(del.status === 404 || del.status === 405);

    // Rows written earlier are still byte-identical (append-only).
    const history = await api(`/bookings/${bookingA}/rescheduling-history`, { token: jane });
    const entries = history.body["history"] as Array<Record<string, unknown>>;
    assert.equal(entries.length, 2);
    assert.equal(new Date(String(entries[1]!["originalScheduledAt"])).toISOString(), `${d1}T15:00:00.000Z`);
  });
});
