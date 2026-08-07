/**
 * Phase 1 — Rejected-provider resubmission (server state transitions only).
 *
 * Prerequisites: API server must be running with the local test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-resubmission
 *
 * Scope:
 *   - rejected → draft transition (POST /providers/application/reset)
 *   - draft → under_review resubmission (POST /providers/application/submit)
 *   - Immutable prior submission history preserved in previousSubmissions
 *   - Owner-only access
 *   - Idempotent repeated requests
 *   - Draft/rejected/under_review remain blocked from provider operations
 *   - Approved-provider authorization unchanged
 *   - Provider-private reviewerNotes never leak to application responses
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
const PASSWORD = "phase1-resubmission-password";
const suffix = `${process.pid}-${Date.now()}`;

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
      firstName: "Phase1",
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

function application(body: JsonBody): JsonBody {
  return body["application"] as JsonBody;
}

function applicationStatus(body: JsonBody): string {
  return application(body)["status"] as string;
}

function applicationId(body: JsonBody): number {
  return application(body)["id"] as number;
}

function previousSubmissions(body: JsonBody): JsonBody[] {
  return application(body)["previousSubmissions"] as JsonBody[];
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
  assert.equal(result.status, 200, `PATCH draft failed: ${JSON.stringify(result.body)}`);
}

/**
 * Server-side `computeCompletion` requires services, availability, and a
 * verification document in addition to the profile fields before submission
 * can succeed. Seed those directly for the provider's profile so submit can
 * transition draft → under_review. These are integration prerequisites; the
 * slice under test is the reset/resubmit transition itself, not onboarding
 * step wiring.
 */
