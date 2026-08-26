/**
 * Cancellation/no-show policy + minimal support workflow (roadmap #13) —
 * integration.
 *
 * Covers: client early/late cancellation categories, provider cancellation
 * with required structured reason, no-show time-passed rule and marking
 * metadata, append-only outcome history with cross-party privacy redaction,
 * cancellation preview, authorization (ownership, role gates, non-leak 404),
 * double-cancel/concurrency, support escalation creation + idempotency,
 * support-role history view, escalation state updates, outcome correction
 * mediation, suspension mechanism, and public policy exposure safety.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:cancellation
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  accountRolesTable,
  availabilityTable,
  bookingsTable,
  bookingOutcomeHistoryTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "cancellation-password";
const suffix = `${process.pid}-${Date.now()}`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody }> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((rest.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  let body: JsonBody;
  try {
    body = JSON.parse(text) as JsonBody;
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

async function register(
  email: string,
  role: "provider" | "client",
  firstName: string,
  lastName: string,
) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, firstName, lastName, role, roleIntent: role }),
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  return {
    token: r.body["token"] as string,
    userId: (r.body["user"] as JsonBody)["id"] as number,
  };
}

async function login(email: string) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200, `login failed: ${JSON.stringify(r.body)}`);
  return r.body["token"] as string;
}

/** Approve the provider directly in the database (no self-serve approval). */
async function approveProvider(userId: number) {
  const [profile] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(profile, "provider profile missing");
  await db
    .update(providerProfilesTable)
    .set({ verificationStatus: "approved" })
    .where(eq(providerProfilesTable.id, profile!.id));
  await db
    .update(providerApplicationsTable)
    .set({ status: "approved" })
    .where(eq(providerApplicationsTable.providerProfileId, profile!.id));
  // Open availability every day so bookings pass window checks.
  for (let day = 0; day <= 6; day++) {
    await db.insert(availabilityTable).values({
      providerId: profile!.id,
      dayOfWeek: day,
      startTime: "00:00",
      endTime: "23:59",
    });
  }
  return profile!.id;
}

async function createService(providerId: number) {
  const [service] = await db
    .insert(servicesTable)
    .values({
      providerId,
      title: `Routine care ${suffix}`,
      description: "test service",
      durationMinutes: 60,
      priceCents: 9000,
      category: "routine_care",
      isActive: true,
    })
    .returning({ id: servicesTable.id });
  return service!.id;
}

/** Promote a registered user to admin (no self-serve admin signup). */
async function promoteToAdmin(email: string) {
  const [u] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, u!.id));
  await db
    .insert(accountRolesTable)
    .values({ userId: u!.id, role: "admin" })
    .onConflictDoNothing();
  return login(email);
}

/** Book a slot on a unique future day at a window-safe hour, then optionally confirm it. */
let slotCounter = 0;
async function createBooking(
  clientToken: string,
  providerId: number,
  serviceId: number,
  opts: { confirm?: boolean; providerToken?: string } = {},
): Promise<number> {
  slotCounter += 1;
  const scheduledAt = new Date(Date.now() + (10 + slotCounter) * 24 * 60 * 60 * 1000);
  scheduledAt.setUTCHours(15, 0, 0, 0);
  const r = await apiFetch("/bookings", {
    method: "POST",
    token: clientToken,
    body: JSON.stringify({
      providerId,
      serviceId,
      scheduledAt: scheduledAt.toISOString(),
      address: "12 Test Lane",
      city: "Toronto",
      postalCode: "M5V 2T6",
    }),
  });
  assert.equal(r.status, 201, `booking failed: ${JSON.stringify(r.body)}`);
  const bookingId = (r.body["booking"] as JsonBody)["id"] as number;
  if (opts.confirm) {
    const c = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: opts.providerToken,
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(c.status, 200, `confirm failed: ${JSON.stringify(c.body)}`);
  }
  return bookingId;
}

/** Force a booking's scheduled time directly (policy boundary control). */
async function setScheduledAt(bookingId: number, when: Date) {
  await db
    .update(bookingsTable)
    .set({ scheduledAt: when })
    .where(eq(bookingsTable.id, bookingId));
}

// ── Suite state ───────────────────────────────────────────────────────────────

let providerToken: string;
let providerUserId: number;
let providerId: number;
let serviceId: number;
let clientToken: string;
let clientUserId: number;
let otherClientToken: string;
let adminToken: string;

