/**
 * MC5 — Provider submission-history API (server-only).
 *
 * Prerequisites: API server must be running with the local test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-history
 *
 * Scope:
 *   - GET /providers/application/submissions
 *   - Owner-scoped, keyset-paginated closed rejection-cycle history (newest first)
 *   - Six-field public allow-list; reviewerNotes / reviewedBy never exposed
 *   - Deterministic ORDER BY created_at DESC, id DESC (id tie-breaker)
 *   - Opaque cursor paging with no duplicates / gaps
 *   - limit + cursor validation (400s)
 *   - summary parity with GET /providers/application/status
 *   - Reads never mutate the history table
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  availabilityTable,
  db,
  providerApplicationsTable,
  providerApplicationSubmissionsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "mc5-history-password";
const suffix = `${process.pid}-${Date.now()}`;
const PRIVATE_PHRASE = `reviewer-private-secret-${suffix}`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody }> {
  const { token, ...rest } = options;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((rest.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await response.text();
  let body: JsonBody;
  try {
    body = JSON.parse(text) as JsonBody;
  } catch {
    body = { error: `Non-JSON response: ${text.slice(0, 200)}` };
  }
  return { status: response.status, body };
}

async function register(
  email: string,
  roleIntent: "client" | "provider",
): Promise<{ token: string; user: JsonBody }> {
  const result = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "MC5",
      lastName: roleIntent === "provider" ? "Provider" : "Client",
      role: roleIntent,
      roleIntent,
    }),
  });
  assert.equal(
    result.status,
    201,
    `Registration failed: ${JSON.stringify(result.body)}`,
  );
  return {
    token: result.body["token"] as string,
    user: result.body["user"] as JsonBody,
  };
}

async function fetchApplication(userId: number) {
  const [row] = await db
    .select({
      id: providerApplicationsTable.id,
      providerProfileId: providerApplicationsTable.providerProfileId,
    })
    .from(providerApplicationsTable)
    .where(eq(providerApplicationsTable.userId, userId))
    .limit(1);
  assert.ok(row, "provider application row must exist after registration");
  return row;
}

async function fillDraftForSubmission(token: string, cityLabel: string) {
  const result = await apiFetch("/providers/application", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      title: "Mobile foot-care specialist",
      bio: "Professional in-home foot care with a calm, client-first approach.",
      city: cityLabel,
      yearsExperience: 5,
    }),
  });
  assert.equal(
    result.status,
    200,
    `PATCH draft failed: ${JSON.stringify(result.body)}`,
  );
}

async function seedSubmissionPrerequisites(providerProfileId: number) {
  await db.insert(servicesTable).values({
    providerId: providerProfileId,
    title: "In-home foot care visit",
    durationMinutes: 60,
    priceCents: 12000,
    category: "foot_care",
    isActive: true,
  });
  await db.insert(availabilityTable).values({
    providerId: providerProfileId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
  });
  await db.insert(verificationDocsTable).values({
    providerId: providerProfileId,
    docType: "license",
    fileName: `mc5-seed-license-${suffix}.pdf`,
  });
}

async function markRejected(
  applicationId: number,
  rejectionReason: string,
  reviewerNotes: string,
  reviewerId: number,
) {
  await db
    .update(providerApplicationsTable)
    .set({
      status: "rejected",
      rejectionReason,
      reviewerNotes,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      updatedAt: new Date(),
    })
    .where(eq(providerApplicationsTable.id, applicationId));
}

async function insertSubmissionDirect(
  applicationId: number,
  reviewerId: number,
  rejectionReason: string,
  createdAt: Date,
) {
  await db.insert(providerApplicationSubmissionsTable).values({
    providerApplicationId: applicationId,
    outcome: "rejected",
    submittedAt: createdAt,
    reviewedAt: createdAt,
    reviewedBy: reviewerId,
    reviewerNotes: PRIVATE_PHRASE,
    rejectionReason,
    createdAt,
  });
}

async function countSubmissionRows(applicationId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerApplicationSubmissionsTable)
    .where(
      eq(providerApplicationSubmissionsTable.providerApplicationId, applicationId),
    );
  return rows[0]?.count ?? 0;
}

/** Drive one full rejection cycle (submit → external reject → owner reset). */
async function runRejectionCycle(
  token: string,
  applicationId: number,
  rejectionReason: string,
  reviewerId: number,
) {
  const submit = await apiFetch("/providers/application/submit", {
    method: "POST",
    token,
  });
  assert.equal(
    submit.status,
    200,
    `submit failed: ${JSON.stringify(submit.body)}`,
  );
  await markRejected(applicationId, rejectionReason, PRIVATE_PHRASE, reviewerId);
  const reset = await apiFetch("/providers/application/reset", {
    method: "POST",
    token,
  });
  assert.equal(reset.status, 200, `reset failed: ${JSON.stringify(reset.body)}`);
}

