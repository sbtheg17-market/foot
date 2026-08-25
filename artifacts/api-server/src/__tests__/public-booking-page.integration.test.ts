/**
 * Provider public booking pages (roadmap #11) — integration coverage.
 *
 * Covers slug generation/validation/collision, publish/unpublish authorization
 * and idempotence, the non-leaking public 404 contract (missing, unpublished,
 * unapproved, and format-invalid slugs are indistinguishable), public payload
 * redaction, active-services-only exposure, booking from the page through the
 * EXISTING booking path (availability protections intact), and the allowlisted
 * source-attribution behavior.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:booking-page
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import {
  availabilityTable,
  bookingsTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "booking-page-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `booking-page-provider-${suffix}@oncallfoot.test`;
const TWIN_EMAIL = `booking-page-twin-${suffix}@oncallfoot.test`;
const UNAPPROVED_EMAIL = `booking-page-unapproved-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `booking-page-client-${suffix}@oncallfoot.test`;

const NOT_FOUND_BODY = { error: "Booking page not found." };

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

/** Approve a provider through raw source fields (mirrors first-booking suite). */
async function approveProvider(userId: number, profileId: number) {
  await db
    .update(providerProfilesTable)
    .set({
      title: "Mobile foot-care specialist",
      city: "Toronto",
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

/**
 * Configure an active service area with one covered postal area (roadmap
 * #12): publishing a public booking page now requires active coverage, so
 * the #11 publish/slug behaviors under test here run with coverage set up.
 */
async function configureServiceArea(token: string) {
  const config = await apiFetch("/providers/me/service-area", {
    method: "PUT",
    token,
    body: JSON.stringify({ countryCode: "CA", provinceCode: "ON", city: "Toronto" }),
  });
  assert.equal(config.status, 200, JSON.stringify(config.body));
  const prefix = await apiFetch("/providers/me/service-area/prefixes", {
    method: "POST",
    token,
    body: JSON.stringify({ prefix: "M5V" }),
  });
  assert.equal(prefix.status, 201, JSON.stringify(prefix.body));
}

async function addWeekdayAvailability(profileId: number) {
  for (let day = 0; day <= 6; day++) {
    await db.insert(availabilityTable).values({
      providerId: profileId,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
    });
  }
}

/** Find the first available real slot for a service over the next 14 days. */
async function firstAvailableSlot(
  providerProfileId: number,
  serviceId: number,
  skip = 0,
): Promise<string> {
  const base = Date.now();
  let seen = 0;
  for (let d = 1; d <= 14; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { body } = await apiFetch(
      `/providers/${providerProfileId}/slots?serviceId=${serviceId}&date=${date}`,
    );
    const slots = (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
    for (const s of slots) {
      if (!s.available) continue;
      if (seen === skip) return s.start;
      seen += 1;
    }
  }
  assert.fail("no available slot found in the next 14 days");
}

function bookingPageOf(body: JsonBody) {
  const bp = body["bookingPage"] as JsonBody | undefined;
  assert.ok(bp, `response must contain bookingPage: ${JSON.stringify(body)}`);
  return bp;
}

describe("Provider public booking pages (roadmap #11)", () => {
  let providerToken = "";
  let providerUserId = 0;
  let providerProfileId = 0;
  let twinToken = "";
  let twinUserId = 0;
  let twinProfileId = 0;
  let unapprovedToken = "";
  let unapprovedUserId = 0;
  let clientToken = "";
  let clientUserId = 0;
  let activeServiceId = 0;
  let inactiveServiceId = 0;
  let slug = "";

  before(async () => {
    const health = await apiFetch("/healthz");
    assert.equal(health.status, 200, "API server must be running");

    // Diacritics + apostrophe exercise the kebab-case slugifier.
    const provider = await register(PROVIDER_EMAIL, "provider", "Sárah", "O'Neil Page");
    providerToken = provider.token;
    providerUserId = provider.userId;
    providerProfileId = await profileFor(providerUserId);
    await approveProvider(providerUserId, providerProfileId);
    await addWeekdayAvailability(providerProfileId);
    await configureServiceArea(providerToken);

    const [active] = await db
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
    activeServiceId = active!.id;

    const [inactive] = await db
      .insert(servicesTable)
      .values({
        providerId: providerProfileId,
        title: "Retired legacy package",
        durationMinutes: 30,
        priceCents: 5000,
        category: "foot_care",
        isActive: false,
      })
      .returning({ id: servicesTable.id });
    inactiveServiceId = inactive!.id;

    // Identical display name → deterministic collision suffix at publish.
    const twin = await register(TWIN_EMAIL, "provider", "Sárah", "O'Neil Page");
    twinToken = twin.token;
    twinUserId = twin.userId;
    twinProfileId = await profileFor(twinUserId);
    await approveProvider(twinUserId, twinProfileId);
    await configureServiceArea(twinToken);

    const unapproved = await register(UNAPPROVED_EMAIL, "provider", "Draft", "Provider");
    unapprovedToken = unapproved.token;
    unapprovedUserId = unapproved.userId;

    const client = await register(CLIENT_EMAIL, "client", "Casey", "Client");
    clientToken = client.token;
    clientUserId = client.userId;
  });

  after(async () => {
    for (const profileId of [providerProfileId, twinProfileId]) {
      if (profileId) {
        await db.delete(bookingsTable).where(eq(bookingsTable.providerId, profileId));
      }
    }
    const userIds = [providerUserId, twinUserId, unapprovedUserId, clientUserId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
  });

  // ── Public 404 contract (non-leaking) ────────────────────────────────────────

  it("returns the same generic 404 for format-invalid slugs (never hits provider data)", async () => {
    for (const bad of ["x", "UPPERCASE", "-leading", "trailing-", "a".repeat(65), "bad_underscore"]) {
      const r = await apiFetch(`/booking-pages/${encodeURIComponent(bad)}`);
      assert.equal(r.status, 404, `expected 404 for ${bad}`);
      assert.deepEqual(r.body, NOT_FOUND_BODY);
    }
  });

  it("returns the same generic 404 for a well-formed but unknown slug", async () => {
    const r = await apiFetch(`/booking-pages/no-such-provider-${suffix.slice(-6)}`);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, NOT_FOUND_BODY);
  });

  // ── Owner state + authorization ─────────────────────────────────────────────

  it("requires authentication for the owner booking-page state", async () => {
    const r = await apiFetch("/providers/me/booking-page");
    assert.equal(r.status, 401);
  });

  it("denies the owner booking-page state to non-provider accounts", async () => {
    const r = await apiFetch("/providers/me/booking-page", { token: clientToken });
    assert.equal(r.status, 403);
  });

  it("denies publish to client accounts and unapproved providers", async () => {
    const asClient = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: clientToken,
    });
    assert.equal(asClient.status, 403);

    const asUnapproved = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: unapprovedToken,
    });
    assert.equal(asUnapproved.status, 403);
  });

  it("reports unpublished-with-no-slug by default for an approved provider", async () => {
    const r = await apiFetch("/providers/me/booking-page", { token: providerToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const bp = bookingPageOf(r.body);
    assert.equal(bp["published"], false);
    assert.equal(bp["slug"], null);
    assert.equal(bp["path"], null);
    assert.equal(bp["eligible"], true);
  });

  it("keeps the public page 404 before the provider publishes", async () => {
    const r = await apiFetch(`/booking-pages/sarah-o-neil-page`);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, NOT_FOUND_BODY);
  });

  // ── Publish: slug generation, idempotence, collision ────────────────────────

  it("publishes with a kebab-case slug generated from the display name", async () => {
    const r = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const bp = bookingPageOf(r.body);
    assert.equal(bp["published"], true);
    assert.equal(bp["slug"], "sarah-o-neil-page");
    assert.equal(bp["path"], "/book/sarah-o-neil-page");
    assert.ok(bp["publishedAt"], "publishedAt must be set");
    slug = bp["slug"] as string;
    assert.match(slug, /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
  });

  it("republish is idempotent and never changes the slug", async () => {
    const r = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(r.status, 200);
    const bp = bookingPageOf(r.body);
    assert.equal(bp["slug"], slug);
    assert.equal(bp["published"], true);
  });

  it("resolves a display-name collision with a deterministic suffix", async () => {
    const r = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: twinToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const bp = bookingPageOf(r.body);
    assert.equal(bp["slug"], "sarah-o-neil-page-2");
  });

  // ── Public payload ───────────────────────────────────────────────────────────

  it("serves the public page with a redacted, public-safe payload", async () => {
    const r = await apiFetch(`/booking-pages/${slug}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = r.body["page"] as JsonBody;
    assert.equal(page["slug"], slug);

    const provider = page["provider"] as JsonBody;
    assert.equal(provider["id"], providerProfileId);
    assert.equal(provider["firstName"], "Sárah");
    assert.equal(provider["verificationStatus"], "approved");
    // Never expose account identifiers or private fields.
    assert.ok(!("userId" in provider), "public payload must not expose userId");
    assert.ok(!("email" in provider), "public payload must not expose email");
    assert.ok(!("phone" in provider), "public payload must not expose phone");

    const services = page["services"] as Array<JsonBody>;
    assert.equal(services.length, 1, "only ACTIVE services are public");
    assert.equal(services[0]!["id"], activeServiceId);
    assert.ok(
      !services.some((s) => s["id"] === inactiveServiceId),
      "inactive services must never appear",
    );

    const availability = page["availability"] as JsonBody;
    assert.equal(typeof availability["timezone"], "string");
    assert.equal((availability["windows"] as unknown[]).length, 7);
  });

  it("keeps unapproved providers' pages 404 even if flagged published (defense in depth)", async () => {
    const unapprovedProfileId = await profileFor(unapprovedUserId);
    await db
      .update(providerProfilesTable)
      .set({ publicSlug: `draft-provider-${suffix.slice(-6)}`, bookingPagePublished: true })
      .where(eq(providerProfilesTable.id, unapprovedProfileId));
    const r = await apiFetch(`/booking-pages/draft-provider-${suffix.slice(-6)}`);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, NOT_FOUND_BODY);
  });

  // ── Booking through the page (existing booking logic, attribution) ──────────

  it("books from the public page via the existing booking path and stores allowlisted attribution", async () => {
    const page = await apiFetch(`/booking-pages/${slug}`);
    const providerId = ((page.body["page"] as JsonBody)["provider"] as JsonBody)["id"] as number;
    const slot = await firstAvailableSlot(providerId, activeServiceId, 0);

    const r = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId,
        serviceId: activeServiceId,
        scheduledAt: slot,
        address: "12 Cedar Ave",
        city: "Toronto",
        postalCode: "M5V 2T6",
        source: "instagram",
      }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const bookingId = (r.body["booking"] as JsonBody)["id"] as number;

    const [row] = await db
      .select({ source: bookingsTable.source })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    assert.equal(row?.source, "instagram");
  });

  it("drops non-allowlisted attribution values without blocking the booking", async () => {
    const slot = await firstAvailableSlot(providerProfileId, activeServiceId, 1);
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId: providerProfileId,
        serviceId: activeServiceId,
        scheduledAt: slot,
        address: "12 Cedar Ave",
        city: "Toronto",
        postalCode: "M5V 2T6",
        source: "tracking-<script>alert(1)</script>",
      }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const bookingId = (r.body["booking"] as JsonBody)["id"] as number;

    const [row] = await db
      .select({ source: bookingsTable.source })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    assert.equal(row?.source, null, "unknown attribution must be dropped, not stored");
  });

  it("keeps availability enforcement intact for bookings made from the page", async () => {
    const slot = await firstAvailableSlot(providerProfileId, activeServiceId, 2);
    const outside = new Date(new Date(slot).getTime() + 12 * 60 * 60 * 1000).toISOString();
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId: providerProfileId,
        serviceId: activeServiceId,
        scheduledAt: outside,
        address: "12 Cedar Ave",
        city: "Toronto",
        postalCode: "M5V 2T6",
        source: "qr-card",
      }),
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body["reason"], "outside_availability");
  });

  // ── Unpublish ────────────────────────────────────────────────────────────────

  it("unpublish removes public access, retains the slug, and republish restores the same URL", async () => {
    const off = await apiFetch("/providers/me/booking-page/unpublish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(off.status, 200);
    const offBp = bookingPageOf(off.body);
    assert.equal(offBp["published"], false);
    assert.equal(offBp["slug"], slug, "slug is retained on unpublish");

    const pub = await apiFetch(`/booking-pages/${slug}`);
    assert.equal(pub.status, 404);
    assert.deepEqual(pub.body, NOT_FOUND_BODY);

    // Idempotent second unpublish.
    const again = await apiFetch("/providers/me/booking-page/unpublish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(again.status, 200);
    assert.equal(bookingPageOf(again.body)["published"], false);

    // Republish restores the exact same canonical URL.
    const on = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(on.status, 200);
    assert.equal(bookingPageOf(on.body)["slug"], slug);

    const back = await apiFetch(`/booking-pages/${slug}`);
    assert.equal(back.status, 200);
  });

  it("scopes booking-page state to the owner", async () => {
    const r = await apiFetch("/providers/me/booking-page", { token: twinToken });
    assert.equal(r.status, 200);
    const bp = bookingPageOf(r.body);
    assert.equal(bp["slug"], "sarah-o-neil-page-2", "twin sees only their own slug");
  });
});
