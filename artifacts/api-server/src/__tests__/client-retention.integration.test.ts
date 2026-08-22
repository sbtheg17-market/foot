/**
 * Client retention — review request + book-again signal coverage.
 *
 * The client Book Again flow is frontend composition over existing APIs.
 * This suite proves the server-side signals it depends on, end to end:
 *
 *   completed visit
 *     → booking is reviewable exactly once (existing review API)
 *     → original ACTIVE service remains discoverable for rebooking
 *     → a NEW booking with the same provider/service at a FRESH real slot
 *       succeeds with all duplicate/overlap protections intact
 *     → an INACTIVE original service disappears from the public services
 *       list and cannot be booked again
 *
 * No new API routes, no schema changes, no analytics events.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:client-retention
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  bookingsTable,
  db,
  invoicesTable,
  providerApplicationsTable,
  providerProfilesTable,
  reviewsTable,
  servicesTable,
  travelZonesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "client-retention-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `retention-provider-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `retention-client-${suffix}@oncallfoot.test`;
const OTHER_CLIENT_EMAIL = `retention-other-${suffix}@oncallfoot.test`;

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

async function register(email: string, role: "provider" | "client") {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "Retention",
      lastName: "Flow",
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

/** Collect distinct non-overlapping available real slots across coming days. */
async function collectSlots(
  providerProfileId: number,
  serviceId: number,
  want: number,
): Promise<string[]> {
  const out: string[] = [];
  const base = Date.now();
  let lastMs = 0;
  for (let d = 1; d <= 21 && out.length < want; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { body } = await apiFetch(
      `/providers/${providerProfileId}/slots?serviceId=${serviceId}&date=${date}`,
    );
    const slots =
      (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
    for (const s of slots) {
      if (out.length >= want) break;
      if (!s.available) continue;
      const ms = Date.parse(s.start);
      if (ms - lastMs >= 2 * 60 * 60 * 1000) {
        out.push(s.start);
        lastMs = ms;
      }
    }
  }
  assert.equal(out.length, want, "not enough real slots for fixtures");
  return out;
}

function bookingPayload(
  providerId: number,
  serviceId: number,
  scheduledAt: string,
) {
  return {
    providerId,
    serviceId,
    scheduledAt,
    address: "9 Retention Lane",
    city: "Toronto",
    postalCode: "M5V 1A1",
  };
}

describe("Client retention: review request + book-again signals", () => {
  let providerToken = "";
  let providerUserId = 0;
  let providerProfileId = 0;
  let clientToken = "";
  let clientUserId = 0;
  let otherClientToken = "";
  let otherClientUserId = 0;
  let serviceId = 0;
  let completedBookingId = 0;
  let slots: string[] = [];

  before(async () => {
    const health = await apiFetch("/healthz");
    assert.equal(health.status, 200, "API server must be running");

    const provider = await register(PROVIDER_EMAIL, "provider");
    providerToken = provider.token;
    providerUserId = provider.userId;
    const client = await register(CLIENT_EMAIL, "client");
    clientToken = client.token;
    clientUserId = client.userId;
    const other = await register(OTHER_CLIENT_EMAIL, "client");
    otherClientToken = other.token;
    otherClientUserId = other.userId;

    const [profile] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, providerUserId))
      .limit(1);
    assert.ok(profile);
    providerProfileId = profile.id;

    // Fully activate the provider from raw source fields (C1–C7).
    await db
      .update(providerProfilesTable)
      .set({
        title: "Mobile foot-care specialist",
        city: "Toronto",
        bio: "Calm, client-first in-home foot care.",
        verificationStatus: "approved",
        acceptsNewClients: true,
      })
      .where(eq(providerProfilesTable.id, providerProfileId));
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", currentStep: "submitted" })
      .where(eq(providerApplicationsTable.userId, providerUserId));
    const [service] = await db
      .insert(servicesTable)
      .values({
        providerId: providerProfileId,
        title: "In-home foot care visit",
        durationMinutes: 60,
        priceCents: 12000,
        category: "foot_care",
        isActive: true,
      })
      .returning({ id: servicesTable.id });
    assert.ok(service);
    serviceId = service.id;
    for (let day = 0; day <= 6; day++) {
      await db.insert(availabilityTable).values({
        providerId: providerProfileId,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
      });
    }
    await db.insert(travelZonesTable).values({
      providerId: providerProfileId,
      zoneName: "Downtown core",
      city: "Toronto",
    });

    slots = await collectSlots(providerProfileId, serviceId, 3);
  });

  after(async () => {
    if (providerProfileId) {
      await db
        .delete(reviewsTable)
        .where(eq(reviewsTable.providerId, providerProfileId));
      await db
        .delete(invoicesTable)
        .where(eq(invoicesTable.providerId, providerProfileId));
      await db
        .delete(bookingsTable)
        .where(eq(bookingsTable.providerId, providerProfileId));
    }
    for (const userId of [providerUserId, clientUserId, otherClientUserId]) {
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it("completes a real slot-backed visit (requested → confirmed → completed)", async () => {
    const created = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(bookingPayload(providerProfileId, serviceId, slots[0]!)),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    completedBookingId = (created.body["booking"] as JsonBody)["id"] as number;

    const confirmed = await apiFetch(`/bookings/${completedBookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

    const completed = await apiFetch(`/bookings/${completedBookingId}/status`, {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ status: "completed" }),
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
  });

  it("shows no review before submission (prompt state) and rejects other clients", async () => {
    const missing = await apiFetch(`/reviews/booking/${completedBookingId}`, {
      token: clientToken,
    });
    assert.equal(missing.status, 404);

    const foreign = await apiFetch("/reviews", {
      method: "POST",
      token: otherClientToken,
      body: JSON.stringify({ bookingId: completedBookingId, rating: 5 }),
    });
    assert.equal(foreign.status, 403, JSON.stringify(foreign.body));
  });

  it("accepts exactly one review for the completed visit (duplicate blocked)", async () => {
    const created = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        bookingId: completedBookingId,
        rating: 5,
        comment: "Wonderful, gentle care — booking again.",
      }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const duplicate = await apiFetch("/reviews", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({ bookingId: completedBookingId, rating: 4 }),
    });
    assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));

    const fetched = await apiFetch(`/reviews/booking/${completedBookingId}`, {
      token: clientToken,
    });
    assert.equal(fetched.status, 200);
  });

  it("keeps the original ACTIVE service discoverable for rebooking", async () => {
    const r = await apiFetch(`/providers/${providerProfileId}/services`);
    assert.equal(r.status, 200);
    const services = r.body["services"] as Array<JsonBody>;
    assert.ok(
      services.some((s) => s["id"] === serviceId),
      "active original service must be listed for book-again preselection",
    );
  });

  it("books again with the same provider/service at a FRESH real slot", async () => {
    const rebooked = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(bookingPayload(providerProfileId, serviceId, slots[1]!)),
    });
    assert.equal(rebooked.status, 201, JSON.stringify(rebooked.body));
    const rebookedId = (rebooked.body["booking"] as JsonBody)["id"] as number;
    assert.notEqual(rebookedId, completedBookingId);
  });

  it("keeps duplicate and overlap protections active for the new booking", async () => {
    // Exact duplicate by the same client → blocked.
    const dup = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(bookingPayload(providerProfileId, serviceId, slots[1]!)),
    });
    assert.ok(
      dup.status === 409 || dup.status === 400,
      `duplicate must be blocked, got ${dup.status}: ${JSON.stringify(dup.body)}`,
    );

    // Another client on the now-occupied slot → provider overlap blocked.
    const overlap = await apiFetch("/bookings", {
      method: "POST",
      token: otherClientToken,
      body: JSON.stringify(bookingPayload(providerProfileId, serviceId, slots[1]!)),
    });
    assert.ok(
      overlap.status === 409 || overlap.status === 400,
      `overlap must be blocked, got ${overlap.status}: ${JSON.stringify(overlap.body)}`,
    );
  });

  it("hides an INACTIVE original service and refuses to book it again", async () => {
    await db
      .update(servicesTable)
      .set({ isActive: false })
      .where(eq(servicesTable.id, serviceId));

    const list = await apiFetch(`/providers/${providerProfileId}/services`);
    assert.equal(list.status, 200);
    const services = list.body["services"] as Array<JsonBody>;
    assert.equal(
      services.some((s) => s["id"] === serviceId),
      false,
      "inactive service must disappear from the public list",
    );

    const attempt = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify(bookingPayload(providerProfileId, serviceId, slots[2]!)),
    });
    assert.ok(
      attempt.status === 400 || attempt.status === 404 || attempt.status === 409,
      `inactive service booking must be rejected, got ${attempt.status}: ${JSON.stringify(attempt.body)}`,
    );

    // Restore for cleanup determinism.
    await db
      .update(servicesTable)
      .set({ isActive: true })
      .where(eq(servicesTable.id, serviceId));
  });

  it("never exposes private client data on the public provider reviews list", async () => {
    const r = await apiFetch(`/providers/${providerProfileId}/reviews`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const reviews = r.body["reviews"] as Array<JsonBody>;
    assert.ok(reviews.length >= 1, "submitted review must appear publicly");
    for (const review of reviews) {
      for (const key of ["email", "password", "passwordHash", "phone", "address"]) {
        assert.equal(key in review, false, `public review leaked "${key}"`);
      }
    }
  });
});