async function seedSubmissionPrerequisites(providerProfileId: number) {
  await db
    .insert(servicesTable)
    .values({
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
    fileName: `phase1-seed-license-${suffix}.pdf`,
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

async function countSubmissionRows(applicationId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerApplicationSubmissionsTable)
    .where(
      eq(providerApplicationSubmissionsTable.providerApplicationId, applicationId),
    );
  return rows[0]?.count ?? 0;
}

describe("Phase 1 — Rejected-provider resubmission", () => {
  let providerA: { token: string; user: JsonBody };
  let providerB: { token: string; user: JsonBody };
  let clientC: { token: string; user: JsonBody };
  let appAId: number;
  let appBId: number;
  let profileAId: number;
  let profileBId: number;
  const createdUserIds: number[] = [];
  let adminUserId: number;

  before(async () => {
    // Two provider onboardees and one client (used for owner-scoping checks).
    const [pa, pb, cc] = await Promise.all([
      register(`p1-provider-a-${suffix}@example.test`, "provider"),
      register(`p1-provider-b-${suffix}@example.test`, "provider"),
      register(`p1-client-c-${suffix}@example.test`, "client"),
    ]);
    providerA = pa;
    providerB = pb;
    clientC = cc;
    for (const s of [providerA, providerB, clientC]) {
      createdUserIds.push(s.user["id"] as number);
    }

    // Create a lightweight admin user to satisfy reviewedBy FK for snapshotting.
    const [adminRow] = await db
      .insert(usersTable)
      .values({
        email: `p1-admin-${suffix}@example.test`,
        passwordHash: "unused-hash-phase1",
        role: "admin",
        firstName: "Phase1",
        lastName: "Admin",
        isActive: true,
      })
      .returning({ id: usersTable.id });
    assert.ok(adminRow);
    adminUserId = adminRow.id;
    createdUserIds.push(adminUserId);

    const [aApp] = await db
      .select({
        id: providerApplicationsTable.id,
        providerProfileId: providerApplicationsTable.providerProfileId,
      })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, providerA.user["id"] as number))
      .limit(1);
    const [bApp] = await db
      .select({
        id: providerApplicationsTable.id,
        providerProfileId: providerApplicationsTable.providerProfileId,
      })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, providerB.user["id"] as number))
      .limit(1);
    assert.ok(aApp);
    assert.ok(bApp);
    appAId = aApp.id;
    appBId = bApp.id;
    profileAId = aApp.providerProfileId;
    profileBId = bApp.providerProfileId;

    // Seed profile + completion prerequisites so submit → under_review succeeds.
    await fillDraftForSubmission(providerA.token, "Toronto");
    await fillDraftForSubmission(providerB.token, "Ottawa");
    await seedSubmissionPrerequisites(profileAId);
    await seedSubmissionPrerequisites(profileBId);
  });

  after(async () => {
    // Cascade-deletes provider profiles, applications, and submission history.
    for (const userId of createdUserIds) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  });

  it("blocks direct submit from rejected and requires an explicit reset", async () => {
    // Owner submits, admin externally rejects.
    const submit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(submit.status, 200);
    assert.equal(applicationStatus(submit.body), "under_review");
    await markRejected(appAId, "Missing insurance", "internal: called ref, no answer", adminUserId);

    const directResubmit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(directResubmit.status, 409);
    assert.match(
      String(directResubmit.body["error"]),
      /reset the rejected application/i,
    );

    // Provider operations remain blocked while rejected.
    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 403);
  });

  it("blocks direct PATCH edits from rejected and requires an explicit reset", async () => {
    const patch = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerA.token,
      body: JSON.stringify({ title: "Attempted edit while rejected" }),
    });
    assert.equal(patch.status, 409);
    assert.match(String(patch.body["error"]), /reset the rejected application/i);
  });

  it("exposes rejectionReason to the owner while hiding reviewerNotes", async () => {
    const view = await apiFetch("/providers/application", {
      token: providerA.token,
    });
    assert.equal(view.status, 200);
    assert.equal(applicationStatus(view.body), "rejected");
    assert.equal(application(view.body)["rejectionReason"], "Missing insurance");
    // Private reviewer notes must NEVER surface in application responses.
    assert.equal(
      JSON.stringify(view.body).includes("reviewerNotes"),
      false,
      "reviewerNotes must not appear in owner-scoped application responses",
    );
    // History is empty until the cycle is closed via reset.
    assert.deepEqual(previousSubmissions(view.body), []);
  });

  it("owner-only access — client and other provider cannot reset provider A's application", async () => {
    const clientAttempt = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: clientC.token,
    });
    // Client has no provider membership — assertProviderMember denies.
    assert.equal(clientAttempt.status, 403);

    // Other provider's reset operates on THEIR own application, not provider A's.
    const otherResetView = await apiFetch("/providers/application", {
      token: providerB.token,
    });
    assert.equal(otherResetView.status, 200);
    assert.equal(applicationId(otherResetView.body), appBId);

    // Provider A's application remains rejected — untouched.
    const stillRejected = await apiFetch("/providers/application", {
      token: providerA.token,
    });
    assert.equal(applicationStatus(stillRejected.body), "rejected");
  });

  it("rejected → draft: snapshots the cycle into immutable history and clears the main row", async () => {
    assert.equal(await countSubmissionRows(appAId), 0);
    const reset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(reset.status, 200);
    assert.equal(applicationStatus(reset.body), "draft");
    assert.equal(application(reset.body)["submittedAt"], null);
    assert.equal(application(reset.body)["reviewedAt"], null);
    assert.equal(application(reset.body)["rejectionReason"], null);
    assert.equal(application(reset.body)["currentStep"], "profile");

    // History row was written.
    const historyCount = await countSubmissionRows(appAId);
    assert.equal(historyCount, 1);

    const history = previousSubmissions(reset.body);
    assert.equal(history.length, 1);
    const entry = history[0]!;
    assert.equal(entry["outcome"], "rejected");
    assert.equal(entry["rejectionReason"], "Missing insurance");
    assert.ok(entry["submittedAt"], "submittedAt preserved in history");
    assert.ok(entry["reviewedAt"], "reviewedAt preserved in history");
    // Public snapshot fields only — reviewerNotes never surfaces.
    assert.equal(
      JSON.stringify(entry).includes("reviewerNotes"),
      false,
      "reviewerNotes must not appear in history payloads",
    );
  });

  it("is idempotent when called on an application that is already draft", async () => {
    const historyBefore = await countSubmissionRows(appAId);
    const first = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    const second = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(applicationStatus(first.body), "draft");
    assert.equal(applicationStatus(second.body), "draft");
    // No additional history rows written on no-op resets.
    assert.equal(await countSubmissionRows(appAId), historyBefore);
  });

  it("is safe under concurrent reset requests on a rejected application", async () => {
    // Set provider B to rejected then fire five concurrent resets.
    await markRejected(appBId, "Missing service area", "internal: repeat offender", adminUserId);
    const historyBefore = await countSubmissionRows(appBId);
    const requests = await Promise.all(
      Array.from({ length: 5 }, () =>
        apiFetch("/providers/application/reset", {
          method: "POST",
          token: providerB.token,
        }),
      ),
    );
    assert.ok(
      requests.every((r) => r.status === 200),
      `all resets should return 200: ${requests.map((r) => r.status).join(",")}`,
    );
    for (const r of requests) {
      assert.equal(applicationStatus(r.body), "draft");
    }
    // Exactly one history row was written despite five concurrent requests.
    const historyAfter = await countSubmissionRows(appBId);
    assert.equal(
      historyAfter - historyBefore,
      1,
      "concurrent resets must produce exactly one history entry",
    );
  });

  it("draft → under_review resubmission works after reset", async () => {
    const submit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(submit.status, 200);
    assert.equal(applicationStatus(submit.body), "under_review");
    // Provider operations still blocked while under_review.
    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 403);

    // Prior history remains visible on the reopened cycle.
    const history = previousSubmissions(submit.body);
    assert.equal(history.length, 1);
    assert.equal(history[0]!["outcome"], "rejected");
  });

  it("accumulates one immutable history entry per completed rejection cycle", async () => {
    // Second cycle: reject, then reset again.
    await markRejected(appAId, "Please add insurance number", "internal: still no proof", adminUserId);
    const view = await apiFetch("/providers/application", { token: providerA.token });
    assert.equal(applicationStatus(view.body), "rejected");
    assert.equal(application(view.body)["rejectionReason"], "Please add insurance number");
    // History still shows only the first cycle at this point.
    assert.equal(previousSubmissions(view.body).length, 1);

    const reset2 = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(reset2.status, 200);
    const history = previousSubmissions(reset2.body);
    assert.equal(history.length, 2, "second reset appends a second history row");
    assert.equal(history[0]!["rejectionReason"], "Missing insurance");
    assert.equal(history[1]!["rejectionReason"], "Please add insurance number");
    assert.equal(await countSubmissionRows(appAId), 2);
  });

  it("rejects reset when application is not resettable (under_review, approved, suspended)", async () => {
    // Under review
    await fillDraftForSubmission(providerA.token, "Toronto");
    const submit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(applicationStatus(submit.body), "under_review");
    const underReviewReset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(underReviewReset.status, 409);

    // Approved
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, appAId));
    const approvedReset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(approvedReset.status, 409);

    // Suspended
    await db
      .update(providerApplicationsTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, appAId));
    const suspendedReset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(suspendedReset.status, 409);

    // Provider operations remain blocked for all of those states (regression).
    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 403);
  });

  it("keeps approved-provider authorization unchanged when profile and app are approved", async () => {
    // Restore approved state and approve the underlying profile.
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, appAId));
    const [profileRow] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, providerA.user["id"] as number))
      .limit(1);
    assert.ok(profileRow);
    await db
      .update(providerProfilesTable)
      .set({
        verificationStatus: "approved",
        title: "Approved provider title",
        bio: "Bio for authorization regression.",
        city: "Toronto",
        profileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(providerProfilesTable.id, profileRow.id));

    const providerOps = await apiFetch("/providers/me", { token: providerA.token });
    assert.equal(providerOps.status, 200);
  });
});
