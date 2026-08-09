/**
 * MC8-lite Commit 4 — durable regression coverage for provider-application
 * lifecycle events and in-app notifications.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-notifications
 *
 * Covers (all against live HTTP + direct DB assertions):
 *   - `submitted` event emission (draft → under_review)
 *   - `reset_to_draft` event emission (rejected → draft)
 *   - event/notification transactional atomicity (one notification per event;
 *     an invalid transition creates neither)
 *   - repeated-operation idempotency (no duplicate events/notifications)
 *   - owner isolation + non-enumerating 404 on mark-read
 *   - keyset pagination + newest-first ordering
 *   - unread-count behaviour
 *   - mark-read idempotency
 *   - auth (401) / role (403) / malformed-id (400) errors
 *   - privacy: no reviewerNotes / reviewedBy in any response
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, sql } from "drizzle-orm";
import {
  availabilityTable,
  db,
  providerApplicationsTable,
  providerApplicationEventsTable,
  providerNotificationsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "mc8-notif-password";
const suffix = `${process.pid}-${Date.now()}`;
const PRIVATE_PHRASE = `reviewer-private-${suffix}`;

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

async function register(email: string) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "MC8",
      lastName: "Notif",
      role: "provider",
      roleIntent: "provider",
    }),
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  return { token: r.body["token"] as string, userId: (r.body["user"] as JsonBody)["id"] as number };
}

async function registerClient(email: string) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "MC8",
      lastName: "Client",
      role: "client",
      roleIntent: "client",
    }),
  });
  assert.equal(r.status, 201, `client register failed: ${JSON.stringify(r.body)}`);
  return { token: r.body["token"] as string, userId: (r.body["user"] as JsonBody)["id"] as number };
}

async function appFor(userId: number) {
  const [row] = await db
    .select({ id: providerApplicationsTable.id, profileId: providerApplicationsTable.providerProfileId })
    .from(providerApplicationsTable)
    .where(eq(providerApplicationsTable.userId, userId))
    .limit(1);
  assert.ok(row, "application row must exist after registration");
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
    fileName: `mc8-license-${suffix}.pdf`,
  });
}

/** Register + fill + seed a provider whose application can be submitted. */
async function provisionSubmittable(email: string, city: string) {
  const p = await register(email);
  const app = await appFor(p.userId);
  await fillDraft(p.token, city);
  await seedPrereqs(app.profileId);
  return { ...p, appId: app.id, profileId: app.profileId };
}

