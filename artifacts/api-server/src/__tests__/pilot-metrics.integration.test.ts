/**
 * Pilot Operations Dashboard — metrics + retention API (Part 1) integration.
 *
 * Covers: admin-only authorization (401/403 for unauthenticated, client,
 * provider on both routes), activation milestones and status progression,
 * first-booking/active signals, zero-data null rates, completion/
 * cancellation/no-show calculations, repeat-client rate, source grouping
 * (incl. unknown), support-escalation count, retention create/update/upsert +
 * validation + audit (updated_by), and privacy redaction (no client identity,
 * addresses, document references, or reviewer notes in the payload).
 *
 * Prerequisites: API server running against the test database (seeded CI DB
 * is fine — assertions on global summary values use >= and provider-level
 * assertions are scoped to providers created by this suite).
 *
 * Run: pnpm --filter @workspace/api-server run test:pilot-metrics
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  db,
  accountRolesTable,
  availabilityTable,
  bookingsTable,
  pilotProviderRetentionTable,
  providerApplicationsTable,
  providerCoverageAreasTable,
  providerProfilesTable,
  providerServiceAreasTable,
  servicesTable,
  supportTicketsTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "pilot-metrics-pass-1";
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
    },
  });
  const raw = await res.text();
  let body: JsonBody;
  try {
    body = JSON.parse(raw) as JsonBody;
  } catch {
    body = {};
  }
  return { status: res.status, body, raw };
}

let counter = 0;
async function register(role: "provider" | "client") {
  counter += 1;
  const email = `pilot-${role}-${suffix}-${counter}@example.test`;
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Pilot",
      lastName: `${role}${counter}`,
      email,
      password: PASSWORD,
      roleIntent: role,
      role,
    }),
  });
  assert.equal(r.status, 201, r.raw.slice(0, 200));
  const user = r.body["user"] as JsonBody;
  return { token: r.body["token"] as string, userId: user["id"] as number, email };
}

async function login(email: string): Promise<string> {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200);
  return r.body["token"] as string;
}

/** Promote a registered user to admin via the DB, then re-login. */
async function makeAdmin() {
  const { userId, email } = await register("client");
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, userId));
  await db
    .insert(accountRolesTable)
    .values({ userId, role: "admin" })
    .onConflictDoNothing();
  return { token: await login(email), userId };
}

async function profileIdFor(userId: number): Promise<number> {
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(row, "provider profile must exist");
  return row!.id;
}

// ── milestone builders (DB-level; the flows they mirror have their own suites) ──

async function completeProfile(profileId: number) {
  await db
    .update(providerProfilesTable)
    .set({ title: "Mobile care specialist", bio: "Pilot test bio", city: "St. Catharines" })
    .where(eq(providerProfilesTable.id, profileId));
}

async function submitVerification(profileId: number) {
  await db.insert(verificationDocsTable).values({
    providerId: profileId,
    docType: "license",
    fileName: `PILOT-DOC-REF-${suffix}-${profileId}`,
    status: "pending",
  });
}

async function approve(profileId: number) {
  await db
    .update(providerApplicationsTable)
    .set({ status: "approved" })
    .where(eq(providerApplicationsTable.providerProfileId, profileId));
  await db
    .update(providerProfilesTable)
    .set({ verificationStatus: "approved" })
    .where(eq(providerProfilesTable.id, profileId));
}

async function configureServiceArea(profileId: number) {
  await db.insert(providerServiceAreasTable).values({
    providerId: profileId,
    provinceCode: "ON",
    city: "St. Catharines",
    isActive: true,
  });
  await db.insert(providerCoverageAreasTable).values({
    providerId: profileId,
    prefix: "L2R",
    isActive: true,
  });
}

async function addService(profileId: number): Promise<number> {
  const [row] = await db
    .insert(servicesTable)
    .values({
      providerId: profileId,
      title: "Standard visit",
      durationMinutes: 60,
      priceCents: 8000,
    })
    .returning({ id: servicesTable.id });
  return row!.id;
}

async function addAvailability(profileId: number) {
  await db.insert(availabilityTable).values({
    providerId: profileId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
  });
}