before(async () => {
  const provider = await register(
    `cx-provider-${suffix}@oncallfoot.test`,
    "provider",
    "Cancel",
    "Provider",
  );
  providerToken = provider.token;
  providerUserId = provider.userId;
  providerId = await approveProvider(provider.userId);
  providerToken = await login(`cx-provider-${suffix}@oncallfoot.test`);
  serviceId = await createService(providerId);

  const client = await register(
    `cx-client-${suffix}@oncallfoot.test`,
    "client",
    "Cancel",
    "Client",
  );
  clientToken = client.token;
  clientUserId = client.userId;

  const other = await register(
    `cx-other-${suffix}@oncallfoot.test`,
    "client",
    "Other",
    "Client",
  );
  otherClientToken = other.token;

  await register(`cx-admin-${suffix}@oncallfoot.test`, "client", "Support", "Admin");
  adminToken = await promoteToAdmin(`cx-admin-${suffix}@oncallfoot.test`);
});

// ── Cancellation ─────────────────────────────────────────────────────────────

describe("client cancellation categories", () => {
  it("early cancellation (outside notice window) records client_cancelled_early", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });

    const preview = await apiFetch(`/bookings/${bookingId}/cancellation-preview`, {
      token: clientToken,
    });
    assert.equal(preview.status, 200);
    const p = preview.body["preview"] as JsonBody;
    assert.equal(p["outcome"], "free");
    assert.equal(p["noticeHours"], 24);
    assert.ok(typeof p["freeUntil"] === "string");

    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Plans changed" }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const booking = r.body["booking"] as JsonBody;
    assert.equal(booking["status"], "cancelled");
    assert.equal(booking["cancellationCategory"], "client_cancelled_early");
    // Client-safe projection: no careNotes, no internal marker ids.
    assert.ok(!("careNotes" in booking));
    assert.ok(!("noShowMarkedBy" in booking));

    const history = await apiFetch(`/bookings/${bookingId}/outcome-history`, {
      token: clientToken,
    });
    assert.equal(history.status, 200);
    const rows = history.body["history"] as JsonBody[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!["action"], "cancelled");
    assert.equal(rows[0]!["category"], "client_cancelled_early");
    assert.equal(rows[0]!["actorRole"], "client");
    // Privacy: free-text snapshot and actor ids are admin-only.
    assert.ok(!("reasonSnapshot" in rows[0]!));
    assert.ok(!("actorUserId" in rows[0]!));
  });

  it("late cancellation (inside notice window) records client_cancelled_late", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    await setScheduledAt(bookingId, new Date(Date.now() + 2 * 60 * 60 * 1000));

    const preview = await apiFetch(`/bookings/${bookingId}/cancellation-preview`, {
      token: clientToken,
    });
    assert.equal((preview.body["preview"] as JsonBody)["outcome"], "late");

    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Something came up" }),
    });
    assert.equal(r.status, 200);
    assert.equal(
      (r.body["booking"] as JsonBody)["cancellationCategory"],
      "client_cancelled_late",
    );
  });

  it("double-cancel is rejected and appends no second history row", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const first = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "first" }),
    });
    assert.equal(first.status, 200);
    const second = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "second" }),
    });
    assert.equal(second.status, 409);
    const rows = await db
      .select()
      .from(bookingOutcomeHistoryTable)
      .where(eq(bookingOutcomeHistoryTable.bookingId, bookingId));
    assert.equal(rows.length, 1);
  });

  it("concurrent cancels: exactly one wins, exactly one history row", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        apiFetch(`/bookings/${bookingId}/status`, {
          method: "PATCH",
          token: clientToken,
          body: JSON.stringify({ status: "cancelled", cancellationReason: "race" }),
        }),
      ),
    );
    const winners = attempts.filter((a) => a.status === 200);
    const losers = attempts.filter((a) => a.status === 409);
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 4);
    const rows = await db
      .select()
      .from(bookingOutcomeHistoryTable)
      .where(eq(bookingOutcomeHistoryTable.bookingId, bookingId));
    assert.equal(rows.length, 1);
  });
});

