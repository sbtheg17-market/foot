/**
 * Provider route read audit — schema-drift regression guard
 * (docs/provider-route-read-audit.md).
 *
 * PR #69 fixed the provider status hub against Gate-B schema drift. This
 * suite covers the REMAINING provider-owned read paths hardened by the
 * route read audit: the shared getOwnProfile helper (≈30 owner routes),
 * the owner service-area read, the emergency-openings / blocked-ranges
 * owner lists, the dashboard/metrics booking rows (bookings.source), the
 * booking list/detail reads (bookings.source + roadmap-#13 cancellation
 * columns), and the reschedule-requests / rescheduling-history owner reads
 * (loadOwnedBooking + the RESCHEDULE_PROPOSALS_HISTORY_V1 relations). It simulates a deployed database WITHOUT the frozen Gate B
 * artifacts and proves every hardened read returns a truthful degraded
 * state — never a 500, never fabricated data — while authorization,
 * ownership isolation, and privacy redaction stay intact. A first describe
 * proves the migrated (current-schema) path is unchanged.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:route-read-drift
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  availabilityTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "route-read-drift-pass-1";
const suffix = `${process.pid}-${Date.now()}`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody; raw: string }> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((rest.headers as Record<string, string>) ?? {}),
    },
  });
  const raw = await res.text();
  let body: JsonBody;
  try {
    body = JSON.parse(raw) as JsonBody;
  } catch {
    body = { error: raw.slice(0, 200) };
  }
  return { status: res.status, body, raw };
}

async function register(email: string, role: "provider" | "client") {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Route",
      lastName: "Audit",
      email,
      password: PASSWORD,
      roleIntent: role,
      role,
    }),
  });
  assert.equal(r.status, 201, r.raw.slice(0, 300));
  return {
    token: r.body["token"] as string,
    userId: ((r.body["user"] as JsonBody)["id"]) as number,
  };
}

async function login(email: string) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200, r.raw.slice(0, 300));
  return r.body["token"] as string;
}

/** Approve the provider directly in the database (no self-serve approval). */
async function approveProvider(userId: number): Promise<number> {
  const [profile] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(profile, "provider profile missing");
  await db
    .update(providerProfilesTable)
    .set({ verificationStatus: "approved", title: "Mobile care", city: "Toronto" })
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

async function createService(providerId: number): Promise<number> {
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

/** No raw SQL, pg error codes, or query internals in any client response. */
function assertNoInternalsLeak(raw: string) {
  for (const marker of [
    "42703",
    "42P01",
    "does not exist",
    "Failed query",
    "select \"",
    "DrizzleQueryError",
    "reviewerNotes",
    "reason_snapshot",
  ]) {
    assert.ok(
      !raw.includes(marker),
      `response must not leak internals (found ${JSON.stringify(marker)}): ${raw.slice(0, 200)}`,
    );
  }
}

/** Same objects the frozen Gate B artifacts add — dropped to simulate drift. */
async function dropGateBRelations() {
  await db.execute(sql`alter table provider_applications drop column if exists rejection_reason`);
  await db.execute(sql`drop index if exists provider_profiles_public_slug_unique_idx`);
  await db.execute(sql`
    alter table provider_profiles
      drop column if exists public_slug,
      drop column if exists booking_page_published,
      drop column if exists booking_page_published_at`);
  await db.execute(sql`drop table if exists provider_coverage_areas`);
  await db.execute(sql`drop table if exists provider_service_areas`);
  await db.execute(sql`drop table if exists provider_emergency_openings`);
  await db.execute(sql`drop table if exists provider_blocked_ranges`);
  await db.execute(sql`drop table if exists booking_outcome_history`);
  await db.execute(sql`drop table if exists booking_reschedule_history`);
  await db.execute(sql`drop table if exists booking_reschedule_proposals`);
  await db.execute(sql`
    alter table bookings
      drop column if exists source,
      drop column if exists cancellation_category,
      drop column if exists no_show_marked_by,
      drop column if exists no_show_marked_at`);
}

/** Restore schema parity (same DDL as the frozen artifacts). */
async function restoreGateBRelations() {
  await db.execute(sql`alter table provider_applications add column if not exists rejection_reason text`);
  await db.execute(sql`alter table provider_profiles add column if not exists public_slug text`);
  await db.execute(
    sql`alter table provider_profiles add column if not exists booking_page_published boolean default false not null`,
  );
  await db.execute(
    sql`alter table provider_profiles add column if not exists booking_page_published_at timestamp`,
  );
  await db.execute(
    sql`create unique index if not exists provider_profiles_public_slug_unique_idx on provider_profiles (public_slug)`,
  );
  await db.execute(sql`
    create table if not exists provider_service_areas (
      id serial primary key,
      provider_id integer not null unique
        references provider_profiles(id) on delete cascade,
      country_code text default 'CA' not null,
      province_code text default '' not null,
      city text,
      public_description text,
      is_active boolean default true not null,
      created_at timestamp default now() not null,
      updated_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create table if not exists provider_coverage_areas (
      id serial primary key,
      provider_id integer not null
        references provider_profiles(id) on delete cascade,
      country_code text default 'CA' not null,
      prefix text not null,
      is_active boolean default true not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create unique index if not exists provider_coverage_areas_active_prefix_unique_idx
      on provider_coverage_areas (provider_id, country_code, prefix)
      where is_active = true`);
  await db.execute(sql`
    create index if not exists provider_coverage_areas_provider_active_idx
      on provider_coverage_areas (provider_id, is_active)`);
  await db.execute(sql`
    create table if not exists provider_emergency_openings (
      id serial primary key,
      provider_id integer not null
        references provider_profiles(id) on delete cascade,
      date text not null,
      start_time text not null,
      end_time text not null,
      service_ids integer[],
      urgent_only boolean default false not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create index if not exists provider_emergency_openings_provider_date_idx
      on provider_emergency_openings (provider_id, date)`);
  await db.execute(sql`
    create table if not exists provider_blocked_ranges (
      id serial primary key,
      provider_id integer not null
        references provider_profiles(id) on delete cascade,
      start_date text not null,
      end_date text not null,
      reason text,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create index if not exists provider_blocked_ranges_provider_end_idx
      on provider_blocked_ranges (provider_id, end_date)`);
  await db.execute(sql`alter table bookings add column if not exists source text`);
  await db.execute(sql`alter table bookings add column if not exists cancellation_category text`);
  await db.execute(
    sql`alter table bookings add column if not exists no_show_marked_by integer references users(id)`,
  );
  await db.execute(sql`alter table bookings add column if not exists no_show_marked_at timestamp`);
  await db.execute(sql`
    create table if not exists booking_outcome_history (
      id serial primary key,
      booking_id integer not null references bookings(id),
      actor_user_id integer not null references users(id),
      actor_role account_role not null,
      action booking_outcome_action not null,
      category text,
      reason_category text,
      reason_snapshot text,
      previous_status booking_status not null,
      new_status booking_status not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create index if not exists booking_outcome_history_booking_created_idx
      on booking_outcome_history (booking_id, created_at)`);
  await db.execute(sql`
    create table if not exists booking_reschedule_proposals (
      id serial primary key,
      booking_id integer not null references bookings(id),
      requester_user_id integer not null references users(id),
      requester_role account_role not null,
      original_scheduled_at timestamp not null,
      proposed_scheduled_at timestamp not null,
      reason text,
      status reschedule_proposal_status default 'pending' not null,
      deadline_at timestamp not null,
      responded_by_user_id integer references users(id),
      resolved_at timestamp,
      idempotency_key text not null,
      version integer default 1 not null,
      notification_outcome reschedule_notification_outcome default 'not_requested' not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create unique index if not exists reschedule_proposals_requester_idempotency_idx
      on booking_reschedule_proposals (requester_user_id, idempotency_key)`);
  await db.execute(sql`
    create unique index if not exists reschedule_proposals_single_pending_idx
      on booking_reschedule_proposals (booking_id) where status = 'pending'`);
  await db.execute(sql`
    create index if not exists reschedule_proposals_booking_created_idx
      on booking_reschedule_proposals (booking_id, created_at desc)`);
  await db.execute(sql`
    create table if not exists booking_reschedule_history (
      id serial primary key,
      booking_id integer not null references bookings(id),
      proposal_id integer references booking_reschedule_proposals(id),
      original_scheduled_at timestamp not null,
      new_scheduled_at timestamp not null,
      requester_user_id integer not null references users(id),
      requester_role account_role not null,
      responded_by_user_id integer references users(id),
      reason text,
      previous_status booking_status not null,
      new_status booking_status not null,
      idempotency_key text,
      notification_outcome reschedule_notification_outcome default 'not_requested' not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create index if not exists reschedule_history_booking_created_idx
      on booking_reschedule_history (booking_id, created_at desc, id desc)`);
}

// ── Shared fixture state (created on the migrated schema, read under drift) ──

const PROVIDER_EMAIL = `route-audit-provider-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `route-audit-client-${suffix}@oncallfoot.test`;
const OTHER_PROVIDER_EMAIL = `route-audit-other-${suffix}@oncallfoot.test`;

let providerToken = "";
let providerUserId = 0;
let providerProfileId = 0;
let clientToken = "";
let serviceId = 0;
let bookingId = 0;

describe("migrated baseline: provider reads and attributed booking (current schema)", () => {
  before(async () => {
    ({ token: providerToken, userId: providerUserId } = await register(PROVIDER_EMAIL, "provider"));
    providerProfileId = await approveProvider(providerUserId);
    serviceId = await createService(providerProfileId);
    ({ token: clientToken } = await register(CLIENT_EMAIL, "client"));

    const scheduledAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    scheduledAt.setUTCHours(15, 0, 0, 0);
    const r = await apiFetch("/bookings", {
      method: "POST",
      token: clientToken,
      body: JSON.stringify({
        providerId: providerProfileId,
        serviceId,
        scheduledAt: scheduledAt.toISOString(),
        address: "12 Test Lane",
        city: "Toronto",
        postalCode: "M5V 2T6",
        source: "instagram",
      }),
    });
    assert.equal(r.status, 201, r.raw.slice(0, 300));
    bookingId = ((r.body["booking"] as JsonBody)["id"]) as number;
  });

  it("provider booking list surfaces the attributed source unchanged", async () => {
    const r = await apiFetch("/bookings", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const bookings = r.body["bookings"] as JsonBody[];
    const own = bookings.find((b) => b["id"] === bookingId);
    assert.ok(own, "provider must see the booking");
    assert.equal(own!["source"], "instagram", "migrated column must pass through");
  });

  it("provider dashboard loads with the attributed source", async () => {
    const r = await apiFetch("/providers/me/dashboard", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
  });
});

describe("provider route reads on a pre-Gate-B database (drift simulation)", () => {
  before(dropGateBRelations);
  after(restoreGateBRelations);

  it("logout → re-login still issues a working session", async () => {
    providerToken = await login(PROVIDER_EMAIL);
    const me = await apiFetch("/auth/me", { token: providerToken });
    assert.equal(me.status, 200, me.raw.slice(0, 300));
  });

  it("GET /providers/me (getOwnProfile route class) returns the profile — not 500", async () => {
    const r = await apiFetch("/providers/me", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const provider = r.body["provider"] as JsonBody;
    assert.equal(provider["title"], "Mobile care");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/me/booking-page degrades to the truthful unpublished state", async () => {
    const r = await apiFetch("/providers/me/booking-page", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const page = r.body["bookingPage"] as JsonBody;
    assert.equal(page["slug"], null);
    assert.equal(page["published"], false, "no fabricated publication");
    assert.equal(page["eligible"], false);
    assert.equal(page["serviceAreaConfigured"], false, "truthful pre-#12 state");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/me/service-area degrades to the truthful unconfigured state", async () => {
    const r = await apiFetch("/providers/me/service-area", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const area = r.body["serviceArea"] as JsonBody;
    assert.equal(area["configured"], false);
    assert.deepEqual(area["prefixes"], []);
    assert.equal(area["publishEligible"], false);
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/me/services and /me/availability still work (stable tables)", async () => {
    const services = await apiFetch("/providers/me/services", { token: providerToken });
    assert.equal(services.status, 200, services.raw.slice(0, 300));
    assert.ok((services.body["services"] as JsonBody[]).length >= 1);
    const availability = await apiFetch("/providers/me/availability", { token: providerToken });
    assert.equal(availability.status, 200, availability.raw.slice(0, 300));
    assert.ok((availability.body["slots"] as JsonBody[]).length >= 1);
  });

  it("GET emergency-openings degrades to an empty list — not 500", async () => {
    const r = await apiFetch("/providers/me/availability/emergency-openings", {
      token: providerToken,
    });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.deepEqual(r.body["openings"], [], "absent relation holds no rows");
    assertNoInternalsLeak(r.raw);
  });

  it("GET blocked-ranges degrades to an empty list — not 500", async () => {
    const r = await apiFetch("/providers/me/availability/blocked-ranges", {
      token: providerToken,
    });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.deepEqual(r.body["ranges"], [], "absent relation holds no rows");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/me/listing-preview loads truthfully under drift", async () => {
    const r = await apiFetch("/providers/me/listing-preview", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.ok(r.body["preview"], "preview payload present");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/me/dashboard and /me/metrics load with source degraded to null", async () => {
    const dashboard = await apiFetch("/providers/me/dashboard", { token: providerToken });
    assert.equal(dashboard.status, 200, dashboard.raw.slice(0, 300));
    assertNoInternalsLeak(dashboard.raw);
    const metrics = await apiFetch("/providers/me/metrics", { token: providerToken });
    assert.equal(metrics.status, 200, metrics.raw.slice(0, 300));
    assert.ok(metrics.body["metrics"], "metrics payload present");
  });

  it("provider booking list degrades additive fields to null — not 500", async () => {
    const r = await apiFetch("/bookings", { token: providerToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const bookings = r.body["bookings"] as JsonBody[];
    const own = bookings.find((b) => b["id"] === bookingId);
    assert.ok(own, "the pre-drift booking must still be listed");
    assert.equal(own!["source"], null, "degraded, never fabricated");
    assert.equal(own!["cancellationCategory"], null);
    assertNoInternalsLeak(r.raw);
  });

  it("GET /bookings/:id and cancellation-preview work under drift", async () => {
    const detail = await apiFetch(`/bookings/${bookingId}`, { token: providerToken });
    assert.equal(detail.status, 200, detail.raw.slice(0, 300));
    assert.equal(((detail.body["booking"] as JsonBody) ?? {})["source"], null);
    const preview = await apiFetch(`/bookings/${bookingId}/cancellation-preview`, {
      token: providerToken,
    });
    assert.equal(preview.status, 200, preview.raw.slice(0, 300));
    assertNoInternalsLeak(preview.raw);
  });

  it("GET /bookings/:id/outcome-history degrades to empty history — not 500", async () => {
    const r = await apiFetch(`/bookings/${bookingId}/outcome-history`, {
      token: providerToken,
    });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.deepEqual(r.body["history"], [], "absent relation holds no rows");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /bookings/:id/reschedule-requests degrades to an empty list — not 500", async () => {
    const r = await apiFetch(`/bookings/${bookingId}/reschedule-requests`, {
      token: providerToken,
    });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.deepEqual(r.body["proposals"], [], "absent relation holds no rows");
    assertNoInternalsLeak(r.raw);
  });

  it("GET /bookings/:id/rescheduling-history degrades to empty history — not 500", async () => {
    const r = await apiFetch(`/bookings/${bookingId}/rescheduling-history`, {
      token: providerToken,
    });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.deepEqual(r.body["history"], [], "absent relation holds no rows");
    assertNoInternalsLeak(r.raw);
  });

  it("client booking list stays client-safe under drift (no internal actor fields)", async () => {
    clientToken = await login(CLIENT_EMAIL);
    const r = await apiFetch("/bookings", { token: clientToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const bookings = r.body["bookings"] as JsonBody[];
    const own = bookings.find((b) => b["id"] === bookingId);
    assert.ok(own, "client must see their booking");
    assert.ok(!("noShowMarkedBy" in own!), "client-safe projection must hold");
    assert.ok(!("careNotes" in own!), "client-safe projection must hold");
  });

  it("wrong-role and unauthenticated access stay denied (never masked)", async () => {
    const asClient = await apiFetch("/providers/me", { token: clientToken });
    assert.equal(asClient.status, 403);
    const unauth = await apiFetch("/providers/me");
    assert.equal(unauth.status, 401);
    const unauthBookings = await apiFetch("/bookings");
    assert.equal(unauthBookings.status, 401);
  });

  it("cross-provider isolation holds under drift", async () => {
    const { userId: otherUserId } = await register(OTHER_PROVIDER_EMAIL, "provider");
    await approveProvider(otherUserId);
    const otherToken = await login(OTHER_PROVIDER_EMAIL);
    const foreign = await apiFetch(`/bookings/${bookingId}`, { token: otherToken });
    assert.equal(foreign.status, 403, foreign.raw.slice(0, 300));
    const foreignReschedules = await apiFetch(`/bookings/${bookingId}/reschedule-requests`, {
      token: otherToken,
    });
    assert.equal(foreignReschedules.status, 404, "reschedule reads stay non-leaking under drift");
    const list = await apiFetch("/bookings", { token: otherToken });
    assert.equal(list.status, 200, list.raw.slice(0, 300));
    assert.ok(
      !(list.body["bookings"] as JsonBody[]).some((b) => b["id"] === bookingId),
      "another provider must never see a foreign booking",
    );
  });
});
