/**
 * Provider dashboard (owner-scoped, read-only) — integration.
 *
 * Covers: authorization (401 unauthenticated, 403 client role, 403 unapproved
 * provider), empty-state shape for a new approved provider, metrics
 * calculations (completion/cancellation/no-show/repeat-client rates over the
 * resolved-bookings denominator), source-attribution grouping (qr-card →
 * qrCard, null → unknown), upcoming-bookings 30-day window + ordering +
 * privacy trims (FSA-prefix location, first name + last initial, no full
 * address in the payload), recent-activity ordering and type mapping,
 * earnings preview, and /providers/me/metrics parity.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-dashboard
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  bookingsTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "dashboard-password";
const suffix = `${process.pid}-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;
const MARKETPLACE_TZ = process.env["MARKETPLACE_TIMEZONE"]?.trim() || "America/Toronto";

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
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName,
      lastName,
      role,
      roleIntent: role,
    }),
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  return {
    token: r.body["token"] as string,
    userId: (r.body["user"] as JsonBody)["id"] as number,
  };
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

/** Local hour-of-day in the marketplace timezone. */
function localHour(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date),
  );
}

// ── Suite state ───────────────────────────────────────────────────────────────

let providerToken: string;
let providerId: number;
let serviceId: number;
let emptyProviderToken: string;
let clientAToken: string;
let clientAId: number;
let clientBId: number;
let clientBToken: string;
let pendingProviderToken: string;

// Deterministic "today" control: a time guaranteed to be on today's local
// date in the marketplace timezone. usedFuture records which branch ran so
// upcoming/next-booking assertions stay deterministic within this run.
const now = new Date();
const usedFuture = localHour(now, MARKETPLACE_TZ) <= 22;
const todaySafe = new Date(now.getTime() + (usedFuture ? 30 : -90) * 60 * 1000);
const tomorrow = (() => {
  const d = new Date(now.getTime() + DAY);
  d.setUTCHours(15, 0, 0, 0);
  return d;
})();

let todayConfirmedId: number;
let tomorrowConfirmedId: number;
let plus10RequestedId: number;
let plus45ConfirmedId: number;

type InsertStatus = (typeof bookingsTable.$inferInsert)["status"];

