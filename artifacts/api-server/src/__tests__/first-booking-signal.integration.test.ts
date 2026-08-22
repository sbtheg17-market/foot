/**
 * Provider first-booking conversion — server-side signal coverage.
 *
 * The dashboard first-booking CTA renders from exactly three server signals:
 *   1. GET /providers/me/readiness  → `activated` (authoritative gate);
 *   2. GET /bookings (provider)     → `total` (zero vs. one-or-more);
 *   3. GET /providers/:id           → canonical public listing resolvability.
 *
 * This suite proves those signals behave correctly across the CTA states —
 * no new API routes, no schema changes, no analytics events.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:first-booking
 *
 * Covers (all against live HTTP + direct DB fixture writes):
 *   - 401 unauthenticated readiness (no signal without a session)
 *   - fresh provider: activated=false → CTA suppressed by contract
 *   - fully activated provider (C1–C7 satisfied via raw source fields)
 *     reports activated=true with an empty missing list
 *   - zero-booking signal: provider booking list total === 0
 *   - canonical public listing GET /providers/:id resolves unauthenticated
 *     and never leaks private account fields
 *   - after a real slot-backed client booking, total === 1 (compact state)
 *   - unapproved provider cannot read the booking list (403) — the count is
 *     unavailable, so the client must never claim "zero bookings"
 *   - owner scoping: bookings on one provider never leak to another
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  bookingsTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  travelZonesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "first-booking-signal-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `first-booking-provider-${suffix}@oncallfoot.test`;
const OTHER_PROVIDER_EMAIL = `first-booking-other-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `first-booking-client-${suffix}@oncallfoot.test`;

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
      firstName: "FirstBooking",
      lastName: "Signal",
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

async function profileFor(userId: number) {
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(row, "provider profile must exist after registration");
  return row.id;
}

type Readiness = {
  activated: boolean;
  missing: string[];
  criteria: Record<string, boolean>;
};

function readinessOf(body: JsonBody): Readiness {
  const readiness = body["readiness"] as Readiness | undefined;
  assert.ok(readiness, `response must contain readiness: ${JSON.stringify(body)}`);
  return readiness;
}

/** Find the first available real slot for a service over the next 14 days. */
async function firstAvailableSlot(
  providerProfileId: number,
  serviceId: number,
): Promise<string> {
  const base = Date.now();
  for (let d = 1; d <= 14; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { body } = await apiFetch(
      `/providers/${providerProfileId}/slots?serviceId=${serviceId}&date=${date}`,
    );
    const slots =
      (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
    const open = slots.find((s) => s.available);
    if (open) return open.start;
  }
  assert.fail("no available slot found in the next 14 days");
}

describe("First-booking conversion signals", () => {
  let providerToken = "";
  let providerUserId = 0;
  let providerProfileId = 0;
  let otherToken = "";
  let otherUserId = 0;
  let clientToken = "";
  let clientUserId = 0;
  let serviceId = 0;

  before(async () => {
    const health = await apiFetch("/healthz");
    assert.equal(health.status, 200, "API server must be running");

    const provider = await register(PROVIDER_EMAIL, "provider");
    providerToken = provider.token;
    providerUserId = provider.userId;
    providerProfileId = await profileFor(providerUserId);

    const other = await register(OTHER_PROVIDER_EMAIL, "provider");
    otherToken = other.token;
    otherUserId = other.userId;

    const client = await register(CLIENT_EMAIL, "client");
    clientToken = client.token;
    clientUserId = client.userId;
  });

  after(async () => {
    // Bookings reference the provider profile without cascade — remove them
    // first so the user cascade deletes below can proceed.
    if (providerProfileId) {
      await db
        .delete(bookingsTable)
        .where(eq(bookingsTable.providerId, providerProfileId));
    }
    // User cascade deletes clean up profiles, applications, services,
    // availability, and travel zones.
    for (const userId of [providerUserId, otherUserId, clientUserId]) {
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it("returns 401 for unauthenticated readiness (no CTA signal without a session)", async () => {
    const r = await apiFetch("/providers/me/readiness");
    assert.equal(r.status, 401);
  });

  it("reports activated=false for a fresh provider (CTA suppressed by contract)", async () => {
    const r = await apiFetch("/providers/me/readiness", { token: providerToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const readiness = readinessOf(r.body);
    assert.equal(readiness.activated, false);
    assert.ok(readiness.missing.includes("NOT_APPROVED"));
  });

  it("denies the booking list to an unapproved provider (count unavailable — never claim zero)", async () => {
    const r = await apiFetch("/bookings", { token: otherToken });
    assert.equal(r.status, 403, JSON.stringify(r.body));
  });

  it("reports activated=true once C1–C7 are satisfied from raw source fields", async () => {
    // C2: complete profile; C1: verification approved; C6 defaults true.
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

    // C1: application approved.
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", currentStep: "submitted" })
      .where(eq(providerApplicationsTable.userId, providerUserId));

    // C3: one ACTIVE service.
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

    // C4: availability on every weekday so real slots exist regardless of
    // the process-UTC day this suite runs on.
    for (let day = 0; day <= 6; day++) {
      await db.insert(availabilityTable).values({
        providerId: providerProfileId,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
      });
    }

    // C5: one travel zone.
    await db.insert(travelZonesTable).values({
      providerId: providerProfileId,
      zoneName: "Downtown core",
      city: "Toronto",
    });

    const r = await apiFetch("/providers/me/readiness", { token: providerToken });
    assert.equal(r.status, 200);
    const readiness = readinessOf(r.body);
    assert.deepEqual(readiness.missing, []);
    assert.equal(readiness.activated, true);
  });

  it("reports total=0 bookings for the newly activated provider (zero-booking CTA state)", async () => {
    const r = await apiFetch("/bookings", { token: providerToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body["total"], 0);
    assert.deepEqual(r.body["bookings"], []);
  });

  it("resolves the canonical public listing URL without auth and without private fields", async () => {
    const r = await apiFetch(`/providers/${providerProfileId}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const provider = r.body["provider"] as JsonBody;
    assert.ok(provider, "public listing must include provider");
    assert.equal(provider["id"], providerProfileId);
    // The share payload is public-only; the public listing must never leak
    // account-private fields.
    for (const key of ["email", "password", "passwordHash", "phone"]) {
      assert.equal(key in provider, false, `public listing leaked "${key}"`);
    }
  });

  it("moves the signal to total=1 after a real slot-backed client booking (compact state)", async () => {
    const scheduledAt = await firstAvailableSlot(providerProfileId, serviceId);

    const created = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId: providerProfileId,
        serviceId,
        scheduledAt,
        address: "77 Conversion Way",
        city: "Toronto",
        postalCode: "M5V 1A1",
      }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const r = await apiFetch("/bookings", { token: providerToken });
    assert.equal(r.status, 200);
    assert.equal(r.body["total"], 1);
  });

  it("keeps the booking signal owner-scoped (client list shows the client's own booking only)", async () => {
    const r = await apiFetch("/bookings", { token: clientToken });
    assert.equal(r.status, 200);
    assert.equal(r.body["total"], 1);
    const bookings = r.body["bookings"] as JsonBody[];
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0]?.["clientId"], clientUserId);
  });
});