async function markRejectedInDb(appId: number, reviewerNotes: string) {
  await db
    .update(providerApplicationsTable)
    .set({
      status: "rejected",
      rejectionReason: "needs more detail",
      reviewerNotes,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(providerApplicationsTable.id, appId));
}

async function countEvents(appId: number) {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(providerApplicationEventsTable)
    .where(eq(providerApplicationEventsTable.providerApplicationId, appId));
  return r[0]?.c ?? 0;
}
async function eventTypes(appId: number) {
  const rows = await db
    .select({ type: providerApplicationEventsTable.type, from: providerApplicationEventsTable.fromStatus, to: providerApplicationEventsTable.toStatus })
    .from(providerApplicationEventsTable)
    .where(eq(providerApplicationEventsTable.providerApplicationId, appId))
    .orderBy(providerApplicationEventsTable.id);
  return rows;
}
async function countNotifs(userId: number) {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(providerNotificationsTable)
    .where(eq(providerNotificationsTable.userId, userId));
  return r[0]?.c ?? 0;
}

const list = (token: string, qs = "") =>
  apiFetch(`/providers/notifications${qs}`, { token });
const unread = async (token: string) => {
  const r = await apiFetch("/providers/notifications/unread-count", { token });
  return r;
};
const markRead = (token: string, id: number | string) =>
  apiFetch(`/providers/notifications/${id}/read`, { method: "POST", token });

describe("MC8-lite — lifecycle events & in-app notifications", () => {
  let main: Awaited<ReturnType<typeof provisionSubmittable>>;
  let idem: Awaited<ReturnType<typeof provisionSubmittable>>;
  let invalid: { token: string; userId: number; appId: number };
  let providerB: { token: string; userId: number };
  let client: { token: string; userId: number };
  const userIds: number[] = [];

  before(async () => {
    main = await provisionSubmittable(`mc8-main-${suffix}@ex.test`, "Toronto");
    idem = await provisionSubmittable(`mc8-idem-${suffix}@ex.test`, "Ottawa");
    const inv = await register(`mc8-invalid-${suffix}@ex.test`);
    const invApp = await appFor(inv.userId);
    invalid = { token: inv.token, userId: inv.userId, appId: invApp.id };
    providerB = await register(`mc8-b-${suffix}@ex.test`);
    client = await registerClient(`mc8-client-${suffix}@ex.test`);
    userIds.push(main.userId, idem.userId, invalid.userId, providerB.userId, client.userId);

    // main: submit -> reject -> reset  => 2 events + 2 notifications.
    const s = await apiFetch("/providers/application/submit", { method: "POST", token: main.token });
    assert.equal(s.status, 200, `main submit: ${JSON.stringify(s.body)}`);
    await markRejectedInDb(main.appId, PRIVATE_PHRASE);
    const r = await apiFetch("/providers/application/reset", { method: "POST", token: main.token });
    assert.equal(r.status, 200, `main reset: ${JSON.stringify(r.body)}`);

    // idem: submit once (leaves it under_review for the idempotency test).
    const s2 = await apiFetch("/providers/application/submit", { method: "POST", token: idem.token });
    assert.equal(s2.status, 200);
  });

  after(async () => {
    for (const id of userIds) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
  });

  it("emits a `submitted` event (draft → under_review) and a `reset_to_draft` event (rejected → draft), newest last by id", async () => {
    const rows = await eventTypes(main.appId);
    assert.deepEqual(
      rows.map((r) => r.type),
      ["submitted", "reset_to_draft"],
    );
    assert.deepEqual(rows[0], { type: "submitted", from: "draft", to: "under_review" });
    assert.deepEqual(rows[1], { type: "reset_to_draft", from: "rejected", to: "draft" });
  });

  it("creates exactly one notification per event (transactional atomicity)", async () => {
    assert.equal(await countEvents(main.appId), 2);
    assert.equal(await countNotifs(main.userId), 2);
    // every notification references a real event for this user
    const notifs = await db
      .select({ eventId: providerNotificationsTable.eventId })
      .from(providerNotificationsTable)
      .where(eq(providerNotificationsTable.userId, main.userId));
    for (const n of notifs) {
      const [ev] = await db
        .select({ id: providerApplicationEventsTable.id })
        .from(providerApplicationEventsTable)
        .where(eq(providerApplicationEventsTable.id, n.eventId))
        .limit(1);
      assert.ok(ev, "notification must reference an existing event");
    }
  });

  it("an invalid submit (missing prerequisites) creates neither event nor notification", async () => {
    const r = await apiFetch("/providers/application/submit", { method: "POST", token: invalid.token });
    assert.equal(r.status, 400);
    assert.equal(await countEvents(invalid.appId), 0);
    assert.equal(await countNotifs(invalid.userId), 0);
  });

  it("repeated submit (already under_review) is idempotent — no duplicate event/notification", async () => {
    const before = await countEvents(idem.appId);
    const beforeN = await countNotifs(idem.userId);
    const r = await apiFetch("/providers/application/submit", { method: "POST", token: idem.token });
    assert.equal(r.status, 200);
    assert.equal(await countEvents(idem.appId), before);
    assert.equal(await countNotifs(idem.userId), beforeN);
  });

  it("reset on a draft is a noop — no event/notification created", async () => {
    const r = await apiFetch("/providers/application/reset", { method: "POST", token: invalid.token });
    assert.equal(r.status, 200);
    assert.equal(await countEvents(invalid.appId), 0);
    assert.equal(await countNotifs(invalid.userId), 0);
  });

  it("owner isolation: provider B sees none of A's notifications", async () => {
    const r = await list(providerB.token);
    assert.equal(r.status, 200);
    assert.equal((r.body["notifications"] as JsonBody[]).length, 0);
  });

  it("mark-read is owner-only and non-enumerating (404 for another owner's id)", async () => {
    const a = await list(main.token);
    const someId = (a.body["notifications"] as JsonBody[])[0]!["id"] as number;
    const r = await markRead(providerB.token, someId);
    assert.equal(r.status, 404);
    // A's state is unaffected
    const u = await unread(main.token);
    assert.equal(u.body["unreadCount"], 2);
  });

  it("keyset pagination returns newest-first with no gaps/overlap", async () => {
    const p1 = await list(main.token, "?limit=1");
    assert.equal(p1.status, 200);
    const n1 = p1.body["notifications"] as JsonBody[];
    assert.equal(n1.length, 1);
    assert.equal(n1[0]!["type"], "reset_to_draft"); // newest first
    const pg1 = p1.body["pagination"] as JsonBody;
    assert.equal(pg1["hasMore"], true);
    const cursor = pg1["nextCursor"] as string;
    assert.ok(cursor);

    const p2 = await list(main.token, `?limit=1&cursor=${encodeURIComponent(cursor)}`);
    const n2 = p2.body["notifications"] as JsonBody[];
    assert.equal(n2.length, 1);
    assert.equal(n2[0]!["type"], "submitted");
    const pg2 = p2.body["pagination"] as JsonBody;
    assert.equal(pg2["hasMore"], false);
    assert.equal(pg2["nextCursor"], null);

    const ids = [n1[0]!["id"], n2[0]!["id"]];
    assert.equal(new Set(ids).size, 2);
  });

  it("unread-count reflects unread notifications", async () => {
    const u = await unread(main.token);
    assert.equal(u.status, 200);
    assert.equal(u.body["unreadCount"], 2);
  });

  it("mark-read decrements unread and is idempotent", async () => {
    const a = await list(main.token);
    const target = (a.body["notifications"] as JsonBody[])[0]!["id"] as number;

    const m1 = await markRead(main.token, target);
    assert.equal(m1.status, 200);
    assert.ok((m1.body["notification"] as JsonBody)["readAt"], "readAt is set after marking");
    assert.equal((await unread(main.token)).body["unreadCount"], 1);

    const m2 = await markRead(main.token, target);
    assert.equal(m2.status, 200);
    assert.equal((await unread(main.token)).body["unreadCount"], 1); // idempotent
  });

  it("auth, role, and malformed-id errors", async () => {
    assert.equal((await apiFetch("/providers/notifications")).status, 401);
    assert.equal((await apiFetch("/providers/notifications/unread-count")).status, 401);
    assert.equal((await apiFetch("/providers/notifications/1/read", { method: "POST" })).status, 401);
    assert.equal((await list(client.token)).status, 403);
    assert.equal((await markRead(main.token, "abc")).status, 400);
    assert.equal((await markRead(main.token, 999999999)).status, 404);
  });

  it("never leaks reviewerNotes / reviewedBy / reviewer-private content", async () => {
    const full = await list(main.token, "?limit=50");
    const s = JSON.stringify(full.body);
    assert.equal(s.includes("reviewerNotes"), false);
    assert.equal(s.includes("reviewedBy"), false);
    assert.equal(s.includes(PRIVATE_PHRASE), false);
  });
});