async function publish(profileId: number) {
  await db
    .update(providerProfilesTable)
    .set({ bookingPagePublished: true, publicSlug: `pilot-test-${suffix}-${profileId}` })
    .where(eq(providerProfilesTable.id, profileId));
}

const TEST_ADDRESS = `99 Pilot Redaction Street ${suffix}`;

async function addBooking(
  profileId: number,
  serviceId: number,
  clientId: number,
  opts: { status?: string; source?: string | null } = {},
) {
  await db.execute(sql`
    insert into bookings (client_id, provider_id, service_id, status, scheduled_at, address, city, source)
    values (${clientId}, ${profileId}, ${serviceId}, ${opts.status ?? "requested"},
            ${new Date()}, ${TEST_ADDRESS}, ${"St. Catharines"}, ${opts.source ?? null})`);
}

function providerRow(metrics: JsonBody, profileId: number): JsonBody {
  const providers = metrics["providers"] as JsonBody[];
  const row = providers.find((p) => p["providerId"] === String(profileId));
  assert.ok(row, `provider ${profileId} must appear in the metrics payload`);
  return row!;
}

let adminToken = "";
let adminUserId = 0;

before(async () => {
  const admin = await makeAdmin();
  adminToken = admin.token;
  adminUserId = admin.userId;
});

async function getMetrics(): Promise<{ body: JsonBody; raw: string }> {
  const r = await apiFetch("/admin/pilot/metrics", { token: adminToken });
  assert.equal(r.status, 200, r.raw.slice(0, 200));
  return { body: r.body, raw: r.raw };
}

describe("authorization", () => {
  it("denies unauthenticated, client, and provider on both routes; allows admin", async () => {
    const provider = await register("provider");
    const client = await register("client");
    const profileId = await profileIdFor(provider.userId);

    assert.equal((await apiFetch("/admin/pilot/metrics")).status, 401);
    assert.equal((await apiFetch("/admin/pilot/metrics", { token: client.token })).status, 403);
    assert.equal((await apiFetch("/admin/pilot/metrics", { token: provider.token })).status, 403);

    const patchBody = { method: "PATCH" as const, body: JSON.stringify({ retentionIntent: "yes" }) };
    assert.equal((await apiFetch(`/admin/pilot/providers/${profileId}/retention`, patchBody)).status, 401);
    assert.equal((await apiFetch(`/admin/pilot/providers/${profileId}/retention`, { ...patchBody, token: client.token })).status, 403);
    assert.equal((await apiFetch(`/admin/pilot/providers/${profileId}/retention`, { ...patchBody, token: provider.token })).status, 403);

    const admin = await apiFetch("/admin/pilot/metrics", { token: adminToken });
    assert.equal(admin.status, 200);
  });
});

