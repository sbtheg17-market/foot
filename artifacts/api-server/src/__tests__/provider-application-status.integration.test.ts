/**
 * Phase 1 micro-checkpoint 2 — Rejection-reason and status API (server-only).
 *
 * Prerequisites: API server running with the local test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-status
 *
 * Scope:
 *   - GET /providers/application/status returns compact owner-scoped view
 *   - Exposes status, rejectionReason, submissionCount, latestSubmission
 *   - Server-derived nextAction + canEdit/canReset/canResubmit flags
 *   - Owner-only access
 *   - Reviewer-private reviewerNotes never surfaces in responses
 *   - Stable status codes: 200 owner, 403 non-provider-member, 404 no app
 *   - Does not change provider operations authorization
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
  usersTable,
  verificationDocsTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "phase1-mc2-status-password";
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
      firstName: "MC2",
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

function statusView(body: JsonBody): JsonBody {
  return body["status"] as JsonBody;
}

async function fillDraft(token: string, cityLabel: string) {
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
    fileName: `phase1-mc2-license-${suffix}.pdf`,
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

describe("Phase 1 MC2 — Provider application status API", () => {
  let providerA: { token: string; user: JsonBody };
  let providerB: { token: string; user: JsonBody };
  let clientC: { token: string; user: JsonBody };
  let appAId: number;
  let profileAId: number;
  const createdUserIds: number[] = [];
  let adminUserId: number;

  before(async () => {
    const [pa, pb, cc] = await Promise.all([
      register(`mc2-status-a-${suffix}@example.test`, "provider"),
      register(`mc2-status-b-${suffix}@example.test`, "provider"),
      register(`mc2-status-c-${suffix}@example.test`, "client"),
    ]);
    providerA = pa;
    providerB = pb;
    clientC = cc;
    for (const s of [providerA, providerB, clientC]) {
      createdUserIds.push(s.user["id"] as number);
    }

    const [adminRow] = await db
      .insert(usersTable)
      .values({
        email: `mc2-status-admin-${suffix}@example.test`,
        passwordHash: "unused-hash-mc2",
        role: "admin",
        firstName: "MC2",
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
    assert.ok(aApp);
    appAId = aApp.id;
    profileAId = aApp.providerProfileId;

    await fillDraft(providerA.token, "Toronto");
    await seedSubmissionPrerequisites(profileAId);
  });

  after(async () => {
    for (const userId of createdUserIds) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  });

  it("returns a compact status view for a fresh draft, owner-only", async () => {
    const result = await apiFetch("/providers/application/status", {
      token: providerA.token,
    });
    assert.equal(result.status, 200);
    const view = statusView(result.body);
    assert.equal(view["status"], "draft");
    assert.equal(view["applicationId"], appAId);
    assert.equal(view["rejectionReason"], null);
    assert.equal(view["submittedAt"], null);
    assert.equal(view["reviewedAt"], null);
    assert.equal(view["submissionCount"], 0);
    assert.equal(view["latestSubmission"], null);
    assert.equal(view["nextAction"], "resume_draft");
    assert.equal(view["canEdit"], true);
    assert.equal(view["canReset"], false);
    assert.equal(view["canResubmit"], true);
  });

  it("denies non-provider-member access with 403 and unauthenticated with 401", async () => {
    const clientAttempt = await apiFetch("/providers/application/status", {
      token: clientC.token,
    });
    assert.equal(clientAttempt.status, 403);

    const unauthed = await apiFetch("/providers/application/status");
    assert.equal(unauthed.status, 401);
  });

  it("scopes the response to the authenticated owner (cross-provider isolation)", async () => {
    const bStatus = await apiFetch("/providers/application/status", {
      token: providerB.token,
    });
    assert.equal(bStatus.status, 200);
    const bView = statusView(bStatus.body);
    // Provider B's application id must NOT equal Provider A's.
    assert.notEqual(bView["applicationId"], appAId);
    assert.equal(bView["status"], "draft");
  });

  it("returns under_review with wait_for_review after submit; no history yet", async () => {
    const submit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(submit.status, 200, `submit failed: ${JSON.stringify(submit.body)}`);

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["status"], "under_review");
    assert.equal(view["nextAction"], "wait_for_review");
    assert.equal(view["canEdit"], false);
    assert.equal(view["canReset"], false);
    assert.equal(view["canResubmit"], false);
    assert.equal(view["submissionCount"], 0);
    assert.equal(view["latestSubmission"], null);
    assert.ok(view["submittedAt"], "current-cycle submittedAt must be present");
  });

  it("returns rejected view with rejectionReason and reset_to_draft when reviewer flags rejection", async () => {
    await markRejected(
      appAId,
      "Please attach a valid insurance document.",
      "internal: called reference, unresolved",
      adminUserId,
    );

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["status"], "rejected");
    assert.equal(view["rejectionReason"], "Please attach a valid insurance document.");
    assert.equal(view["nextAction"], "reset_to_draft");
    assert.equal(view["canEdit"], false);
    assert.equal(view["canReset"], true);
    assert.equal(view["canResubmit"], false);
    assert.ok(view["reviewedAt"], "reviewedAt is set on rejection");
    assert.equal(view["submissionCount"], 0, "history not yet snapshotted until reset");

    // Privacy: reviewerNotes must not surface anywhere in the response body.
    assert.equal(
      JSON.stringify(view).includes("reviewerNotes"),
      false,
      "reviewerNotes must not appear in status view",
    );
    assert.equal(
      JSON.stringify(view).includes("called reference"),
      false,
      "reviewer-private content must not leak through the status endpoint",
    );
  });

  it("after reset, submissionCount and latestSubmission reflect the immutable history", async () => {
    const reset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(reset.status, 200);

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["status"], "draft");
    assert.equal(view["rejectionReason"], null, "current-row reason cleared on reset");
    assert.equal(view["submittedAt"], null);
    assert.equal(view["reviewedAt"], null);
    assert.equal(view["submissionCount"], 1);
    assert.equal(view["nextAction"], "resume_draft");
    assert.equal(view["canEdit"], true);
    assert.equal(view["canReset"], false);
    assert.equal(view["canResubmit"], true);

    const latest = view["latestSubmission"] as JsonBody;
    assert.ok(latest, "latestSubmission is populated after first reset");
    assert.equal(latest["outcome"], "rejected");
    assert.equal(latest["rejectionReason"], "Please attach a valid insurance document.");
    // Even the historical snapshot in status must not carry reviewerNotes.
    assert.equal(
      JSON.stringify(latest).includes("reviewerNotes"),
      false,
      "reviewerNotes must not appear in latestSubmission payload",
    );
  });

  it("accumulates submissionCount across multiple rejection cycles", async () => {
    // Second cycle: resubmit, reject, reset.
    const submit2 = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(submit2.status, 200);
    await markRejected(appAId, "Second-cycle reason", "internal: still incomplete", adminUserId);
    const reset2 = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerA.token,
    });
    assert.equal(reset2.status, 200);

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["submissionCount"], 2);
    const latest = view["latestSubmission"] as JsonBody;
    assert.equal(latest["rejectionReason"], "Second-cycle reason");
  });

  it("returns provider_operations_available for approved applications (auth boundary unchanged)", async () => {
    // Flip to approved via DB (admin-approve flow is out of scope for this slice).
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, appAId));
    await db
      .update(providerProfilesTable)
      .set({
        verificationStatus: "approved",
        title: "Approved title",
        bio: "Bio for MC2 approved test.",
        city: "Toronto",
        profileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(providerProfilesTable.id, profileAId));

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["status"], "approved");
    assert.equal(view["nextAction"], "provider_operations_available");
    assert.equal(view["canEdit"], false);
    assert.equal(view["canReset"], false);
    assert.equal(view["canResubmit"], false);

    // Regression: approved-provider authorization still passes (unchanged by MC2).
    const providerOps = await apiFetch("/providers/me", { token: providerA.token });
    assert.equal(providerOps.status, 200);
  });

  it("returns contact_support for suspended and hides can-* actions", async () => {
    await db
      .update(providerApplicationsTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, appAId));

    const view = statusView(
      (await apiFetch("/providers/application/status", { token: providerA.token })).body,
    );
    assert.equal(view["status"], "suspended");
    assert.equal(view["nextAction"], "contact_support");
    assert.equal(view["canEdit"], false);
    assert.equal(view["canReset"], false);
    assert.equal(view["canResubmit"], false);

    // Provider operations remain blocked for suspended (auth unchanged).
    const providerOps = await apiFetch("/providers/me", { token: providerA.token });
    assert.equal(providerOps.status, 403);
  });
});
