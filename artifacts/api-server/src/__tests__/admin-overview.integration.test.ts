/**
 * Admin command-center feeds (Phase 1) — durable regression coverage for the
 * two read-only admin endpoints behind `/admin`:
 *
 *   GET /admin/provider-applications?status=…      (queue feed + applicant summary)
 *   GET /admin/provider-applications/events?limit= (recent lifecycle events)
 *
 * Prerequisites: API server running against a TEST database (never the managed
 * production catalog — this suite creates and deletes its own users).
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:admin-overview
 *
 * Covers:
 *   - authorization: 401 unauthenticated, 403 provider, 200 admin
 *   - validation: bad status / limit / offset → 400
 *   - queue feed lists an under_review application oldest-first with the
 *     applicant summary, and excludes reviewer-private fields
 *   - approving an application removes it from the under_review feed and
 *     produces an `approved` event visible in the events feed (newest first)
 *   - events payload never carries email, reviewerNotes or rejectionReason
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import {
  accountRolesTable,
  availabilityTable,
  db,
  providerApplicationsTable,
  servicesTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "admin-overview-password";
const suffix = `${process.pid}-${Date.now()}`;
const PRIVATE_PHRASE = `reviewer-private-${suffix}`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody; text: string }> {
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
  return { status: res.status, body, text };
}

async function register(email: string, role: "provider" | "client") {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "Overview",
      lastName: `Tester${suffix.slice(-4)}`,
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
  await db.insert(accountRolesTable).values({ userId, role: "admin" }).onConflictDoNothing();
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

async function provisionUnderReview(email: string, city: string) {
  const p = await register(email, "provider");
  const app = await appFor(p.userId);
  const patch = await apiFetch("/providers/application", {
    method: "PATCH",
    token: p.token,
    body: JSON.stringify({
      title: "Mobile foot-care specialist",
      bio: "Professional in-home foot care with a calm, client-first approach.",
      city,
      yearsExperience: 5,
    }),
  });
  assert.equal(patch.status, 200, `patch draft failed: ${JSON.stringify(patch.body)}`);
  await db.insert(servicesTable).values({
    providerId: app.profileId,
    title: "In-home foot care visit",
    durationMinutes: 60,
    priceCents: 12000,
    category: "foot_care",
    isActive: true,
  });
  await db.insert(availabilityTable).values({
    providerId: app.profileId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
  });
  await db.insert(verificationDocsTable).values({
    providerId: app.profileId,
    docType: "license",
    fileName: `overview-license-${suffix}.pdf`,
  });
  const s = await apiFetch("/providers/application/submit", { method: "POST", token: p.token });
  assert.equal(s.status, 200, `submit failed: ${JSON.stringify(s.body)}`);
  return { ...p, appId: app.id, profileId: app.profileId };
}

describe("admin command-center feeds (Phase 1)", () => {
  const adminEmail = `overview-admin-${suffix}@example.com`;
  const providerEmail = `overview-provider-${suffix}@example.com`;
  let adminToken = "";
  let providerToken = "";
  let providerUserId = 0;
  let adminUserId = 0;
  let appId = 0;
  const createdUserIds: number[] = [];

  before(async () => {
    const admin = await register(adminEmail, "client");
    adminUserId = admin.userId;
    createdUserIds.push(adminUserId);
    adminToken = await promoteToAdmin(admin.userId, adminEmail);

    const provider = await provisionUnderReview(providerEmail, `Hamilton-${suffix}`);
    providerToken = provider.token;
    providerUserId = provider.userId;
    appId = provider.appId;
    createdUserIds.push(providerUserId);
  });

  after(async () => {
    // Cascades remove profiles, applications, events, docs, services.
    if (createdUserIds.length) {
      await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
    }
  });

  it("rejects unauthenticated and non-admin callers", async () => {
    assert.equal((await apiFetch("/admin/provider-applications")).status, 401);
    assert.equal((await apiFetch("/admin/provider-applications/events")).status, 401);
    assert.equal(
      (await apiFetch("/admin/provider-applications", { token: providerToken })).status,
      403,
    );
    assert.equal(
      (await apiFetch("/admin/provider-applications/events", { token: providerToken })).status,
      403,
    );
  });

  it("validates query parameters", async () => {
    assert.equal(
      (await apiFetch("/admin/provider-applications?status=bogus", { token: adminToken })).status,
      400,
    );
    assert.equal(
      (await apiFetch("/admin/provider-applications?limit=0", { token: adminToken })).status,
      400,
    );
    assert.equal(
      (await apiFetch("/admin/provider-applications?offset=-1", { token: adminToken })).status,
      400,
    );
    assert.equal(
      (await apiFetch("/admin/provider-applications/events?limit=51", { token: adminToken })).status,
      400,
    );
  });

  it("lists the under_review application with an applicant summary and no private fields", async () => {
    const r = await apiFetch("/admin/provider-applications?status=under_review&limit=200", {
      token: adminToken,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const items = r.body["items"] as Array<{ application: JsonBody; applicant: JsonBody }>;
    assert.ok(Array.isArray(items));
    const mine = items.find((i) => i.application["id"] === appId);
    assert.ok(mine, "our under_review application must be listed");
    assert.equal(mine.application["status"], "under_review");
    assert.equal(mine.application["currentStep"], "submitted");
    assert.ok(mine.application["submittedAt"], "submittedAt must be set");
    assert.equal(mine.applicant["userId"], providerUserId);
    assert.equal(mine.applicant["email"], providerEmail);
    assert.equal(mine.applicant["city"], `Hamilton-${suffix}`);
    assert.equal("reviewerNotes" in mine.application, false);
    assert.equal("rejectionReason" in mine.application, false);
    assert.equal(typeof r.body["total"], "number");
    assert.equal(r.body["limit"], 200);
    assert.equal(r.body["offset"], 0);
  });

  it("orders oldest submission first", async () => {
    const r = await apiFetch("/admin/provider-applications?status=under_review&limit=200", {
      token: adminToken,
    });
    const items = r.body["items"] as Array<{ application: { submittedAt: string | null } }>;
    const times = items
      .map((i) => i.application.submittedAt)
      .filter((t): t is string => typeof t === "string")
      .map((t) => new Date(t).getTime());
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i - 1]! <= times[i]!, "submittedAt must be ascending");
    }
  });

  it("after approval, the application leaves the queue and the event appears newest-first", async () => {
    const approve = await apiFetch(`/admin/provider-applications/${appId}/approve`, {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ reviewerNotes: PRIVATE_PHRASE }),
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));

    const queue = await apiFetch("/admin/provider-applications?status=under_review&limit=200", {
      token: adminToken,
    });
    const stillThere = (queue.body["items"] as Array<{ application: JsonBody }>).some(
      (i) => i.application["id"] === appId,
    );
    assert.equal(stillThere, false, "approved application must not remain under_review");

    const approved = await apiFetch("/admin/provider-applications?status=approved&limit=200", {
      token: adminToken,
    });
    assert.ok(
      (approved.body["items"] as Array<{ application: JsonBody }>).some(
        (i) => i.application["id"] === appId,
      ),
      "approved application must appear under status=approved",
    );

    const ev = await apiFetch("/admin/provider-applications/events?limit=50", { token: adminToken });
    assert.equal(ev.status, 200, JSON.stringify(ev.body));
    const events = ev.body["items"] as Array<JsonBody & { applicant: JsonBody }>;
    const ours = events.filter((e) => e["providerApplicationId"] === appId);
    assert.ok(ours.length >= 2, "submitted + approved events expected");
    assert.equal(ours[0]!["type"], "approved", "newest event first");
    assert.equal(ours[0]!["toStatus"], "approved");
    assert.equal(ours[0]!.applicant["userId"], providerUserId);
    // Newest-first across the whole slice.
    const ts = events.map((e) => new Date(e["createdAt"] as string).getTime());
    for (let i = 1; i < ts.length; i++) assert.ok(ts[i - 1]! >= ts[i]!);
    // Privacy: no email / reviewer-private content in the events payload.
    assert.equal(ev.text.includes(providerEmail), false);
    assert.equal(ev.text.includes(PRIVATE_PHRASE), false);
    assert.equal(ev.text.includes("reviewerNotes"), false);
    assert.equal(ev.text.includes("rejectionReason"), false);
  });
});