describe("pilot window and payload shape", () => {
  it("returns a complete contract with a projected window when env dates are not configured", async () => {
    const { body } = await getMetrics();
    const pilot = body["pilot"] as JsonBody;
    assert.match(pilot["startDate"] as string, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(pilot["endDate"] as string, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof pilot["isProjected"], "boolean");
    assert.equal(pilot["isProjected"], true, "test env has no PILOT_* dates configured");
    assert.ok((pilot["providerTarget"] as number) > 0);
    assert.ok(pilot["generatedAt"]);
    for (const key of ["summary", "providers", "sourceAttribution"]) {
      assert.ok(key in body, `payload must include ${key}`);
    }
  });
});

describe("activation milestones and status", () => {
  it("progresses not_started/in_progress → ready_to_publish → published with truthful milestones", async () => {
    const provider = await register("provider");
    const profileId = await profileIdFor(provider.userId);

    let row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["activationStatus"], "not_started", "registration alone is not activation");
    let m = row["onboardingMilestones"] as JsonBody;
    assert.equal(m["accountCreated"], true);
    assert.equal(m["profileCompleted"], false);
    assert.equal(row["bookings"], 0);
    assert.equal(row["completionRate"], null, "zero-data rate must be null, not 0");
    assert.equal(row["repeatClientRate"], null);
    assert.equal(row["retentionIntent"], "unknown");
    assert.ok((row["riskFlags"] as string[]).includes("not_activated"));

    await completeProfile(profileId);
    await submitVerification(profileId);
    row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["activationStatus"], "in_progress");
    m = row["onboardingMilestones"] as JsonBody;
    assert.equal(m["profileCompleted"], true);
    assert.equal(m["verificationSubmitted"], true);
    assert.equal(m["approved"], false);

    await approve(profileId);
    await configureServiceArea(profileId);
    await addService(profileId);
    await addAvailability(profileId);
    row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["activationStatus"], "ready_to_publish");
    assert.ok((row["riskFlags"] as string[]).includes("not_published"));
    m = row["onboardingMilestones"] as JsonBody;
    for (const k of ["approved", "serviceAreaConfigured", "serviceConfigured", "availabilityConfigured"]) {
      assert.equal(m[k], true, k);
    }
    assert.equal(m["bookingPagePublished"], false);

    await publish(profileId);
    row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["activationStatus"], "published");
    assert.equal(row["bookingPagePublished"], true);
    assert.ok((row["riskFlags"] as string[]).includes("no_booking_yet"));
    assert.ok(!(row["riskFlags"] as string[]).includes("not_activated"));
  });

  it("tracks first booking and active status separately from activation", async () => {
    const provider = await register("provider");
    const client = await register("client");
    const profileId = await profileIdFor(provider.userId);
    await completeProfile(profileId);
    await submitVerification(profileId);
    await approve(profileId);
    await configureServiceArea(profileId);
    const serviceId = await addService(profileId);
    await addAvailability(profileId);
    await publish(profileId);

    await addBooking(profileId, serviceId, client.userId, { status: "requested", source: "qr-card" });
    const row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["activationStatus"], "active", "booking activity in window + published = active");
    assert.ok(row["firstBookingAt"], "firstBookingAt must be set");
    const m = row["onboardingMilestones"] as JsonBody;
    assert.equal(m["firstBookingReceived"], true);
    assert.equal(row["bookings"], 1);
    assert.equal(row["attributedBookings"], 1);
    assert.ok(!(row["riskFlags"] as string[]).includes("no_booking_yet"));
  });
});

describe("outcome, repeat-client, and source calculations", () => {
  it("computes completion/cancellation/no-show rates over resolved bookings and repeat-client rate over unique clients", async () => {
    const provider = await register("provider");
    const clientA = await register("client");
    const clientB = await register("client");
    const clientC = await register("client");
    const clientD = await register("client");
    const profileId = await profileIdFor(provider.userId);
    const serviceId = await addService(profileId);

    // clientA: 2 completed (repeat); B: 1 cancelled; C: 1 no_show; D: 1 pending
    await addBooking(profileId, serviceId, clientA.userId, { status: "completed", source: "qr-card" });
    await addBooking(profileId, serviceId, clientA.userId, { status: "completed", source: "qr-card" });
    await addBooking(profileId, serviceId, clientB.userId, { status: "cancelled", source: "referral" });
    await addBooking(profileId, serviceId, clientC.userId, { status: "no_show" });
    await addBooking(profileId, serviceId, clientD.userId, { status: "requested" });

    const { body } = await getMetrics();
    const row = providerRow(body, profileId);
    assert.equal(row["bookings"], 5);
    assert.equal(row["completions"], 2);
    assert.equal(row["cancellations"], 1);
    assert.equal(row["noShows"], 1);
    assert.equal(row["completionRate"], 0.5); // 2 of 4 resolved
    assert.equal(row["cancellationRate"], 0.25);
    assert.equal(row["noShowRate"], 0.25);
    assert.equal(row["repeatClientRate"], 0.25); // clientA repeat of 4 unique
    assert.equal(row["attributedBookings"], 3);
    const flags = row["riskFlags"] as string[];
    assert.ok(flags.includes("high_cancellation_rate"), "0.25 > 0.20 guardrail");
    assert.ok(flags.includes("high_no_show_rate"), "0.25 > 0.10 guardrail");

    // Source grouping: null/empty grouped as unknown; percentages defined.
    const sources = body["sourceAttribution"] as JsonBody[];
    const bySource = new Map(sources.map((s) => [s["source"], s]));
    assert.ok((bySource.get("qr-card")?.["bookings"] as number) >= 2);
    assert.ok((bySource.get("unknown")?.["bookings"] as number) >= 2, "null sources group as unknown");
    for (const s of sources) {
      assert.notEqual(s["percentage"], undefined);
      assert.ok(!(s["source"] as string).includes("?"), "no raw query strings as sources");
    }

    // Summary aggregates are global (seeded DB): assert directional floors.
    const summary = body["summary"] as JsonBody;
    assert.ok((summary["totalBookings"] as number) >= 5);
    assert.ok((summary["completedBookings"] as number) >= 2);
    assert.ok((summary["approvedProviders"] as number) >= 1);
  });

  it("counts booking-linked support tickets as escalations", async () => {
    const provider = await register("provider");
    const client = await register("client");
    const profileId = await profileIdFor(provider.userId);
    const serviceId = await addService(profileId);
    await addBooking(profileId, serviceId, client.userId, { status: "cancelled" });
    const [booking] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(eq(bookingsTable.providerId, profileId))
      .limit(1);
    await db.insert(supportTicketsTable).values({
      userId: client.userId,
      subject: "Pilot escalation subject",
      bookingId: booking!.id,
    });
    const { body } = await getMetrics();
    assert.ok(((body["summary"] as JsonBody)["supportEscalations"] as number) >= 1);
  });
});

