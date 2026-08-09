/**
 * Provider Activation & First Booking Conversion — Phase 2 readiness view.
 *
 * Focused integration coverage for GET /providers/me/readiness.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-readiness
 *
 * Covers (all against live HTTP + direct DB fixture writes):
 *   - 401 unauthenticated; 403 without provider membership
 *   - unapproved providers CAN read their own readiness (no
 *     approved-provider gate on this endpoint)
 *   - C1–C7 computed live from raw source fields on every request
 *   - C2 is ONLY non-empty title, city, and bio; whitespace-only fails;
 *     the stored profileComplete flag is never trusted in either direction
 *   - C3 counts only ACTIVE services
 *   - C4 availability slot / C5 travel zone flip their criteria
 *   - C6 follows acceptsNewClients
 *   - C7 stays auto-satisfied while no document type is mandated (even
 *     with a pending verification document on file)
 *   - `missing` reason codes appear in deterministic C1→C7 order
 *   - `activated` is the logical AND of C1–C7
 *   - owner scoping: each provider sees only their own readiness
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  travelZonesTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "phase2-readiness-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `readiness-provider-${suffix}@oncallfoot.test`;
const OTHER_PROVIDER_EMAIL = `readiness-other-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `readiness-client-${suffix}@oncallfoot.test`;

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
      firstName: "Readiness",
      lastName: "Phase2",
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

async function getReadiness(token?: string) {
  return apiFetch("/providers/me/readiness", { token });
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

describe("GET /providers/me/readiness (Phase 2 readiness view)", () => {
  let providerToken = "";
  let providerUserId = 0;
  let providerProfileId = 0;
  let otherToken = "";
  let otherUserId = 0;
  let otherProfileId = 0;
  let clientToken = "";
  let clientUserId = 0;

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
    otherProfileId = await profileFor(otherUserId);

    const client = await register(CLIENT_EMAIL, "client");
    clientToken = client.token;
    clientUserId = client.userId;
  });

  after(async () => {
    // User cascade deletes clean up profiles, applications, services,
    // availability, travel zones, and verification docs.
    for (const userId of [providerUserId, otherUserId, clientUserId]) {
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it("returns 401 when unauthenticated", async () => {
    const r = await getReadiness();
    assert.equal(r.status, 401);
  });

  it("returns 403 for an authenticated user without provider membership", async () => {
    const r = await getReadiness(clientToken);
    assert.equal(r.status, 403);
  });

  it("lets an unapproved provider read their own readiness with the full ordered missing list", async () => {
    // Fresh registration: draft application, empty title/city, null bio,
    // no service/availability/travel zone, acceptsNewClients defaults true.
    const r = await getReadiness(providerToken);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const readiness = readinessOf(r.body);

    assert.equal(readiness.activated, false);
    // Deterministic C1→C7 order.
    assert.deepEqual(readiness.missing, [
      "NOT_APPROVED",
      "PROFILE_INCOMPLETE",
      "NO_ACTIVE_SERVICE",
      "NO_AVAILABILITY",
      "NO_SERVICE_AREA",
    ]);
    assert.deepEqual(readiness.criteria, {
      approved: false,
      profileComplete: false,
      activeService: false,
      availability: false,
      serviceArea: false,
      acceptingClients: true, // default true
      documents: true, // C7 auto-satisfied: no mandated document exists
    });
  });

  it("never trusts the stored profileComplete flag (stale true)", async () => {
    // Force the roll-up flag true while the raw fields are still empty.
    await db
      .update(providerProfilesTable)
      .set({ profileComplete: true })
      .where(eq(providerProfilesTable.id, providerProfileId));

    const r = await getReadiness(providerToken);
    assert.equal(r.status, 200);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["profileComplete"], false);
    assert.ok(readiness.missing.includes("PROFILE_INCOMPLETE"));
  });

  it("treats whitespace-only and partial profile fields as incomplete (C2 strictness)", async () => {
    // title + city set, bio whitespace-only → still incomplete.
    await db
      .update(providerProfilesTable)
      .set({ title: "Mobile foot-care specialist", city: "Toronto", bio: "   " })
      .where(eq(providerProfilesTable.id, providerProfileId));

    let r = await getReadiness(providerToken);
    assert.equal(r.status, 200);
    assert.equal(readinessOf(r.body).criteria["profileComplete"], false);
    assert.ok(readinessOf(r.body).missing.includes("PROFILE_INCOMPLETE"));

    // bio set, city cleared → still incomplete.
    await db
      .update(providerProfilesTable)
      .set({ city: "", bio: "Calm, client-first in-home foot care." })
      .where(eq(providerProfilesTable.id, providerProfileId));

    r = await getReadiness(providerToken);
    assert.equal(readinessOf(r.body).criteria["profileComplete"], false);
  });

  it("computes C2 live from raw fields even when profileComplete is stale false", async () => {
    // All three raw fields non-empty, roll-up flag forced false.
    await db
      .update(providerProfilesTable)
      .set({
        title: "Mobile foot-care specialist",
        city: "Toronto",
        bio: "Calm, client-first in-home foot care.",
        profileComplete: false,
      })
      .where(eq(providerProfilesTable.id, providerProfileId));

    const r = await getReadiness(providerToken);
    assert.equal(r.status, 200);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["profileComplete"], true);
    assert.equal(readiness.missing.includes("PROFILE_INCOMPLETE"), false);
  });

  it("counts only ACTIVE services for C3", async () => {
    const [inactive] = await db
      .insert(servicesTable)
      .values({
        providerId: providerProfileId,
        title: "Inactive visit",
        durationMinutes: 60,
        priceCents: 12000,
        category: "foot_care",
        isActive: false,
      })
      .returning({ id: servicesTable.id });
    assert.ok(inactive);

    let r = await getReadiness(providerToken);
    assert.equal(readinessOf(r.body).criteria["activeService"], false);
    assert.ok(readinessOf(r.body).missing.includes("NO_ACTIVE_SERVICE"));

    await db
      .update(servicesTable)
      .set({ isActive: true })
      .where(eq(servicesTable.id, inactive.id));

    r = await getReadiness(providerToken);
    assert.equal(readinessOf(r.body).criteria["activeService"], true);
    assert.equal(readinessOf(r.body).missing.includes("NO_ACTIVE_SERVICE"), false);
  });

  it("flips C4 with an availability slot and C5 with a travel zone", async () => {
    await db.insert(availabilityTable).values({
      providerId: providerProfileId,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
    });

    let r = await getReadiness(providerToken);
    let readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["availability"], true);
    assert.equal(readiness.criteria["serviceArea"], false);
    assert.ok(readiness.missing.includes("NO_SERVICE_AREA"));

    await db.insert(travelZonesTable).values({
      providerId: providerProfileId,
      zoneName: "Downtown core",
      city: "Toronto",
    });

    r = await getReadiness(providerToken);
    readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["serviceArea"], true);
    assert.equal(readiness.missing.includes("NO_SERVICE_AREA"), false);
  });

  it("keeps C7 auto-satisfied when no mandated document exists, even with a pending doc on file", async () => {
    await db.insert(verificationDocsTable).values({
      providerId: providerProfileId,
      docType: "license",
      fileName: `readiness-license-${suffix}.pdf`,
      // status defaults to "pending"
    });

    const r = await getReadiness(providerToken);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["documents"], true);
    assert.equal(readiness.missing.includes("DOCS_PENDING"), false);
  });

  it("reports NOT_ACCEPTING_CLIENTS for C6 in deterministic position", async () => {
    await db
      .update(providerProfilesTable)
      .set({ acceptsNewClients: false })
      .where(eq(providerProfilesTable.id, providerProfileId));

    const r = await getReadiness(providerToken);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["acceptingClients"], false);
    // Everything except C1 (approval) and C6 is now satisfied — order holds.
    assert.deepEqual(readiness.missing, [
      "NOT_APPROVED",
      "NOT_ACCEPTING_CLIENTS",
    ]);
    assert.equal(readiness.activated, false);

    await db
      .update(providerProfilesTable)
      .set({ acceptsNewClients: true })
      .where(eq(providerProfilesTable.id, providerProfileId));
  });

  it("requires BOTH application and verification approval for C1", async () => {
    // Application approved but verification still pending → NOT_APPROVED.
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", currentStep: "submitted" })
      .where(eq(providerApplicationsTable.userId, providerUserId));

    let r = await getReadiness(providerToken);
    let readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["approved"], false);
    assert.deepEqual(readiness.missing, ["NOT_APPROVED"]);
    assert.equal(readiness.activated, false);

    // Verification approved too → C1 satisfied and fully activated.
    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "approved" })
      .where(eq(providerProfilesTable.id, providerProfileId));

    r = await getReadiness(providerToken);
    readiness = readinessOf(r.body);
    assert.equal(readiness.criteria["approved"], true);
    assert.deepEqual(readiness.missing, []);
    assert.equal(readiness.activated, true);
  });

  it("computes activated as the AND of C1–C7 (single unmet criterion deactivates)", async () => {
    await db
      .update(providerProfilesTable)
      .set({ acceptsNewClients: false })
      .where(eq(providerProfilesTable.id, providerProfileId));

    const r = await getReadiness(providerToken);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.activated, false);
    assert.deepEqual(readiness.missing, ["NOT_ACCEPTING_CLIENTS"]);

    await db
      .update(providerProfilesTable)
      .set({ acceptsNewClients: true })
      .where(eq(providerProfilesTable.id, providerProfileId));
  });

  it("is owner-scoped: another provider still sees their own untouched readiness", async () => {
    // The second provider never progressed; the first provider's fully
    // activated state must not leak into this response.
    const r = await getReadiness(otherToken);
    assert.equal(r.status, 200);
    const readiness = readinessOf(r.body);
    assert.equal(readiness.activated, false);
    assert.deepEqual(readiness.missing, [
      "NOT_APPROVED",
      "PROFILE_INCOMPLETE",
      "NO_ACTIVE_SERVICE",
      "NO_AVAILABILITY",
      "NO_SERVICE_AREA",
    ]);
    assert.equal(otherProfileId === providerProfileId, false);
  });

  it("reflects live changes immediately (no persisted activation state)", async () => {
    // Deactivate by clearing the bio — readiness recomputes on the next read.
    await db
      .update(providerProfilesTable)
      .set({ bio: "" })
      .where(eq(providerProfilesTable.id, providerProfileId));

    let r = await getReadiness(providerToken);
    assert.deepEqual(readinessOf(r.body).missing, ["PROFILE_INCOMPLETE"]);
    assert.equal(readinessOf(r.body).activated, false);

    await db
      .update(providerProfilesTable)
      .set({ bio: "Calm, client-first in-home foot care." })
      .where(eq(providerProfilesTable.id, providerProfileId));

    r = await getReadiness(providerToken);
    assert.deepEqual(readinessOf(r.body).missing, []);
    assert.equal(readinessOf(r.body).activated, true);
  });
});