function submissions(body: JsonBody): JsonBody[] {
  return body["submissions"] as JsonBody[];
}
function pagination(body: JsonBody): JsonBody {
  return body["pagination"] as JsonBody;
}
function summary(body: JsonBody): JsonBody {
  return body["summary"] as JsonBody;
}

describe("MC5 — Provider submission-history API", () => {
  let providerA: { token: string; user: JsonBody };
  let providerB: { token: string; user: JsonBody };
  let providerZero: { token: string; user: JsonBody };
  let clientC: { token: string; user: JsonBody };
  let appAId: number;
  let appBId: number;
  let profileAId: number;
  let profileBId: number;
  let adminUserId: number;
  const createdUserIds: number[] = [];

  before(async () => {
    const [pa, pb, pz, cc] = await Promise.all([
      register(`mc5-provider-a-${suffix}@example.test`, "provider"),
      register(`mc5-provider-b-${suffix}@example.test`, "provider"),
      register(`mc5-provider-zero-${suffix}@example.test`, "provider"),
      register(`mc5-client-c-${suffix}@example.test`, "client"),
    ]);
    providerA = pa;
    providerB = pb;
    providerZero = pz;
    clientC = cc;
    for (const s of [providerA, providerB, providerZero, clientC]) {
      createdUserIds.push(s.user["id"] as number);
    }

    const [adminRow] = await db
      .insert(usersTable)
      .values({
        email: `mc5-admin-${suffix}@example.test`,
        passwordHash: "unused-hash-mc5",
        role: "admin",
        firstName: "MC5",
        lastName: "Admin",
        isActive: true,
      })
      .returning({ id: usersTable.id });
    assert.ok(adminRow);
    adminUserId = adminRow.id;
    createdUserIds.push(adminUserId);

    const aApp = await fetchApplication(providerA.user["id"] as number);
    const bApp = await fetchApplication(providerB.user["id"] as number);
    appAId = aApp.id;
    appBId = bApp.id;
    profileAId = aApp.providerProfileId;
    profileBId = bApp.providerProfileId;

    await fillDraftForSubmission(providerA.token, "Toronto");
    await fillDraftForSubmission(providerB.token, "Ottawa");
    await seedSubmissionPrerequisites(profileAId);
    await seedSubmissionPrerequisites(profileBId);

    // Provider A: three real closed rejection cycles (oldest → newest).
    await runRejectionCycle(providerA.token, appAId, "reason-1", adminUserId);
    await runRejectionCycle(providerA.token, appAId, "reason-2", adminUserId);
    await runRejectionCycle(providerA.token, appAId, "reason-3", adminUserId);

    // Provider B: three rows sharing an identical created_at, inserted directly,
    // to exercise the id tie-breaker deterministically.
    const tie = new Date("2025-03-03T03:03:03.000Z");
    await insertSubmissionDirect(appBId, adminUserId, "b-1", tie);
    await insertSubmissionDirect(appBId, adminUserId, "b-2", tie);
    await insertSubmissionDirect(appBId, adminUserId, "b-3", tie);
  });

  after(async () => {
    for (const userId of createdUserIds) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  });

  it("case 1 — 401 when unauthenticated", async () => {
    const res = await apiFetch("/providers/application/submissions");
    assert.equal(res.status, 401);
  });

  it("case 2 — 403 for a client (non-provider member)", async () => {
    const res = await apiFetch("/providers/application/submissions", {
      token: clientC.token,
    });
    assert.equal(res.status, 403);
    assert.match(String(res.body["error"]), /provider onboarding access/i);
  });

  it("case 3 — 200 owner with zero history returns empty page + valid summary", async () => {
    const res = await apiFetch("/providers/application/submissions", {
      token: providerZero.token,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(submissions(res.body), []);
    const page = pagination(res.body);
    assert.equal(page["limit"], 20);
    assert.equal(page["hasMore"], false);
    assert.equal(page["nextCursor"], null);
    const view = summary(res.body);
    assert.equal(view["submissionCount"], 0);
    assert.equal(view["latestSubmission"], null);
    assert.ok(view["applicationId"], "summary exposes the applicationId");
  });

  it("case 4 — cross-provider isolation: B never sees A's rows and vice versa", async () => {
    const aRes = await apiFetch(
      "/providers/application/submissions?limit=50",
      { token: providerA.token },
    );
    const bRes = await apiFetch(
      "/providers/application/submissions?limit=50",
      { token: providerB.token },
    );
    assert.equal(aRes.status, 200);
    assert.equal(bRes.status, 200);
    const aIds = new Set(submissions(aRes.body).map((r) => r["id"] as number));
    const bIds = new Set(submissions(bRes.body).map((r) => r["id"] as number));
    assert.equal(aIds.size, 3);
    assert.equal(bIds.size, 3);
    for (const id of bIds) {
      assert.equal(aIds.has(id), false, "A must not expose B's rows");
    }
    for (const id of aIds) {
      assert.equal(bIds.has(id), false, "B must not expose A's rows");
    }
  });

  it("case 5 — three cycles returned newest-first", async () => {
    const res = await apiFetch("/providers/application/submissions", {
      token: providerA.token,
    });
    assert.equal(res.status, 200);
    const reasons = submissions(res.body).map((r) => r["rejectionReason"]);
    assert.deepEqual(reasons, ["reason-3", "reason-2", "reason-1"]);
  });

  it("case 6 — limit=2 paging: page1 + page2 == full set, no gaps or overlap", async () => {
    const page1 = await apiFetch(
      "/providers/application/submissions?limit=2",
      { token: providerA.token },
    );
    assert.equal(page1.status, 200);
    assert.equal(submissions(page1.body).length, 2);
    assert.equal(pagination(page1.body)["hasMore"], true);
    const cursor = pagination(page1.body)["nextCursor"] as string;
    assert.ok(cursor, "page1 returns a nextCursor when more rows remain");

    const page2 = await apiFetch(
      `/providers/application/submissions?limit=2&cursor=${encodeURIComponent(cursor)}`,
      { token: providerA.token },
    );
    assert.equal(page2.status, 200);
    assert.equal(submissions(page2.body).length, 1);
    assert.equal(pagination(page2.body)["hasMore"], false);
    assert.equal(pagination(page2.body)["nextCursor"], null);

    const combined = [
      ...submissions(page1.body).map((r) => r["id"] as number),
      ...submissions(page2.body).map((r) => r["id"] as number),
    ];
    assert.equal(new Set(combined).size, 3, "no duplicates across pages");

    const full = await apiFetch(
      "/providers/application/submissions?limit=50",
      { token: providerA.token },
    );
    const fullIds = submissions(full.body).map((r) => r["id"] as number);
    assert.deepEqual(combined, fullIds, "paged order matches the full ordering");
  });

  it("case 7 — identical created_at: id tie-breaker keeps order deterministic (id DESC)", async () => {
    const res = await apiFetch(
      "/providers/application/submissions?limit=50",
      { token: providerB.token },
    );
    assert.equal(res.status, 200);
    const ids = submissions(res.body).map((r) => r["id"] as number);
    const sortedDesc = [...ids].sort((a, b) => b - a);
    assert.deepEqual(ids, sortedDesc, "rows with equal created_at order by id DESC");
  });

  it("case 8 — invalid limit and malformed cursor return 400", async () => {
    for (const bad of ["0", "-1", "51", "abc", "1.5"]) {
      const res = await apiFetch(
        `/providers/application/submissions?limit=${bad}`,
        { token: providerA.token },
      );
      assert.equal(res.status, 400, `limit=${bad} must be 400`);
    }
    const badCursor = await apiFetch(
      "/providers/application/submissions?cursor=zzzz-not-a-valid-cursor",
      { token: providerA.token },
    );
    assert.equal(badCursor.status, 400);
  });

  it("case 9 — reviewerNotes key and private phrase never appear (incl. paged)", async () => {
    const full = await apiFetch(
      "/providers/application/submissions?limit=50",
      { token: providerA.token },
    );
    assert.equal(JSON.stringify(full.body).includes("reviewerNotes"), false);
    assert.equal(JSON.stringify(full.body).includes(PRIVATE_PHRASE), false);

    const paged = await apiFetch(
      "/providers/application/submissions?limit=1",
      { token: providerA.token },
    );
    assert.equal(JSON.stringify(paged.body).includes("reviewerNotes"), false);
    assert.equal(JSON.stringify(paged.body).includes(PRIVATE_PHRASE), false);
  });

  it("case 10 — summary matches GET /providers/application/status", async () => {
    const statusRes = await apiFetch("/providers/application/status", {
      token: providerA.token,
    });
    assert.equal(statusRes.status, 200);
    const statusView = statusRes.body["status"] as JsonBody;

    const historyRes = await apiFetch("/providers/application/submissions", {
      token: providerA.token,
    });
    const view = summary(historyRes.body);

    assert.equal(view["submissionCount"], statusView["submissionCount"]);
    assert.deepEqual(view["latestSubmission"], statusView["latestSubmission"]);
  });

  it("case 11 — reads and paging never create history rows", async () => {
    const before = await countSubmissionRows(appAId);
    await apiFetch("/providers/application/submissions", { token: providerA.token });
    await apiFetch("/providers/application/submissions?limit=1", {
      token: providerA.token,
    });
    const page1 = await apiFetch("/providers/application/submissions?limit=2", {
      token: providerA.token,
    });
    const cursor = pagination(page1.body)["nextCursor"] as string;
    await apiFetch(
      `/providers/application/submissions?limit=2&cursor=${encodeURIComponent(cursor)}`,
      { token: providerA.token },
    );
    const after = await countSubmissionRows(appAId);
    assert.equal(after, before, "history is append-only via reset, never via reads");
  });
});