async function insertBooking(opts: {
  clientId: number;
  status: InsertStatus;
  scheduledAt: Date;
  source?: string | null;
  updatedAt?: Date;
  postalCode?: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(bookingsTable)
    .values({
      clientId: opts.clientId,
      providerId,
      serviceId,
      status: opts.status,
      scheduledAt: opts.scheduledAt,
      address: "12 Test Lane",
      city: "St. Catharines",
      postalCode: opts.postalCode === undefined ? "L2R 3K9" : opts.postalCode,
      source: opts.source ?? null,
      updatedAt: opts.updatedAt ?? new Date(),
    })
    .returning({ id: bookingsTable.id });
  return row!.id;
}

before(async () => {
  const provider = await register(
    `dash-provider-${suffix}@oncallfoot.test`,
    "provider",
    "Dana",
    "Provider",
  );
  providerToken = provider.token;
  providerId = await approveProvider(provider.userId);
  serviceId = await createService(providerId);

  const emptyProvider = await register(
    `dash-empty-${suffix}@oncallfoot.test`,
    "provider",
    "Empty",
    "Provider",
  );
  emptyProviderToken = emptyProvider.token;
  await approveProvider(emptyProvider.userId);

  const pending = await register(
    `dash-pending-${suffix}@oncallfoot.test`,
    "provider",
    "Pending",
    "Provider",
  );
  pendingProviderToken = pending.token;

  const clientA = await register(
    `dash-client-a-${suffix}@oncallfoot.test`,
    "client",
    "Alex",
    "Morgan",
  );
  clientAToken = clientA.token;
  clientAId = clientA.userId;
  const clientB = await register(
    `dash-client-b-${suffix}@oncallfoot.test`,
    "client",
    "Jo",
    "Park",
  );
  clientBToken = clientB.token;
  clientBId = clientB.userId;

  // Resolved history (metrics + attribution + activity):
  await insertBooking({
    clientId: clientAId,
    status: "completed",
    scheduledAt: new Date(now.getTime() - 60 * DAY),
    source: "instagram",
    updatedAt: new Date(now.getTime() - 50 * DAY),
  });
  await insertBooking({
    clientId: clientAId,
    status: "completed",
    scheduledAt: todaySafe, // this month → earnings preview
    source: "instagram",
    updatedAt: new Date(now.getTime() - 60 * 60 * 1000),
  });
  await insertBooking({
    clientId: clientBId,
    status: "completed",
    scheduledAt: new Date(now.getTime() - 70 * DAY),
    source: "qr-card",
    updatedAt: new Date(now.getTime() - 60 * DAY),
  });
  await insertBooking({
    clientId: clientBId,
    status: "cancelled",
    scheduledAt: new Date(now.getTime() - 5 * DAY),
    source: "facebook",
    updatedAt: new Date(now.getTime() - 2 * DAY),
  });
  await insertBooking({
    clientId: clientAId,
    status: "no_show",
    scheduledAt: new Date(now.getTime() - 3 * DAY),
    source: null,
    updatedAt: new Date(now.getTime() - 30 * 60 * 1000), // most recent activity
  });

  // Active bookings (today, upcoming window, beyond window):
  todayConfirmedId = await insertBooking({
    clientId: clientBId,
    status: "confirmed",
    scheduledAt: todaySafe,
    source: "text",
  });
  tomorrowConfirmedId = await insertBooking({
    clientId: clientAId,
    status: "confirmed",
    scheduledAt: tomorrow,
    source: "website",
    postalCode: "L2R 3K9",
  });
  plus10RequestedId = await insertBooking({
    clientId: clientBId,
    status: "requested",
    scheduledAt: new Date(now.getTime() + 10 * DAY),
    source: null,
  });
  plus45ConfirmedId = await insertBooking({
    clientId: clientBId,
    status: "confirmed",
    scheduledAt: new Date(now.getTime() + 45 * DAY),
    source: null,
  });
});

// ── Authorization ─────────────────────────────────────────────────────────────

describe("provider dashboard authorization", () => {
  it("rejects unauthenticated requests (401)", async () => {
    assert.equal((await apiFetch("/providers/me/dashboard")).status, 401);
    assert.equal((await apiFetch("/providers/me/metrics")).status, 401);
  });

  it("rejects client role (403)", async () => {
    assert.equal(
      (await apiFetch("/providers/me/dashboard", { token: clientAToken })).status,
      403,
    );
    assert.equal(
      (await apiFetch("/providers/me/metrics", { token: clientBToken })).status,
      403,
    );
  });

  it("rejects unapproved providers (403)", async () => {
    assert.equal(
      (await apiFetch("/providers/me/dashboard", { token: pendingProviderToken })).status,
      403,
    );
    assert.equal(
      (await apiFetch("/providers/me/metrics", { token: pendingProviderToken })).status,
      403,
    );
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("provider dashboard empty state", () => {
  it("returns honest zeros/nulls for an approved provider with no bookings", async () => {
    const r = await apiFetch("/providers/me/dashboard", { token: emptyProviderToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body["todayBookingsCount"], 0);
    assert.equal(r.body["nextBooking"], null);
    assert.deepEqual(r.body["upcomingBookings"], []);
    assert.deepEqual(r.body["recentActivity"], []);
    assert.equal(r.body["slug"], null);
    assert.equal(r.body["bookingUrl"], null);
    assert.equal(r.body["bookingPagePublished"], false);
    assert.deepEqual(r.body["metrics"], {
      completionRate: 0,
      cancellationRate: 0,
      noShowRate: 0,
      repeatClientRate: 0,
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      noShowBookings: 0,
      resolvedBookings: 0,
    });
    assert.deepEqual(r.body["sourceAttribution"], {
      instagram: 0,
      qrCard: 0,
      text: 0,
      facebook: 0,
      website: 0,
      other: 0,
      unknown: 0,
    });
    assert.deepEqual(r.body["earningsPreview"], {
      estimatedMonthlyCents: null,
      available: false,
    });
  });
});

// ── Populated dashboard ───────────────────────────────────────────────────────

describe("provider dashboard data", () => {
  let body: JsonBody;

  before(async () => {
    const r = await apiFetch("/providers/me/dashboard", { token: providerToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    body = r.body;
  });

  it("computes performance metrics over the resolved denominator", () => {
    assert.deepEqual(body["metrics"], {
      completionRate: 0.6, // 3 / 5 resolved
      cancellationRate: 0.2, // 1 / 5
      noShowRate: 0.2, // 1 / 5
      repeatClientRate: 0.5, // Alex completed twice, Jo once
      totalBookings: 9,
      completedBookings: 3,
      cancelledBookings: 1,
      noShowBookings: 1,
      resolvedBookings: 5,
    });
  });

  it("groups source attribution with qrCard mapping and unknown fallback", () => {
    assert.deepEqual(body["sourceAttribution"], {
      instagram: 2,
      qrCard: 1,
      text: 1,
      facebook: 1,
      website: 1,
      other: 0,
      unknown: 3,
    });
  });

  it("counts today's active bookings by marketplace-local date", () => {
    assert.equal(body["todayBookingsCount"], 1);
  });

  it("returns upcoming bookings within 30 days, ordered, excluding later ones", () => {
    const upcoming = body["upcomingBookings"] as Array<JsonBody>;
    const ids = upcoming.map((b) => b["id"]);
    const expected = usedFuture
      ? [todayConfirmedId, tomorrowConfirmedId, plus10RequestedId]
      : [tomorrowConfirmedId, plus10RequestedId];
    assert.deepEqual(ids, expected);
    assert.ok(!ids.includes(plus45ConfirmedId), "45-day booking must be outside the window");

    const next = body["nextBooking"] as JsonBody;
    assert.equal(next["id"], usedFuture ? todayConfirmedId : tomorrowConfirmedId);
  });

  it("trims client names and locations for privacy (no full address anywhere)", () => {
    const upcoming = body["upcomingBookings"] as Array<JsonBody>;
    const tomorrowBooking = upcoming.find((b) => b["id"] === tomorrowConfirmedId)!;
    assert.equal(tomorrowBooking["clientName"], "Alex M.");
    assert.equal(tomorrowBooking["location"], "L2R");
    assert.equal(tomorrowBooking["serviceName"], `Routine care ${suffix}`);
    assert.ok(
      !JSON.stringify(body).includes("12 Test Lane"),
      "full street address must never appear in the dashboard payload",
    );
  });

  it("orders recent activity by last change with mapped types (max 10)", () => {
    const activity = body["recentActivity"] as Array<JsonBody>;
    assert.equal(activity.length, 5);
    assert.deepEqual(
      activity.map((a) => a["type"]),
      ["no_show", "booking", "cancellation", "booking", "booking"],
    );
    assert.equal(activity[0]!["clientName"], "Alex M.");
    assert.equal(activity[0]!["status"], "no_show");
  });

  it("previews estimated monthly earnings honestly (payments not enabled)", () => {
    assert.deepEqual(body["earningsPreview"], {
      estimatedMonthlyCents: 9000, // one completed visit this month × $90 service
      available: false,
    });
  });

  it("exposes booking-page state without inventing a URL when unpublished", () => {
    assert.equal(body["bookingPagePublished"], false);
    assert.equal(body["bookingUrl"], null);
    assert.equal(body["providerName"], "Dana Provider");
    assert.equal(typeof body["updatedAt"], "string");
  });

  it("GET /providers/me/metrics returns the same metrics object", async () => {
    const r = await apiFetch("/providers/me/metrics", { token: providerToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body["metrics"], body["metrics"]);
    assert.equal(typeof r.body["updatedAt"], "string");
  });
});