describe("provider cancellation", () => {
  it("requires an allowlisted structured reason category", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });

    const missing = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "Sick today" }),
    });
    assert.equal(missing.status, 400);
    assert.match(String(missing.body["error"]), /reasonCategory/);

    const invalid = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({
        status: "cancelled",
        cancellationReason: "Sick today",
        reasonCategory: "not_a_category",
      }),
    });
    assert.equal(invalid.status, 400);

    const ok = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({
        status: "cancelled",
        cancellationReason: "Flu — private details",
        reasonCategory: "illness",
      }),
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(
      (ok.body["booking"] as JsonBody)["cancellationCategory"],
      "provider_cancelled",
    );

    // Client sees the shared category but never the private free-text.
    const history = await apiFetch(`/bookings/${bookingId}/outcome-history`, {
      token: clientToken,
    });
    const rows = history.body["history"] as JsonBody[];
    assert.equal(rows[0]!["category"], "provider_cancelled");
    assert.equal(rows[0]!["reasonCategory"], "illness");
    assert.ok(!("reasonSnapshot" in rows[0]!));
  });

  it("provider preview explains the on-behalf rule without early/late", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const preview = await apiFetch(`/bookings/${bookingId}/cancellation-preview`, {
      token: providerToken,
    });
    assert.equal(preview.status, 200);
    assert.equal((preview.body["preview"] as JsonBody)["outcome"], "provider");
  });
});

// ── No-show ──────────────────────────────────────────────────────────────────

describe("no-show handling", () => {
  it("cannot be recorded before the scheduled time has passed", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "no_show" }),
    });
    assert.equal(r.status, 409);
    assert.match(String(r.body["error"]), /after the scheduled appointment time/);
  });

  it("clients can never mark a no-show", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    await setScheduledAt(bookingId, new Date(Date.now() - 60 * 60 * 1000));
    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "no_show" }),
    });
    assert.equal(r.status, 409);
  });

  it("provider marks a past confirmed booking as no-show with actor + timestamp", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    await setScheduledAt(bookingId, new Date(Date.now() - 60 * 60 * 1000));
    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "no_show" }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const booking = r.body["booking"] as JsonBody;
    assert.equal(booking["status"], "no_show");
    assert.equal(booking["noShowMarkedBy"], providerUserId);
    assert.ok(booking["noShowMarkedAt"]);

    // History row appended; client view redacts the marker's user id.
    const history = await apiFetch(`/bookings/${bookingId}/outcome-history`, {
      token: clientToken,
    });
    const rows = history.body["history"] as JsonBody[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!["action"], "no_show");
    assert.equal(rows[0]!["actorRole"], "provider");
    assert.ok(!("actorUserId" in rows[0]!));

    // Client booking projection hides the marker user id but keeps timestamp.
    const detail = await apiFetch(`/bookings/${bookingId}`, { token: clientToken });
    assert.ok(!("noShowMarkedBy" in (detail.body["booking"] as JsonBody)));
    assert.ok((detail.body["booking"] as JsonBody)["noShowMarkedAt"]);
  });

  it("no-show is blocked from rescheduled state (existing gate preserved)", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    slotCounter += 1;
    const newTime = new Date(Date.now() + (200 + slotCounter) * 24 * 60 * 60 * 1000);
    newTime.setUTCHours(16, 0, 0, 0);
    const resched = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "rescheduled", scheduledAt: newTime.toISOString() }),
    });
    assert.equal(resched.status, 200, JSON.stringify(resched.body));
    await setScheduledAt(bookingId, new Date(Date.now() - 60 * 60 * 1000));
    const r = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "no_show" }),
    });
    assert.equal(r.status, 409);
  });
});

// ── Authorization + privacy ──────────────────────────────────────────────────

