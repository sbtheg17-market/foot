/**
 * MC9 Commit 3 — durable regression coverage for reviewer decisions on
 * provider applications and the transactional decision notifications.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:reviewer-decisions
 *
 * Covers (all against live HTTP + direct DB assertions):
 *   - reviewer/admin authorization (401 unauthenticated, 403 provider/client)
 *   - provider self-approval / self-rejection prevention (403, no side effects)
 *   - valid `under_review → approved` and `under_review → rejected` decisions
 *     with persisted reviewedAt / reviewedBy / reviewerNotes / rejectionReason
 *   - invalid-state transitions (draft, rejected) → 409 with no side effects
 *   - repeated decisions → 409 with no side effects (idempotency boundary)
 *   - malformed-id 400 / unknown-id 404 / missing rejectionReason 400
 *   - `approved` / `rejected` lifecycle event creation (owner userId, from/to)
 *   - transactional decision-notification creation (one per event)
 *   - provider ownership and notification isolation
 *   - privacy: no reviewerNotes / reviewedBy / reviewer-private content in any
 *     provider-facing response or notification body; rejection reason text
 *     never appears in notification bodies
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  accountRolesTable,
  availabilityTable,
  db,
  providerApplicationsTable,
  providerApplicationEventsTable,
  providerNotificationsTable,
  servicesTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "mc9-decisions-password";
const suffix = `${process.pid}-${Date.now()}`;
const PRIVATE_PHRASE = `reviewer-private-${suffix}`;
const REJECTION_REASON = `insurance-docs-missing-${suffix}`;

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
      firstName: "MC9",
      lastName: "Decisions",
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

/**
 * Promote an existing test user to admin through the database (the product
 * has no self-serve admin signup), then re-login so the token carries the
 * server-confirmed admin role. Registration-created role memberships are
 * preserved, which is exactly the dual-role scenario the self-review guard
 * must handle.
 */
async function promoteToAdmin(userId: number, email: string) {
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, userId));
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

async function appRow(appId: number) {
  const [row] = await db
    .select()
    .from(providerApplicationsTable)
    .where(eq(providerApplicationsTable.id, appId))
    .limit(1);
  assert.ok(row, "application row must exist");
  return row;
}

async function fillDraft(token: string, city: string) {
  const r = await apiFetch("/providers/application", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      title: "Mobile foot-care specialist",
      bio: "Professional in-home foot care with a calm, client-first approach.",
      city,
      yearsExperience: 5,
    }),
  });
  assert.equal(r.status, 200, `patch draft failed: ${JSON.stringify(r.body)}`);
}

async function seedPrereqs(profileId: number) {
  await db.insert(servicesTable).values({
    providerId: profileId,
    title: "In-home foot care visit",
    durationMinutes: 60,
    priceCents: 12000,
    category: "foot_care",
    isActive: true,
  });
  await db.insert(availabilityTable).values({
    providerId: profileId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
  });
  await db.insert(verificationDocsTable).values({
    providerId: profileId,
    docType: "license",
    fileName: `mc9-license-${suffix}.pdf`,
  });
}

/** Register + fill + seed + submit a provider so the app is under_review. */
async function provisionUnderReview(email: string, city: string) {
  const p = await register(email, "provider");
  const app = await appFor(p.userId);
  await fillDraft(p.token, city);
  await seedPrereqs(app.profileId);
  const s = await apiFetch("/providers/application/submit", {
    method: "POST",
    token: p.token,
  });
  assert.equal(s.status, 200, `submit failed: ${JSON.stringify(s.body)}`);
  return { ...p, appId: app.id, profileId: app.profileId };
}

async function events(appId: number) {
  return db
    .select({
      userId: providerApplicationEventsTable.userId,
      type: providerApplicationEventsTable.type,
      from: providerApplicationEventsTable.fromStatus,
      to: providerApplicationEventsTable.toStatus,
    })
    .from(providerApplicationEventsTable)
    .where(eq(providerApplicationEventsTable.providerApplicationId, appId))
    .orderBy(providerApplicationEventsTable.id);
}

async function countEvents(appId: number) {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(providerApplicationEventsTable)
    .where(eq(providerApplicationEventsTable.providerApplicationId, appId));
  return r[0]?.c ?? 0;
}

async function countNotifs(userId: number) {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(providerNotificationsTable)
    .where(eq(providerNotificationsTable.userId, userId));
  return r[0]?.c ?? 0;
}

const approve = (token: string | null, id: number | string, body: JsonBody = {}) =>
  apiFetch(`/admin/provider-applications/${id}/approve`, {
    method: "POST",
    ...(token ? { token } : {}),
    body: JSON.stringify(body),
  });
const reject = (token: string | null, id: number | string, body: JsonBody = {}) =>
  apiFetch(`/admin/provider-applications/${id}/reject`, {
    method: "POST",
    ...(token ? { token } : {}),
    body: JSON.stringify(body),
  });
const listNotifs = (token: string) =>
  apiFetch("/providers/notifications", { token });

