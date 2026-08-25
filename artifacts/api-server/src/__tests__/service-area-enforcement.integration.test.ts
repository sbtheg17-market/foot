/**
 * Service-area eligibility + travel/setup buffer (roadmap #12) — integration.
 *
 * Covers: provider coverage configuration (ownership, validation, add/remove,
 * duplicates), publish gating, public non-leaking eligibility checks for all
 * five states (slug + providerId surfaces), public redaction (no raw coverage
 * entries), booking enforcement (eligible/ineligible/invalid/forged),
 * 30-minute travel/setup buffer on creation, buffer-aware slot hints,
 * duplicate/overlap protections unchanged, reschedule + proposal + acceptance
 * revalidation, and source attribution neutrality.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:service-area
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "service-area-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `sa-provider-${suffix}@oncallfoot.test`;
const LEGACY_EMAIL = `sa-legacy-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `sa-client-${suffix}@oncallfoot.test`;
const CLIENT2_EMAIL = `sa-client2-${suffix}@oncallfoot.test`;

const NOT_FOUND_BODY = { error: "Booking page not found." };

const MESSAGES = {
  eligible: "Great — this provider serves your area. Choose a service and time.",
  ineligible:
    "This provider does not currently serve this area. Check the postal code or try another provider nearby.",
  needs_review:
    "We could not confirm this location yet. Check the postal code or contact the provider for service-area review before booking.",
  invalid:
    "Enter a valid Canadian postal code and location details to check service availability.",
  unavailable:
    "Online booking is not currently available for this provider\u2019s service area.",
} as const;

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

async function profileFor(userId: number) {
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(row, "provider profile must exist after registration");
  return row.id;
}

async function approveProvider(userId: number, profileId: number, city: string) {
  await db
    .update(providerProfilesTable)
    .set({
      title: "Mobile foot-care specialist",
      city,
      bio: "Calm, client-first in-home foot care.",
      verificationStatus: "approved",
      acceptsNewClients: true,
    })
    .where(eq(providerProfilesTable.id, profileId));
  await db
    .update(providerApplicationsTable)
    .set({ status: "approved", currentStep: "submitted" })
    .where(eq(providerApplicationsTable.userId, userId));
}

async function addFullAvailability(profileId: number) {
  for (let day = 0; day <= 6; day++) {
    await db.insert(availabilityTable).values({
      providerId: profileId,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
    });
  }
}

async function addService(profileId: number, durationMinutes: number) {
  const [svc] = await db
    .insert(servicesTable)
    .values({
      providerId: profileId,
      title: `Routine care ${durationMinutes}m`,
      description: "In-home visit",
      durationMinutes,
      priceCents: 9500,
      category: "foot_care",
      isActive: true,
    })
    .returning({ id: servicesTable.id });
  return svc!.id;
}

/** Future YYYY-MM-DD, `days` from now. */
function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function getSlots(providerId: number, serviceId: number, date: string) {
  const r = await apiFetch(
    `/providers/${providerId}/slots?serviceId=${serviceId}&date=${date}`,
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body["slots"] as Array<{ start: string; end: string; available: boolean }>;
}

// Shared fixtures
let provider: { token: string; userId: number; profileId: number };
let legacy: { token: string; userId: number; profileId: number };
let client: { token: string; userId: number };
let client2: { token: string; userId: number };
let serviceId: number;
let legacyServiceId: number;
let slug: string;

before(async () => {
  const p = await register(PROVIDER_EMAIL, "provider", "Sasha", "AreaPro");
  const pid = await profileFor(p.userId);
  await approveProvider(p.userId, pid, "Toronto");
  await addFullAvailability(pid);
  serviceId = await addService(pid, 60);
  provider = { ...p, profileId: pid };

  const l = await register(LEGACY_EMAIL, "provider", "Lena", "Legacy");
  const lid = await profileFor(l.userId);
  await approveProvider(l.userId, lid, "Toronto");
  await addFullAvailability(lid);
  legacyServiceId = await addService(lid, 60);
  legacy = { ...l, profileId: lid };

  client = await register(CLIENT_EMAIL, "client", "Casey", "Client");
  client2 = await register(CLIENT2_EMAIL, "client", "Devon", "Client");
});

// ── Provider configuration ────────────────────────────────────────────────────

describe("provider service-area configuration", () => {
  it("starts unconfigured with the visible 30-minute buffer", async () => {
    const r = await apiFetch("/providers/me/service-area", { token: provider.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sa = r.body["serviceArea"] as JsonBody;
    assert.equal(sa["configured"], false);
    assert.equal(sa["publishEligible"], false);
    assert.equal(sa["bufferMinutes"], 30);
    assert.equal(sa["bufferSource"], "default");
    assert.deepEqual(sa["prefixes"], []);
  });

  it("publishing is blocked before coverage exists", async () => {
    const r = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: provider.token,
    });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "service_area_required");
  });

  it("adding a prefix before the configuration is rejected with guidance", async () => {
    const r = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "M5V" }),
    });
    assert.equal(r.status, 409, JSON.stringify(r.body));
  });

  it("rejects an unsupported country and an unknown province", async () => {
    const badCountry = await apiFetch("/providers/me/service-area", {
      method: "PUT",
      token: provider.token,
      body: JSON.stringify({ countryCode: "US", provinceCode: "ON" }),
    });
    assert.equal(badCountry.status, 400);
    const badProvince = await apiFetch("/providers/me/service-area", {
      method: "PUT",
      token: provider.token,
      body: JSON.stringify({ countryCode: "CA", provinceCode: "Narnia" }),
    });
    assert.equal(badProvince.status, 400);
  });

  it("saves a normalized configuration", async () => {
    const r = await apiFetch("/providers/me/service-area", {
      method: "PUT",
      token: provider.token,
      body: JSON.stringify({
        countryCode: "ca",
        provinceCode: "ontario",
        city: " Toronto ",
        publicDescription: "Serving downtown Toronto and East York.",
      }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sa = r.body["serviceArea"] as JsonBody;
    assert.equal(sa["countryCode"], "CA");
    assert.equal(sa["provinceCode"], "ON");
    assert.equal(sa["city"], "Toronto");
    assert.equal(sa["configured"], false, "no prefixes yet");
  });

  it("normalizes and adds prefixes; rejects malformed and duplicate entries", async () => {
    const bad = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "123" }),
    });
    assert.equal(bad.status, 400);

    const a = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: " m5v " }),
    });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal((a.body["prefix"] as JsonBody)["prefix"], "M5V");

    // A full postal code derives its FSA.
    const b = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "M4C 1B5" }),
    });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.equal((b.body["prefix"] as JsonBody)["prefix"], "M4C");

    const dup = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "M5V" }),
    });
    assert.equal(dup.status, 409, JSON.stringify(dup.body));
  });

  it("lists active coverage and reports publish eligibility", async () => {
    const r = await apiFetch("/providers/me/service-area", { token: provider.token });
    const sa = r.body["serviceArea"] as JsonBody;
    const prefixes = sa["prefixes"] as Array<JsonBody>;
    assert.deepEqual(prefixes.map((p) => p["prefix"]), ["M4C", "M5V"]);
    assert.equal(sa["configured"], true);
    assert.equal(sa["publishEligible"], true);
  });

  it("denies cross-provider prefix removal (non-leaking 404)", async () => {
    const mine = await apiFetch("/providers/me/service-area", { token: provider.token });
    const target = ((mine.body["serviceArea"] as JsonBody)["prefixes"] as Array<JsonBody>)[0]!;
    // legacy provider tries to delete provider A's coverage entry
    const r = await apiFetch(`/providers/me/service-area/prefixes/${target["id"]}`, {
      method: "DELETE",
      token: legacy.token,
    });
    assert.equal(r.status, 404, JSON.stringify(r.body));
    // entry still present for its owner
    const after = await apiFetch("/providers/me/service-area", { token: provider.token });
    assert.equal(
      ((after.body["serviceArea"] as JsonBody)["prefixes"] as Array<JsonBody>).length,
      2,
    );
  });

  it("removes and re-adds a prefix (remove is not destructive to history)", async () => {
    const add = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "M6H" }),
    });
    assert.equal(add.status, 201);
    const id = (add.body["prefix"] as JsonBody)["id"];
    const del = await apiFetch(`/providers/me/service-area/prefixes/${id}`, {
      method: "DELETE",
      token: provider.token,
    });
    assert.equal(del.status, 200);
    const readd = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({ prefix: "M6H" }),
    });
    assert.equal(readd.status, 201, JSON.stringify(readd.body));
    const cleanup = await apiFetch(
      `/providers/me/service-area/prefixes/${(readd.body["prefix"] as JsonBody)["id"]}`,
      { method: "DELETE", token: provider.token },
    );
    assert.equal(cleanup.status, 200);
  });

  it("requires authentication and provider role", async () => {
    const anon = await apiFetch("/providers/me/service-area");
    assert.equal(anon.status, 401);
    const asClient = await apiFetch("/providers/me/service-area", { token: client.token });
    assert.equal(asClient.status, 403);
  });

  it("publish succeeds once coverage is configured", async () => {
    const r = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: provider.token,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = r.body["bookingPage"] as JsonBody;
    assert.equal(page["published"], true);
    assert.equal(page["serviceAreaConfigured"], true);
    slug = page["slug"] as string;
    assert.ok(slug);
  });
});