describe("retention intent", () => {
  it("creates, updates (upsert, one row), audits updated_by, and validates input", async () => {
    const provider = await register("provider");
    const profileId = await profileIdFor(provider.userId);

    const created = await apiFetch(`/admin/pilot/providers/${profileId}/retention`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ retentionIntent: "yes" }),
    });
    assert.equal(created.status, 200, created.raw.slice(0, 200));
    assert.equal((created.body["retention"] as JsonBody)["retentionIntent"], "yes");

    let row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["retentionIntent"], "yes");
    assert.ok(row["retentionUpdatedAt"]);

    const updated = await apiFetch(`/admin/pilot/providers/${profileId}/retention`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ retentionIntent: "no" }),
    });
    assert.equal(updated.status, 200);

    const stored = await db
      .select()
      .from(pilotProviderRetentionTable)
      .where(eq(pilotProviderRetentionTable.providerId, profileId));
    assert.equal(stored.length, 1, "upsert keeps one row per provider");
    assert.equal(stored[0]!.retentionIntent, "no");
    assert.equal(stored[0]!.updatedBy, adminUserId, "admin actor audited");

    row = providerRow((await getMetrics()).body, profileId);
    assert.equal(row["retentionIntent"], "no");
    assert.ok((row["riskFlags"] as string[]).includes("retention_risk"));

    for (const bad of ["maybe", "", 1, null]) {
      const r = await apiFetch(`/admin/pilot/providers/${profileId}/retention`, {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ retentionIntent: bad }),
      });
      assert.equal(r.status, 400, `invalid retention value ${JSON.stringify(bad)}`);
    }
    assert.equal(
      (await apiFetch(`/admin/pilot/providers/not-a-number/retention`, {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ retentionIntent: "yes" }),
      })).status,
      400,
    );
    assert.equal(
      (await apiFetch(`/admin/pilot/providers/99999999/retention`, {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ retentionIntent: "yes" }),
      })).status,
      404,
    );
  });
});

describe("privacy redaction", () => {
  it("never exposes client identity, addresses, document references, or notes", async () => {
    const { raw } = await getMetrics();
    assert.ok(!raw.includes(TEST_ADDRESS), "no booking addresses");
    assert.ok(!raw.includes(`PILOT-DOC-REF-${suffix}`), "no document references");
    assert.ok(!raw.includes(`pilot-client-${suffix}`), "no client emails");
    assert.ok(!raw.includes("Pilot escalation subject"), "no support subjects/notes");
    for (const forbiddenKey of ['"clientId"', '"email"', '"address"', '"postalCode"', '"reviewerNotes"', '"careNotes"', '"token"']) {
      assert.ok(!raw.includes(forbiddenKey), `payload must not contain ${forbiddenKey}`);
    }
  });
});