describe("MC9 — reviewer decisions & decision notifications", () => {
  let adminToken: string;
  let appr: Awaited<ReturnType<typeof provisionUnderReview>>;
  let rej: Awaited<ReturnType<typeof provisionUnderReview>>;
  let selfAdmin: Awaited<ReturnType<typeof provisionUnderReview>> & {
    adminToken: string;
  };
  let draftP: { token: string; userId: number; appId: number };
  let providerB: { token: string; userId: number };
  let client: { token: string; userId: number };
  const userIds: number[] = [];

  before(async () => {
    // Dedicated reviewer (client signup promoted to admin — self-provisioned,
    // independent of seed data).
    const adminUser = await register(`mc9-admin-${suffix}@ex.test`, "client");
    adminToken = await promoteToAdmin(
      adminUser.userId,
      `mc9-admin-${suffix}@ex.test`,
    );

    appr = await provisionUnderReview(`mc9-appr-${suffix}@ex.test`, "Toronto");
    rej = await provisionUnderReview(`mc9-rej-${suffix}@ex.test`, "Ottawa");

    // Dual-role user: provider application submitted first, then promoted to
    // admin — the self-review guard target.
    const s = await provisionUnderReview(
      `mc9-self-${suffix}@ex.test`,
      "Hamilton",
    );
    const selfToken = await promoteToAdmin(
      s.userId,
      `mc9-self-${suffix}@ex.test`,
    );
    selfAdmin = { ...s, adminToken: selfToken };

    const d = await register(`mc9-draft-${suffix}@ex.test`, "provider");
    const dApp = await appFor(d.userId);
    draftP = { token: d.token, userId: d.userId, appId: dApp.id };

    providerB = await register(`mc9-b-${suffix}@ex.test`, "provider");
    client = await register(`mc9-client-${suffix}@ex.test`, "client");

    userIds.push(
      adminUser.userId,
      appr.userId,
      rej.userId,
      selfAdmin.userId,
      draftP.userId,
      providerB.userId,
      client.userId,
    );
  });

  after(async () => {
    for (const id of userIds) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
  });

  it("rejects unauthenticated decision calls with 401", async () => {
    const a = await approve(null, appr.appId);
    const r = await reject(null, rej.appId, { rejectionReason: "x" });
    assert.equal(a.status, 401);
    assert.equal(r.status, 401);
  });

  it("rejects non-admin decision calls with 403 (provider and client roles)", async () => {
    const a = await approve(providerB.token, appr.appId);
    const r = await reject(client.token, rej.appId, { rejectionReason: "x" });
    assert.equal(a.status, 403);
    assert.equal(r.status, 403);
    assert.equal((await appRow(appr.appId)).status, "under_review");
  });

  it("returns 400 for a malformed application id and 404 for an unknown id", async () => {
    assert.equal((await approve(adminToken, "abc")).status, 400);
    assert.equal((await reject(adminToken, "abc", { rejectionReason: "x" })).status, 400);
    assert.equal((await approve(adminToken, 99_999_999)).status, 404);
    assert.equal((await reject(adminToken, 99_999_999, { rejectionReason: "x" })).status, 404);
  });

  it("requires a non-empty rejectionReason for reject (400, no side effects)", async () => {
    const before = await countEvents(rej.appId);
    for (const body of [{}, { rejectionReason: "" }, { rejectionReason: "   " }, { rejectionReason: 7 }]) {
      const r = await reject(adminToken, rej.appId, body as JsonBody);
      assert.equal(r.status, 400, JSON.stringify(r.body));
    }
    assert.equal((await appRow(rej.appId)).status, "under_review");
    assert.equal(await countEvents(rej.appId), before);
  });

  it("blocks self-review for a dual-role admin/provider (403, no side effects)", async () => {
    const a = await approve(selfAdmin.adminToken, selfAdmin.appId);
    const r = await reject(selfAdmin.adminToken, selfAdmin.appId, {
      rejectionReason: "self",
    });
    assert.equal(a.status, 403);
    assert.equal(r.status, 403);
    const row = await appRow(selfAdmin.appId);
    assert.equal(row.status, "under_review");
    assert.equal(row.reviewedBy, null);
    // Only the owner-driven `submitted` event exists.
    assert.equal(await countEvents(selfAdmin.appId), 1);
  });

  it("approves an under_review application, persisting reviewer audit fields", async () => {
    const res = await approve(adminToken, appr.appId, {
      reviewerNotes: PRIVATE_PHRASE,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const view = res.body["application"] as JsonBody;
    assert.equal(view["status"], "approved");
    assert.equal(view["rejectionReason"], null);
    assert.ok(view["reviewedAt"], "reviewedAt must be set");

    const row = await appRow(appr.appId);
    assert.equal(row.status, "approved");
    assert.equal(row.reviewerNotes, PRIVATE_PHRASE);
    assert.ok(row.reviewedAt instanceof Date);
    assert.ok(typeof row.reviewedBy === "number", "reviewedBy must be set");
    assert.notEqual(row.reviewedBy, appr.userId);
  });

  it("records the `approved` lifecycle event with owner userId and correct statuses", async () => {
    const rows = await events(appr.appId);
    assert.deepEqual(
      rows.map((r) => r.type),
      ["submitted", "approved"],
    );
    assert.deepEqual(rows[1], {
      userId: appr.userId,
      type: "approved",
      from: "under_review",
      to: "approved",
    });
  });

  it("creates exactly one provider-safe `approved` notification in the same transaction", async () => {
    // one per event: submitted + approved.
    assert.equal(await countEvents(appr.appId), 2);
    assert.equal(await countNotifs(appr.userId), 2);

    const l = await listNotifs(appr.token);
    assert.equal(l.status, 200);
    const notifs = l.body["notifications"] as JsonBody[];
    assert.equal(notifs.length, 2);
    const newest = notifs[0]!;
    assert.equal(newest["type"], "approved");
    assert.equal(newest["title"], "Application approved");
    assert.equal(newest["link"], "/provider/application-status");
    assert.ok((newest["body"] as string).length > 0);
  });

  it("returns 409 for a repeated decision with no side effects", async () => {
    const evBefore = await countEvents(appr.appId);
    const nBefore = await countNotifs(appr.userId);
    assert.equal((await approve(adminToken, appr.appId)).status, 409);
    assert.equal(
      (await reject(adminToken, appr.appId, { rejectionReason: "x" })).status,
      409,
    );
    assert.equal((await appRow(appr.appId)).status, "approved");
    assert.equal(await countEvents(appr.appId), evBefore);
    assert.equal(await countNotifs(appr.userId), nBefore);
  });

  it("rejects an under_review application, persisting reason and private notes", async () => {
    const res = await reject(adminToken, rej.appId, {
      rejectionReason: REJECTION_REASON,
      reviewerNotes: PRIVATE_PHRASE,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((res.body["application"] as JsonBody)["status"], "rejected");

    const row = await appRow(rej.appId);
    assert.equal(row.status, "rejected");
    assert.equal(row.rejectionReason, REJECTION_REASON);
    assert.equal(row.reviewerNotes, PRIVATE_PHRASE);

    const rows = await events(rej.appId);
    assert.deepEqual(
      rows.map((r) => r.type),
      ["submitted", "rejected"],
    );
    assert.deepEqual(rows[1], {
      userId: rej.userId,
      type: "rejected",
      from: "under_review",
      to: "rejected",
    });
  });

  it("creates one `rejected` notification whose body carries no reason or private text", async () => {
    assert.equal(await countNotifs(rej.userId), 2);
    const l = await listNotifs(rej.token);
    const newest = (l.body["notifications"] as JsonBody[])[0]!;
    assert.equal(newest["type"], "rejected");
    assert.equal(newest["title"], "Application decision");
    assert.equal(newest["link"], "/provider/application-status");
    const body = newest["body"] as string;
    assert.ok(!body.includes(REJECTION_REASON), "body must not embed the rejection reason");
    assert.ok(!body.includes(PRIVATE_PHRASE), "body must not embed reviewer-private text");
  });

  it("returns 409 for invalid-state transitions (draft, already-rejected) with no side effects", async () => {
    assert.equal((await approve(adminToken, draftP.appId)).status, 409);
    assert.equal(
      (await reject(adminToken, draftP.appId, { rejectionReason: "x" })).status,
      409,
    );
    assert.equal((await appRow(draftP.appId)).status, "draft");
    assert.equal(await countEvents(draftP.appId), 0);
    assert.equal(await countNotifs(draftP.userId), 0);

    // Cross-decision on the already-rejected application is likewise refused.
    assert.equal((await approve(adminToken, rej.appId)).status, 409);
    assert.equal((await appRow(rej.appId)).status, "rejected");
  });

  it("isolates decision notifications to the application owner", async () => {
    const l = await listNotifs(providerB.token);
    assert.equal(l.status, 200);
    assert.deepEqual(l.body["notifications"], []);

    const unread = await apiFetch("/providers/notifications/unread-count", {
      token: rej.token,
    });
    assert.equal(unread.status, 200);
    assert.equal(unread.body["unreadCount"], 2);
  });

  it("never exposes reviewerNotes/reviewedBy/private content on provider-facing surfaces", async () => {
    const surfaces = [
      await listNotifs(appr.token),
      await listNotifs(rej.token),
      await apiFetch("/providers/application/status", { token: rej.token }),
      await apiFetch("/providers/application", { token: rej.token }),
    ];
    for (const s of surfaces) {
      assert.equal(s.status, 200);
      const raw = JSON.stringify(s.body);
      assert.ok(!raw.includes(PRIVATE_PHRASE), "reviewer-private phrase leaked");
      assert.ok(!raw.includes("reviewerNotes"), "reviewerNotes key leaked");
      assert.ok(!raw.includes("reviewedBy"), "reviewedBy key leaked");
    }
    // The provider-visible rejection reason (distinct from private notes)
    // remains available on the status surface.
    const status = await apiFetch("/providers/application/status", {
      token: rej.token,
    });
    assert.ok(JSON.stringify(status.body).includes(REJECTION_REASON));
  });
});
