/**
 * Provider Activation & First Booking Conversion — Phase 3 (event emission).
 *
 * Focused integration coverage for activation-funnel marketplace events.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:marketplace-events
 *
 * Covers the approved eight-case plan (live HTTP + direct DB assertions):
 *   1. approval decision emits provider_approved; completing the last
 *      criterion emits provider_activated in the same transaction
 *   2. filling the last missing criterion flips exactly once; repeating the
 *      same write emits nothing (idempotency)
 *   3. deactivation on representative criterion losses emits
 *      provider_deactivated with the correct FIRST-missing reason_code in
 *      deterministic C1→C7 order
 *   4. milestones are once-ever (no duplicates through churn)
 *   5. rejected / revoked providers: rejection of a never-activated provider
 *      emits no transition; verification revocation of an activated provider
 *      deactivates with NOT_APPROVED
 *   6. atomicity: a rolled-back transaction leaves neither mutation nor event
 *   7. privacy: metadata carries only criteria booleans / missing codes —
 *      never raw field values or PII
 *   8. the readiness GET endpoint emits nothing
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db,
  marketplaceEventsTable,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
  verificationDocsTable,
  accountRolesTable,
} from "@workspace/db";
import { emitProviderActivationEvents } from "../lib/marketplace-events.js";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "phase3-events-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `events-provider-${suffix}@oncallfoot.test`;
const REJECTED_EMAIL = `events-rejected-${suffix}@oncallfoot.test`;
const ADMIN_EMAIL = `events-admin-${suffix}@oncallfoot.test`;

const BIO_TEXT = `Calm, client-first in-home foot care ${suffix}`;
const TITLE_TEXT = `Mobile foot-care specialist ${suffix}`;
const CITY_TEXT = "Toronto";

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
      firstName: "Phase3",
      lastName: "Events",
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

async function login(email: string) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200, `login failed: ${JSON.stringify(r.body)}`);
  return r.body["token"] as string;
}

async function promoteToAdmin(userId: number, email: string) {
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, userId));
  await db
    .insert(accountRolesTable)
    .values({ userId, role: "admin" })
    .onConflictDoNothing();
  return login(email);
}

async function appFor(userId: number) {
  const [row] = await db
    .select({
      id: providerApplicationsTable.id,
      profileId: providerApplicationsTable.providerProfileId,
    })
    .from(providerApplicationsTable)
    .where(eq(providerApplicationsTable.userId, userId))
    .limit(1);
  assert.ok(row, "application row must exist after registration");
  return row;
}

async function eventCount(profileId: number, eventType?: string) {
  const rows = await db
    .select({ id: marketplaceEventsTable.id })
    .from(marketplaceEventsTable)
    .where(
      eventType
        ? and(
            eq(marketplaceEventsTable.providerProfileId, profileId),
            eq(
              marketplaceEventsTable.eventType,
              eventType as typeof marketplaceEventsTable.$inferSelect.eventType,
            ),
          )
        : eq(marketplaceEventsTable.providerProfileId, profileId),
    );
  return rows.length;
}

async function lastEvent(profileId: number) {
  const rows = await db
    .select()
    .from(marketplaceEventsTable)
    .where(eq(marketplaceEventsTable.providerProfileId, profileId))
    .orderBy(marketplaceEventsTable.id);
  return rows[rows.length - 1] ?? null;
}

describe("Phase 3 — activation-funnel marketplace event emission", () => {
  let providerToken = "";
  let providerUserId = 0;
  let applicationId = 0;
  let profileId = 0;
  let serviceId = 0;
  let adminToken = "";
  let adminUserId = 0;
  let rejectedUserId = 0;
  let rejectedProfileId = 0;
  let docId = 0;

  before(async () => {
    const health = await apiFetch("/healthz");
    assert.equal(health.status, 200, "API server must be running");

    const provider = await register(PROVIDER_EMAIL, "provider");
    providerToken = provider.token;
    providerUserId = provider.userId;
    const app = await appFor(providerUserId);
    applicationId = app.id;
    profileId = app.profileId;

    const admin = await register(ADMIN_EMAIL, "client");
    adminUserId = admin.userId;
    adminToken = await promoteToAdmin(adminUserId, ADMIN_EMAIL);
  });

  after(async () => {
    for (const userId of [providerUserId, rejectedUserId, adminUserId]) {
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it("emits once-ever funnel milestones during onboarding, with no transition events", async () => {
    // Profile fields (C2) → profile_completed.
    let r = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ title: TITLE_TEXT, bio: BIO_TEXT, city: CITY_TEXT }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await eventCount(profileId, "profile_completed"), 1);

    // Repeating the same profile write emits nothing new.
    r = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerToken,
      body: JSON.stringify({ title: TITLE_TEXT, bio: BIO_TEXT, city: CITY_TEXT }),
    });
    assert.equal(r.status, 200);
    assert.equal(await eventCount(profileId, "profile_completed"), 1);

    // First service (C3) → first_service_published with service_id.
    r = await apiFetch("/providers/application/services", {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({
        title: "In-home foot care visit",
        durationMinutes: 60,
        priceCents: 12000,
      }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    serviceId = (r.body["service"] as JsonBody)["id"] as number;
    assert.equal(await eventCount(profileId, "first_service_published"), 1);

    // Availability (C4) → availability_set.
    r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({
        slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await eventCount(profileId, "availability_set"), 1);

    // Unapproved (C1 false) → no transition events yet.
    assert.equal(await eventCount(profileId, "provider_activated"), 0);
    assert.equal(await eventCount(profileId, "provider_deactivated"), 0);
  });

  it("emits provider_approved on the reviewer approval decision (no activation yet)", async () => {
    // Verification doc needed by the submission gate.
    const [doc] = await db
      .insert(verificationDocsTable)
      .values({
        providerId: profileId,
        docType: "license",
        fileName: `phase3-license-${suffix}.pdf`,
      })
      .returning({ id: verificationDocsTable.id });
    docId = doc!.id;

    let r = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    r = await apiFetch(`/admin/provider-applications/${applicationId}/approve`, {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    assert.equal(await eventCount(profileId, "provider_approved"), 1);
    // Verification is still under_review → C1 incomplete → no activation.
    assert.equal(await eventCount(profileId, "provider_activated"), 0);
  });

  it("does not activate while a criterion is still missing (C1 completed, C5 missing)", async () => {
    const r = await apiFetch(`/admin/verification/docs/${docId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "approved", updateProviderStatus: "approved" }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    // C1 now satisfied, but no travel zone (C5) yet → still not activated.
    assert.equal(await eventCount(profileId, "provider_activated"), 0);

    const readiness = await apiFetch("/providers/me/readiness", { token: providerToken });
    assert.deepEqual((readiness.body["readiness"] as JsonBody)["missing"], [
      "NO_SERVICE_AREA",
    ]);
  });

  it("emits provider_activated when the LAST criterion is completed, exactly once", async () => {
    const r = await apiFetch("/providers/me/travel-zones", {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({ zoneName: "Downtown core", city: CITY_TEXT }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));

    assert.equal(await eventCount(profileId, "service_area_set"), 1);
    assert.equal(await eventCount(profileId, "provider_activated"), 1);

    const activated = await lastEvent(profileId);
    assert.equal(activated!.eventType, "provider_activated");
    assert.equal(activated!.source, "system");
    assert.equal(activated!.reasonCode, null);
    assert.deepEqual(activated!.metadata, {
      criteria: {
        approved: true,
        profileComplete: true,
        activeService: true,
        availability: true,
        serviceArea: true,
        acceptingClients: true,
        documents: true,
      },
    });

    // Idempotency: an equivalent follow-up write flips nothing.
    const again = await apiFetch("/providers/me/travel-zones", {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({ zoneName: "East end", city: CITY_TEXT }),
    });
    assert.equal(again.status, 201);
    assert.equal(await eventCount(profileId, "provider_activated"), 1);
    assert.equal(await eventCount(profileId, "service_area_set"), 1); // once-ever
  });

  it("deactivates with NOT_ACCEPTING_CLIENTS (C6) and reactivates on restore", async () => {
    let r = await apiFetch("/providers/me", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ acceptsNewClients: false }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    assert.equal(await eventCount(profileId, "provider_deactivated"), 1);
    let event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_deactivated");
    assert.equal(event!.reasonCode, "NOT_ACCEPTING_CLIENTS");
    assert.deepEqual(event!.metadata, { missing: ["NOT_ACCEPTING_CLIENTS"] });

    r = await apiFetch("/providers/me", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ acceptsNewClients: true }),
    });
    assert.equal(r.status, 200);
    assert.equal(await eventCount(profileId, "provider_activated"), 2);
    event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_activated");
  });

  it("reports the FIRST missing code in C1→C7 order when several criteria fail at once", async () => {
    // One write clears the bio (C2) AND stops accepting clients (C6):
    // the deactivation reason must be the FIRST missing code — C2.
    let r = await apiFetch("/providers/me", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ bio: "", acceptsNewClients: false }),
    });
    assert.equal(r.status, 200);

    const event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_deactivated");
    assert.equal(event!.reasonCode, "PROFILE_INCOMPLETE");
    assert.deepEqual(event!.metadata, {
      missing: ["PROFILE_INCOMPLETE", "NOT_ACCEPTING_CLIENTS"],
    });

    r = await apiFetch("/providers/me", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ bio: BIO_TEXT, acceptsNewClients: true }),
    });
    assert.equal(r.status, 200);
    assert.equal((await lastEvent(profileId))!.eventType, "provider_activated");
  });

  it("deactivates with NO_ACTIVE_SERVICE (C3) when the last service is deactivated", async () => {
    let r = await apiFetch(`/providers/me/services/${serviceId}`, {
      method: "DELETE",
      token: providerToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    let event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_deactivated");
    assert.equal(event!.reasonCode, "NO_ACTIVE_SERVICE");

    // Reactivating the service flips back; the milestone does NOT repeat.
    r = await apiFetch(`/providers/me/services/${serviceId}`, {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(r.status, 200);
    event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_activated");
    assert.equal(await eventCount(profileId, "first_service_published"), 1);
  });

  it("deactivates with NOT_APPROVED (C1) when verification is revoked, then restores", async () => {
    let r = await apiFetch(`/admin/verification/docs/${docId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "rejected", updateProviderStatus: "rejected" }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const event = await lastEvent(profileId);
    assert.equal(event!.eventType, "provider_deactivated");
    assert.equal(event!.reasonCode, "NOT_APPROVED");

    r = await apiFetch(`/admin/verification/docs/${docId}`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "approved", updateProviderStatus: "approved" }),
    });
    assert.equal(r.status, 200);
    assert.equal((await lastEvent(profileId))!.eventType, "provider_activated");
  });

  it("emits no transition events for a rejected provider who was never activated", async () => {
    const rejected = await register(REJECTED_EMAIL, "provider");
    rejectedUserId = rejected.userId;
    const app = await appFor(rejectedUserId);
    rejectedProfileId = app.profileId;

    let r = await apiFetch("/providers/application", {
      method: "PATCH",
      token: rejected.token,
      body: JSON.stringify({ title: "Specialist", bio: "Bio", city: "Ottawa" }),
    });
    assert.equal(r.status, 200);
    await db.insert(verificationDocsTable).values({
      providerId: rejectedProfileId,
      docType: "license",
      fileName: `phase3-rejected-${suffix}.pdf`,
    });
    r = await apiFetch("/providers/application/services", {
      method: "POST",
      token: rejected.token,
      body: JSON.stringify({ title: "Visit", durationMinutes: 60, priceCents: 9000 }),
    });
    assert.equal(r.status, 201);
    r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token: rejected.token,
      body: JSON.stringify({ slots: [{ dayOfWeek: 2, startTime: "10:00", endTime: "16:00" }] }),
    });
    assert.equal(r.status, 200);
    r = await apiFetch("/providers/application/submit", { method: "POST", token: rejected.token });
    assert.equal(r.status, 200);

    r = await apiFetch(`/admin/provider-applications/${app.id}/reject`, {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ rejectionReason: "Insufficient credentials for review." }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    assert.equal(await eventCount(rejectedProfileId, "provider_approved"), 0);
    assert.equal(await eventCount(rejectedProfileId, "provider_activated"), 0);
    assert.equal(await eventCount(rejectedProfileId, "provider_deactivated"), 0);
    // Milestones from onboarding remain recorded (they are funnel facts).
    assert.equal(await eventCount(rejectedProfileId, "profile_completed"), 1);
  });

  it("is atomic: a rolled-back transaction leaves neither mutation nor event", async () => {
    const before = await eventCount(profileId);
    const [{ bio: bioBefore }] = await db
      .select({ bio: providerProfilesTable.bio })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, profileId));

    await assert.rejects(
      db.transaction(async (tx) => {
        await tx
          .update(providerProfilesTable)
          .set({ bio: "" })
          .where(eq(providerProfilesTable.id, profileId));
        await emitProviderActivationEvents(tx, {
          providerProfileId: profileId,
          actor: { userId: providerUserId, role: "provider" },
          context: { checkProfileCompleted: true },
        });
        throw new Error("forced rollback");
      }),
    );

    assert.equal(await eventCount(profileId), before, "no event row may survive the rollback");
    const [{ bio: bioAfter }] = await db
      .select({ bio: providerProfilesTable.bio })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.id, profileId));
    assert.equal(bioAfter, bioBefore, "no mutation may survive the rollback");
  });

  it("keeps metadata free of PII and raw field values (privacy sweep)", async () => {
    const rows = await db
      .select()
      .from(marketplaceEventsTable)
      .where(eq(marketplaceEventsTable.providerProfileId, profileId));
    assert.ok(rows.length > 0);

    for (const row of rows) {
      assert.equal(row.source, "system");
      if (row.metadata) {
        const keys = Object.keys(row.metadata);
        assert.ok(
          keys.every((k) => k === "criteria" || k === "missing"),
          `unexpected metadata keys: ${keys.join(",")}`,
        );
        const flat = JSON.stringify(row.metadata);
        for (const forbidden of [BIO_TEXT, TITLE_TEXT, PROVIDER_EMAIL, "Phase3", "Events"]) {
          assert.equal(
            flat.includes(forbidden),
            false,
            `metadata leaked raw value: ${forbidden}`,
          );
        }
      }
    }
  });

  it("emits nothing from the read-only readiness endpoint", async () => {
    const before = await eventCount(profileId);
    for (let i = 0; i < 3; i++) {
      const r = await apiFetch("/providers/me/readiness", { token: providerToken });
      assert.equal(r.status, 200);
    }
    assert.equal(await eventCount(profileId), before);
  });
});