describe("authorization and privacy", () => {
  let bookingId: number;

  before(async () => {
    bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
  });

  it("unauthenticated requests get 401 on every new route", async () => {
    for (const [method, path] of [
      ["GET", `/bookings/${bookingId}/cancellation-preview`],
      ["GET", `/bookings/${bookingId}/outcome-history`],
      ["POST", "/support/escalations"],
      ["GET", `/support/bookings/${bookingId}/escalations`],
      ["PATCH", "/support/escalations/1"],
    ] as const) {
      const r = await apiFetch(path, {
        method,
        ...(method === "GET" ? {} : { body: JSON.stringify({}) }),
      });
      assert.equal(r.status, 401, `${method} ${path} -> ${r.status}`);
    }
  });

  it("non-owners get a non-leaking 404 on preview and history", async () => {
    for (const path of [
      `/bookings/${bookingId}/cancellation-preview`,
      `/bookings/${bookingId}/outcome-history`,
    ]) {
      const r = await apiFetch(path, { token: otherClientToken });
      assert.equal(r.status, 404);
      assert.deepEqual(r.body, { error: "Booking not found." });
    }
  });

  it("regular clients and providers cannot reach support-role endpoints", async () => {
    for (const token of [clientToken, providerToken]) {
      const view = await apiFetch(`/support/bookings/${bookingId}/escalations`, { token });
      assert.equal(view.status, 403);
      const patch = await apiFetch("/support/escalations/1", {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "resolved" }),
      });
      assert.equal(patch.status, 403);
    }
  });

  it("public booking pages expose only the safe policy summary", async () => {
    const [profile] = await db
      .select({ slug: providerProfilesTable.publicSlug })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);
    if (!profile?.slug) {
      // Publish a page for this provider to verify the public payload.
      await db
        .update(providerProfilesTable)
        .set({ publicSlug: `cx-prov-${suffix}`.toLowerCase(), bookingPagePublished: true })
        .where(eq(providerProfilesTable.id, providerId));
    } else {
      await db
        .update(providerProfilesTable)
        .set({ bookingPagePublished: true })
        .where(eq(providerProfilesTable.id, providerId));
    }
    const [fresh] = await db
      .select({ slug: providerProfilesTable.publicSlug })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, providerId))
      .limit(1);
    const r = await apiFetch(`/booking-pages/${fresh!.slug}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = r.body["page"] as JsonBody;
    const policy = page["cancellationPolicy"] as JsonBody;
    assert.deepEqual(Object.keys(policy).sort(), ["noticeHours", "summary"]);
    assert.equal(policy["noticeHours"], 24);
    // Never leak internal state identifiers or history publicly.
    const serialized = JSON.stringify(page);
    assert.doesNotMatch(serialized, /client_cancelled|cancelled_by_support|outcome_history/);
  });
});

// ── Support workflow ─────────────────────────────────────────────────────────

describe("support escalation workflow", () => {
  let cancelledBookingId: number;
  let ticketId: number;

  before(async () => {
    cancelledBookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const r = await apiFetch(`/bookings/${cancelledBookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({
        status: "cancelled",
        cancellationReason: "Private provider note",
        reasonCategory: "emergency",
      }),
    });
    assert.equal(r.status, 200);
  });

  it("escalation is blocked on active bookings", async () => {
    const activeId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const r = await apiFetch("/support/escalations", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId: activeId, message: "help" }),
    });
    assert.equal(r.status, 409);
  });

  it("non-owners cannot escalate someone else's booking (non-leaking 404)", async () => {
    const r = await apiFetch("/support/escalations", {
      method: "POST",
      token: otherClientToken,
      body: JSON.stringify({ bookingId: cancelledBookingId, message: "not mine" }),
    });
    assert.equal(r.status, 404);
  });

  it("client escalates a cancelled booking; duplicate submit returns the same ticket", async () => {
    const first = await apiFetch("/support/escalations", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        bookingId: cancelledBookingId,
        message: "The provider cancelled last minute — I want this reviewed.",
      }),
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const ticket = first.body["ticket"] as JsonBody;
    ticketId = ticket["id"] as number;
    assert.equal(ticket["bookingId"], cancelledBookingId);
    assert.equal(ticket["status"], "open");

    const dup = await apiFetch("/support/escalations", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId: cancelledBookingId }),
    });
    assert.equal(dup.status, 200);
    assert.equal((dup.body["ticket"] as JsonBody)["id"], ticketId);
  });

  it("support views full booking history including private snapshots", async () => {
    const r = await apiFetch(`/support/bookings/${cancelledBookingId}/escalations`, {
      token: adminToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const tickets = r.body["tickets"] as JsonBody[];
    assert.ok(tickets.some((t) => t["id"] === ticketId));
    const history = r.body["history"] as JsonBody[];
    assert.equal(history.length, 1);
    assert.equal(history[0]!["reasonSnapshot"], "Private provider note");
    assert.equal(history[0]!["actorUserId"], providerUserId);
  });

  it("support updates escalation state and records a mediation outcome", async () => {
    const r = await apiFetch(`/support/escalations/${ticketId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({
        status: "in_progress",
        resolutionNote: "Reviewed with both parties; provider emergency verified.",
      }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((r.body["ticket"] as JsonBody)["status"], "in_progress");

    const invalid = await apiFetch(`/support/escalations/${ticketId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "escalated_to_ceo" }),
    });
    assert.equal(invalid.status, 400);
  });

  it("support corrects a disputed no-show to completed with a mandatory reason", async () => {
    const disputedId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    await setScheduledAt(disputedId, new Date(Date.now() - 60 * 60 * 1000));
    const mark = await apiFetch(`/bookings/${disputedId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "no_show" }),
    });
    assert.equal(mark.status, 200);

    const esc = await apiFetch("/support/escalations", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId: disputedId, message: "I was home the whole time." }),
    });
    assert.equal(esc.status, 201);
    const disputeTicketId = (esc.body["ticket"] as JsonBody)["id"] as number;

    const missingReason = await apiFetch(`/support/escalations/${disputeTicketId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ correction: { status: "completed" } }),
    });
    assert.equal(missingReason.status, 400);

    const r = await apiFetch(`/support/escalations/${disputeTicketId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({
        status: "resolved",
        resolutionNote: "Client evidence accepted; outcome corrected.",
        correction: { status: "completed", reason: "Client provided proof of presence." },
      }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((r.body["booking"] as JsonBody)["status"], "completed");

    // History is append-only: no_show row preserved, support_corrected appended.
    const history = await apiFetch(`/bookings/${disputedId}/outcome-history`, {
      token: clientToken,
    });
    const rows = history.body["history"] as JsonBody[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!["action"], "support_corrected");
    assert.equal(rows[0]!["newStatus"], "completed");
    assert.equal(rows[1]!["action"], "no_show");
    // Correction reason is support-private.
    assert.ok(!("reasonSnapshot" in rows[0]!));

    // Corrections only apply to disputed terminal outcomes.
    const again = await apiFetch(`/support/escalations/${disputeTicketId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ correction: { status: "cancelled", reason: "nope" } }),
    });
    assert.equal(again.status, 409);
  });

  it("support can trigger the existing suspension mechanism for a booking party", async () => {
    const suspendEmail = `cx-suspend-${suffix}@oncallfoot.test`;
    const suspendUser = await register(suspendEmail, "client", "Suspend", "Me");
    const suspendBookingId = await createBooking(suspendUser.token, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    const cancel = await apiFetch(`/bookings/${suspendBookingId}/status`, {
      method: "PATCH",
      token: suspendUser.token,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "abusive pattern" }),
    });
    assert.equal(cancel.status, 200);
    const esc = await apiFetch("/support/escalations", {
      method: "POST",
      token: suspendUser.token,
      body: JSON.stringify({ bookingId: suspendBookingId }),
    });
    assert.equal(esc.status, 201);
    const tid = (esc.body["ticket"] as JsonBody)["id"] as number;

    // A non-party user id is rejected.
    const invalid = await apiFetch(`/support/escalations/${tid}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ suspendUserId: 999999 }),
    });
    assert.equal(invalid.status, 409);

    const r = await apiFetch(`/support/escalations/${tid}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "resolved", suspendUserId: suspendUser.userId }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    // Suspended users fail authorization on subsequent requests.
    const blocked = await apiFetch("/bookings", { token: suspendUser.token });
    assert.equal(blocked.status, 401);
  });
});