// ── Public surfaces ───────────────────────────────────────────────────────────

describe("public booking page + eligibility checks", () => {
  it("page exposes the safe service-area summary and never raw coverage", async () => {
    const r = await apiFetch(`/booking-pages/${slug}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = r.body["page"] as JsonBody;
    const sa = page["serviceArea"] as JsonBody;
    assert.equal(sa["configured"], true);
    assert.equal(sa["description"], "Serving downtown Toronto and East York.");
    assert.equal(sa["provinceCode"], "ON");
    const raw = JSON.stringify(r.body);
    assert.ok(!raw.includes("M5V"), "raw FSA prefixes must never leak publicly");
    assert.ok(!raw.includes("M4C"), "raw FSA prefixes must never leak publicly");
    assert.ok(!raw.includes("prefixes"), "coverage entry list must never leak publicly");
    assert.ok(!raw.includes("userId"), "no account ids on the public page");
  });

  it("returns every eligibility state with the exact approved message (slug)", async () => {
    const check = (body: JsonBody) =>
      apiFetch(`/booking-pages/${slug}/service-area-check`, {
        method: "POST",
        body: JSON.stringify(body),
      });

    const eligible = await check({
      country: "Canada", province: "Ontario", city: "Toronto", postalCode: "m5v 2t6",
    });
    assert.equal(eligible.status, 200);
    assert.deepEqual(eligible.body["eligibility"], {
      status: "eligible", reason: "fsa_match", message: MESSAGES.eligible,
    });

    const ineligible = await check({
      country: "CA", province: "ON", city: "Toronto", postalCode: "M6K 3P6",
    });
    assert.deepEqual(ineligible.body["eligibility"], {
      status: "ineligible", reason: "fsa_not_covered", message: MESSAGES.ineligible,
    });

    const otherCountry = await check({
      country: "US", province: "ON", city: "Toronto", postalCode: "M5V 2T6",
    });
    assert.equal((otherCountry.body["eligibility"] as JsonBody)["status"], "ineligible");

    const needsReview = await check({
      country: "CA", province: "BC", city: "Vancouver", postalCode: "M5V 2T6",
    });
    assert.deepEqual(needsReview.body["eligibility"], {
      status: "needs_review", reason: "province_mismatch", message: MESSAGES.needs_review,
    });

    const invalid = await check({
      country: "CA", province: "ON", city: "Toronto", postalCode: "12345",
    });
    assert.deepEqual(invalid.body["eligibility"], {
      status: "invalid", reason: "malformed_postal_code", message: MESSAGES.invalid,
    });

    const missing = await check({ country: "CA", province: "ON" });
    assert.equal((missing.body["eligibility"] as JsonBody)["status"], "invalid");
  });

  it("missing/invalid slugs stay generic and non-leaking", async () => {
    const missing = await apiFetch(`/booking-pages/definitely-not-real/service-area-check`, {
      method: "POST",
      body: JSON.stringify({ country: "CA", province: "ON", postalCode: "M5V 2T6" }),
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, NOT_FOUND_BODY);
    const invalidSlug = await apiFetch(`/booking-pages/__/service-area-check`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(invalidSlug.status, 404);
    assert.deepEqual(invalidSlug.body, NOT_FOUND_BODY);
  });

  it("marketplace check works by provider id and reports unavailable when unconfigured", async () => {
    const eligible = await apiFetch(`/providers/${provider.profileId}/service-area-check`, {
      method: "POST",
      body: JSON.stringify({ country: "CA", province: "ON", postalCode: "M5V2T6" }),
    });
    assert.equal((eligible.body["eligibility"] as JsonBody)["status"], "eligible");

    const unconfigured = await apiFetch(`/providers/${legacy.profileId}/service-area-check`, {
      method: "POST",
      body: JSON.stringify({ country: "CA", province: "ON", postalCode: "M5V2T6" }),
    });
    assert.deepEqual(unconfigured.body["eligibility"], {
      status: "unavailable", reason: "not_configured", message: MESSAGES.unavailable,
    });

    const nope = await apiFetch(`/providers/99999999/service-area-check`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(nope.status, 404);
  });
});

// ── Booking enforcement ───────────────────────────────────────────────────────

describe("booking enforcement (coverage + buffer)", () => {
  const bookingBody = (scheduledAt: string, postalCode: string | undefined, extra: JsonBody = {}) => ({
    providerId: provider.profileId,
    serviceId,
    scheduledAt,
    address: "123 King St W",
    city: "Toronto",
    ...(postalCode !== undefined ? { postalCode } : {}),
    ...extra,
  });

  let day: string;
  let daySlots: Array<{ start: string; end: string; available: boolean }>;

  before(async () => {
    day = futureDate(30);
    daySlots = await getSlots(provider.profileId, serviceId, day);
    assert.ok(daySlots.length >= 8, "expected a full availability day");
  });

  it("blocks an ineligible location before creation", async () => {
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(bookingBody(daySlots[0]!.start, "M6K 3P6")),
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "outside_service_area");
    assert.equal(r.body["error"], MESSAGES.ineligible);
  });

  it("blocks a missing or malformed postal code before creation", async () => {
    const missing = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(bookingBody(daySlots[0]!.start, undefined)),
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.body["reason"], "invalid_location");

    const malformed = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(bookingBody(daySlots[0]!.start, "90210")),
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body["reason"], "invalid_location");
  });

  it("ignores forged client eligibility assertions", async () => {
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(
        bookingBody(daySlots[0]!.start, "V6B 1A1", {
          eligibility: "eligible",
          serviceAreaStatus: "eligible",
          eligible: true,
        }),
      ),
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "outside_service_area");
  });

  it("source attribution never affects eligibility", async () => {
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(
        bookingBody(daySlots[0]!.start, "M6K 3P6", { source: "instagram" }),
      ),
    });
    assert.equal(r.status, 400);
    assert.equal(r.body["reason"], "outside_service_area");
  });

  let firstBookingId: number;
  let firstStart: string;

  it("creates an eligible booking (postal normalized server-side)", async () => {
    // Use the 10:00-position slot so earlier slots remain for gap tests.
    firstStart = daySlots[2]!.start;
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(bookingBody(firstStart, "m5v 2t6", { source: "instagram" })),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    firstBookingId = (r.body["booking"] as JsonBody)["id"] as number;
  });

  it("keeps duplicate-booking protection intact (before any buffer error)", async () => {
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify(bookingBody(firstStart, "M5V 2T6")),
    });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "duplicate_booking");
  });

  it("keeps provider-overlap protection intact for another client", async () => {
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client2.token,
      body: JSON.stringify(bookingBody(firstStart, "M5V 2T6")),
    });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "provider_unavailable");
  });

  it("blocks a booking inside the 30-minute travel/setup buffer", async () => {
    // firstStart + 60min service ends at slot index 4; the back-to-back slot
    // (index 4) violates the 30-minute buffer.
    const backToBack = daySlots[4]!.start;
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client2.token,
      body: JSON.stringify(bookingBody(backToBack, "M5V 2T6")),
    });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "travel_buffer_conflict");
  });

  it("allows a booking separated by the full buffer gap", async () => {
    // end (index 4 position) + 30-minute buffer → index 5 start is exactly
    // 30 minutes after the first booking ends: allowed.
    const gapStart = daySlots[5]!.start;
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client2.token,
      body: JSON.stringify(bookingBody(gapStart, "M4C 1B5")),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  it("marks buffered slots unavailable in the public slot hints", async () => {
    const slots = await getSlots(provider.profileId, serviceId, day);
    const byStart = new Map(slots.map((s) => [s.start, s.available]));
    // The exact booked starts are unavailable, and so is the back-to-back
    // slot right after the first booking (buffer).
    assert.equal(byStart.get(firstStart), false);
    assert.equal(byStart.get(daySlots[4]!.start), false, "buffered slot must be hinted unavailable");
    // A slot far after both bookings remains available.
    assert.equal(byStart.get(daySlots[10]!.start), true);
  });

  it("legacy providers without coverage keep existing marketplace behavior", async () => {
    const legacySlots = await getSlots(legacy.profileId, legacyServiceId, day);
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: client.token,
      body: JSON.stringify({
        providerId: legacy.profileId,
        serviceId: legacyServiceId,
        scheduledAt: legacySlots[0]!.start,
        address: "77 Main St",
        city: "Toronto",
        // no postal code at all — allowed while unconfigured
      }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  // ── Rescheduling enforcement ────────────────────────────────────────────────

  describe("rescheduling revalidates coverage and buffer", () => {
    before(async () => {
      // Provider confirms the first booking so reschedule paths are open.
      const r = await apiFetch(`/bookings/${firstBookingId}/status`, {
        method: "PATCH",
        token: provider.token,
        body: JSON.stringify({ status: "confirmed" }),
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    });

    it("client reschedule respects the travel/setup buffer", async () => {
      // client2 holds daySlots[5]; moving the first booking to start
      // back-to-back with it (index 7 end→ index 7 = slot5+60m) violates
      // the buffer.
      const target = daySlots[7]!.start; // ends 60m later; 0-gap after client2's booking
      const r = await apiFetch(`/bookings/${firstBookingId}/status`, {
        method: "PATCH",
        token: client.token,
        body: JSON.stringify({ status: "rescheduled", scheduledAt: target }),
      });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.match(String(r.body["error"]), /travel and setup gap/);
    });

    it("coverage applies to a future client reschedule after coverage changes", async () => {
      // Remove M5V from coverage — the confirmed booking itself stays valid.
      const mine = await apiFetch("/providers/me/service-area", { token: provider.token });
      const prefixes = (mine.body["serviceArea"] as JsonBody)["prefixes"] as Array<JsonBody>;
      const m5v = prefixes.find((p) => p["prefix"] === "M5V")!;
      const del = await apiFetch(`/providers/me/service-area/prefixes/${m5v["id"]}`, {
        method: "DELETE",
        token: provider.token,
      });
      assert.equal(del.status, 200);

      // Existing confirmed booking remains present and confirmed.
      const detail = await apiFetch(`/bookings/${firstBookingId}`, { token: client.token });
      assert.equal(detail.status, 200);
      assert.equal((detail.body["booking"] as JsonBody)["status"], "confirmed");

      // But a reschedule of that booking is now blocked.
      const target = daySlots[10]!.start;
      const r = await apiFetch(`/bookings/${firstBookingId}/status`, {
        method: "PATCH",
        token: client.token,
        body: JSON.stringify({ status: "rescheduled", scheduledAt: target }),
      });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.match(String(r.body["error"]), /service area/);

      // Provider proposals for that booking are blocked the same way.
      const proposal = await apiFetch(`/bookings/${firstBookingId}/reschedule-requests`, {
        method: "POST",
        token: provider.token,
        body: JSON.stringify({
          proposedScheduledAt: target,
          idempotencyKey: `sa-blocked-${suffix}`,
        }),
      });
      assert.equal(proposal.status, 409, JSON.stringify(proposal.body));

      // Restore coverage for the remaining scenarios.
      const readd = await apiFetch("/providers/me/service-area/prefixes", {
        method: "POST",
        token: provider.token,
        body: JSON.stringify({ prefix: "M5V" }),
      });
      assert.equal(readd.status, 201);
    });

    it("proposal acceptance revalidates coverage at consent time", async () => {
      const target = daySlots[10]!.start;
      const create = await apiFetch(`/bookings/${firstBookingId}/reschedule-requests`, {
        method: "POST",
        token: provider.token,
        body: JSON.stringify({
          proposedScheduledAt: target,
          idempotencyKey: `sa-accept-${suffix}`,
        }),
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const proposalId = (create.body["proposal"] as JsonBody)["id"];

      // Coverage changes between proposal and consent.
      const mine = await apiFetch("/providers/me/service-area", { token: provider.token });
      const prefixes = (mine.body["serviceArea"] as JsonBody)["prefixes"] as Array<JsonBody>;
      const m5v = prefixes.find((p) => p["prefix"] === "M5V")!;
      await apiFetch(`/providers/me/service-area/prefixes/${m5v["id"]}`, {
        method: "DELETE",
        token: provider.token,
      });

      const accept = await apiFetch(`/reschedule-requests/${proposalId}/accept`, {
        method: "POST",
        token: client.token,
      });
      assert.equal(accept.status, 409, JSON.stringify(accept.body));
      assert.match(String(accept.body["error"]), /service area/);

      // Booking unchanged.
      const detail = await apiFetch(`/bookings/${firstBookingId}`, { token: client.token });
      assert.equal((detail.body["booking"] as JsonBody)["status"], "confirmed");
      assert.equal(
        (detail.body["booking"] as JsonBody)["scheduledAt"],
        new Date(firstStart).toISOString(),
      );

      // Restore coverage, then acceptance succeeds under the same rules.
      const readd = await apiFetch("/providers/me/service-area/prefixes", {
        method: "POST",
        token: provider.token,
        body: JSON.stringify({ prefix: "M5V" }),
      });
      assert.equal(readd.status, 201);

      const accept2 = await apiFetch(`/reschedule-requests/${proposalId}/accept`, {
        method: "POST",
        token: client.token,
      });
      assert.equal(accept2.status, 200, JSON.stringify(accept2.body));
      assert.equal(
        (accept2.body["booking"] as JsonBody)["scheduledAt"],
        new Date(target).toISOString(),
      );
    });

    it("provider proposals respect the travel/setup buffer", async () => {
      // client2's booking sits at daySlots[5]; proposing the back-to-back
      // slot right after it (index 7) violates the buffer.
      const r = await apiFetch(`/bookings/${firstBookingId}/reschedule-requests`, {
        method: "POST",
        token: provider.token,
        body: JSON.stringify({
          proposedScheduledAt: daySlots[7]!.start,
          idempotencyKey: `sa-buffer-${suffix}`,
        }),
      });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.match(String(r.body["error"]), /travel and setup gap/);
    });
  });
});