// ── Integration with rescheduling ────────────────────────────────────────────

describe("integration with rescheduling", () => {
  it("cancellation resolves a pending provider reschedule proposal", async () => {
    const bookingId = await createBooking(clientToken, providerId, serviceId, {
      confirm: true,
      providerToken,
    });
    slotCounter += 1;
    const proposedAt = new Date(Date.now() + (300 + slotCounter) * 24 * 60 * 60 * 1000);
    proposedAt.setUTCHours(16, 0, 0, 0);
    const proposal = await apiFetch(`/bookings/${bookingId}/reschedule-requests`, {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({
        proposedScheduledAt: proposedAt.toISOString(),
        idempotencyKey: `cx-${suffix}-${bookingId}`,
      }),
    });
    assert.equal(proposal.status, 201, JSON.stringify(proposal.body));

    const cancel = await apiFetch(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ status: "cancelled", cancellationReason: "cannot make it" }),
    });
    assert.equal(cancel.status, 200);

    const list = await apiFetch(`/bookings/${bookingId}/reschedule-requests`, {
      token: clientToken,
    });
    assert.equal(list.status, 200);
    const proposals = (list.body["proposals"] ?? list.body["requests"]) as JsonBody[];
    assert.ok(proposals.every((p) => p["status"] !== "pending"));
  });
});
