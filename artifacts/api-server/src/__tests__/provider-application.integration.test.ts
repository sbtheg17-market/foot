/**
 * Phase 4 provider-application integration coverage.
 *
 * Prerequisites: API server must be running with the development database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:provider-application
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "phase4-test-password";
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
      ...(rest.headers as Record<string, string> ?? {}),
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
      firstName: "Phase",
      lastName: roleIntent === "provider" ? "Provider" : "Client",
      role: roleIntent,
      roleIntent,
    }),
  });
  assert.equal(result.status, 201, `Registration failed: ${JSON.stringify(result.body)}`);
  return {
    token: result.body["token"] as string,
    user: result.body["user"] as JsonBody,
  };
}

function applicationId(body: JsonBody): number {
  return ((body["application"] as JsonBody)["id"] as number);
}

function applicationStatus(body: JsonBody): string {
  return ((body["application"] as JsonBody)["status"] as string);
}

function applicationProfile(body: JsonBody): JsonBody {
  return (body["application"] as JsonBody)["profile"] as JsonBody;
}

async function countRoleRows(userId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountRolesTable)
    .where(eq(accountRolesTable.userId, userId));
  return rows[0]?.count ?? 0;
}

async function countProfileRows(userId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId));
  return rows[0]?.count ?? 0;
}

async function countApplicationRows(userId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerApplicationsTable)
    .where(eq(providerApplicationsTable.userId, userId));
  return rows[0]?.count ?? 0;
}

describe("Phase 4 provider application lifecycle", () => {
  let client: { token: string; user: JsonBody };
  let providerA: { token: string; user: JsonBody };
  let providerB: { token: string; user: JsonBody };
  let providerAProfileId: number;
  let providerAApplicationId: number;
  let providerBApplicationId: number;
  const createdUserIds: number[] = [];

  before(async () => {
    const [createdClient, createdProviderA, createdProviderB] = await Promise.all([
      register(`phase4-client-${suffix}@example.test`, "client"),
      register(`phase4-provider-a-${suffix}@example.test`, "provider"),
      register(`phase4-provider-b-${suffix}@example.test`, "provider"),
    ]);
    client = createdClient;
    providerA = createdProviderA;
    providerB = createdProviderB;

    for (const session of [client, providerA, providerB]) {
      createdUserIds.push(session.user["id"] as number);
    }

    const [clientProfile] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, client.user["id"] as number))
      .limit(1);
    assert.equal(clientProfile, undefined);

    const [aProfile] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, providerA.user["id"] as number))
      .limit(1);
    const [aApplication] = await db
      .select({ id: providerApplicationsTable.id, providerProfileId: providerApplicationsTable.providerProfileId })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, providerA.user["id"] as number))
      .limit(1);
    const [bApplication] = await db
      .select({ id: providerApplicationsTable.id })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, providerB.user["id"] as number))
      .limit(1);

    assert.ok(aProfile);
    assert.ok(aApplication);
    assert.ok(bApplication);
    providerAProfileId = aProfile.id;
    providerAApplicationId = aApplication.id;
    providerBApplicationId = bApplication.id;
  });

  after(async () => {
    for (const userId of createdUserIds) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  });

  it("creates provider signup onboarding state without granting provider operations", async () => {
    const result = await apiFetch("/providers/me", { token: providerA.token });
    assert.equal(result.status, 403);

    const application = await apiFetch("/providers/application", { token: providerA.token });
    assert.equal(application.status, 200);
    assert.equal(applicationStatus(application.body), "draft");
    assert.equal(JSON.stringify(application.body).includes("reviewerNotes"), false);
  });

  it("keeps client-controlled role intent from escalating privileges", async () => {
    const registeredAsClient = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: `phase4-role-intent-${suffix}@example.test`,
        password: PASSWORD,
        firstName: "Role",
        lastName: "Intent",
        role: "client",
        roleIntent: "client",
      }),
    });
    assert.equal(registeredAsClient.status, 201);
    const token = registeredAsClient.body["token"] as string;
    const user = registeredAsClient.body["user"] as JsonBody;
    createdUserIds.push(user["id"] as number);

    assert.equal(user["role"], "client");
    assert.deepEqual(user["roles"], ["client"]);
    const providerPortal = await apiFetch("/providers/me", { token });
    assert.equal(providerPortal.status, 403);

    const start = await apiFetch("/providers/application", {
      method: "POST",
      token,
    });
    assert.equal(start.status, 201);
    assert.equal(applicationStatus(start.body), "draft");

    const me = await apiFetch("/auth/me", { token });
    assert.equal(me.status, 200);
    const confirmed = me.body["user"] as JsonBody;
    assert.equal(confirmed["role"], "client");
    assert.equal(confirmed["activeRole"], "client");
    assert.deepEqual((confirmed["roles"] as string[]).sort(), ["client", "provider"]);
    assert.equal((confirmed["providerApplication"] as JsonBody)["status"], "draft");
    assert.equal((await apiFetch("/bookings", { token })).status, 200);
    assert.equal((await apiFetch("/providers/me", { token })).status, 403);
  });

  it("starts existing-client onboarding idempotently, including concurrent requests", async () => {
    const requests = await Promise.all(
      Array.from({ length: 5 }, () =>
        apiFetch("/providers/application", { method: "POST", token: client.token }),
      ),
    );
    assert.ok(requests.every((result) => result.status === 200 || result.status === 201));
    const ids = new Set(requests.map((result) => applicationId(result.body)));
    assert.equal(ids.size, 1);

    const clientId = client.user["id"] as number;
    assert.equal(await countRoleRows(clientId), 2);
    assert.equal(await countProfileRows(clientId), 1);
    assert.equal(await countApplicationRows(clientId), 1);

    const [profile] = await db
      .select({ id: providerProfilesTable.id })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, clientId))
      .limit(1);
    assert.ok(profile);
    const me = await apiFetch("/auth/me", { token: client.token });
    assert.equal(me.status, 200);
    const user = me.body["user"] as JsonBody;
    assert.equal(user["role"], "client");
    assert.equal(user["activeRole"], "client");
    assert.deepEqual((user["roles"] as string[]).sort(), ["client", "provider"]);
    assert.equal((await apiFetch("/bookings", { token: client.token })).status, 200);
    assert.equal((await apiFetch("/providers/me", { token: client.token })).status, 403);
  });

  it("keeps application reads and writes scoped to the authenticated owner", async () => {
    const aRead = await apiFetch(`/providers/application?userId=${providerB.user["id"]}`, {
      token: providerA.token,
    });
    assert.equal(aRead.status, 200);
    assert.equal(applicationId(aRead.body), providerAApplicationId);
    assert.notEqual(applicationId(aRead.body), providerBApplicationId);

    const beforeB = await apiFetch("/providers/application", { token: providerB.token });
    const beforeBProfile = applicationProfile(beforeB.body);

    const aUpdate = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerA.token,
      body: JSON.stringify({
        userId: providerB.user["id"],
        providerProfileId: beforeBProfile["id"],
        title: "Provider A private title",
        bio: "Provider A private bio",
        city: "Provider A city",
      }),
    });
    assert.equal(aUpdate.status, 200);
    assert.equal(applicationProfile(aUpdate.body)["title"], "Provider A private title");

    const afterB = await apiFetch("/providers/application", { token: providerB.token });
    assert.deepEqual(applicationProfile(afterB.body), beforeBProfile);

    const bSubmit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(bSubmit.status, 400);
    assert.equal(applicationStatus((await apiFetch("/providers/application", { token: providerB.token })).body), "draft");
  });

  it("rejects invalid draft fields and incomplete submission with stable errors", async () => {
    const invalidTitle = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerB.token,
      body: JSON.stringify({ title: "" }),
    });
    assert.equal(invalidTitle.status, 400);
    assert.equal(invalidTitle.body["error"], "title must be between 1 and 120 characters.");

    const invalidYears = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerB.token,
      body: JSON.stringify({ yearsExperience: 81 }),
    });
    assert.equal(invalidYears.status, 400);
    assert.equal(invalidYears.body["error"], "yearsExperience must be an integer from 0 to 80.");

    const incomplete = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(incomplete.status, 400);
    assert.equal(incomplete.body["error"], "Complete your title, bio, and city before submitting.");
    assert.equal((await apiFetch("/providers/me", { token: providerB.token })).status, 403);
  });

  it("submits complete applications idempotently and handles rejected/suspended states", async () => {
    const saved = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerB.token,
      body: JSON.stringify({
        title: "Mobile foot-care specialist",
        bio: "Professional in-home foot care with a calm, client-first approach.",
        city: "Toronto",
        yearsExperience: 6,
      }),
    });
    assert.equal(saved.status, 200);

    const submitted = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(submitted.status, 200);
    assert.equal(applicationStatus(submitted.body), "under_review");
    assert.equal((await apiFetch("/providers/me", { token: providerB.token })).status, 403);

    const repeated = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(repeated.status, 200);
    assert.equal(applicationId(repeated.body), applicationId(submitted.body));

    await db
      .update(providerApplicationsTable)
      .set({
        status: "rejected",
        rejectionReason: "Missing verification documents",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerApplicationsTable.id, providerBApplicationId));

    // Rejected applications can no longer be edited directly; owner must reset first.
    const rejectedPatch = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerB.token,
      body: JSON.stringify({ title: "Updated after review" }),
    });
    assert.equal(rejectedPatch.status, 409);

    // Rejected applications cannot resubmit directly; owner must reset first.
    const rejectedSubmit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(rejectedSubmit.status, 409);

    // Reset transitions rejected → draft.
    const reset = await apiFetch("/providers/application/reset", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(reset.status, 200);
    assert.equal(applicationStatus(reset.body), "draft");

    // Draft edits succeed after reset.
    const rejectedUpdate = await apiFetch("/providers/application", {
      method: "PATCH",
      token: providerB.token,
      body: JSON.stringify({ title: "Updated after review" }),
    });
    assert.equal(rejectedUpdate.status, 200);
    const resubmitted = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(resubmitted.status, 200);
    assert.equal(applicationStatus(resubmitted.body), "under_review");

    await db
      .update(providerApplicationsTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, providerBApplicationId));
    const suspendedSubmit = await apiFetch("/providers/application/submit", {
      method: "POST",
      token: providerB.token,
    });
    assert.equal(suspendedSubmit.status, 409);
    assert.equal((await apiFetch("/providers/me", { token: providerB.token })).status, 403);
  });

  it("requires both approved application and approved profile for provider operations", async () => {
    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, providerAApplicationId));
    await db
      .update(providerProfilesTable)
      .set({
        verificationStatus: "pending",
        title: "Approved application, pending profile",
        bio: "A complete provider profile for authorization testing.",
        city: "Toronto",
        profileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(providerProfilesTable.id, providerAProfileId));

    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 403);

    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "approved", updatedAt: new Date() })
      .where(eq(providerProfilesTable.id, providerAProfileId));
    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 200);

    for (const status of ["draft", "under_review", "rejected", "suspended"] as const) {
      await db
        .update(providerApplicationsTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(providerApplicationsTable.id, providerAApplicationId));
      assert.equal(
        (await apiFetch("/providers/me", { token: providerA.token })).status,
        403,
        `provider access unexpectedly allowed for ${status}`,
      );
    }
  });

  it("keeps credential submission available for onboarding but blocks the provider portal", async () => {
    await db
      .update(providerApplicationsTable)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(providerApplicationsTable.id, providerAApplicationId));
    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "pending", updatedAt: new Date() })
      .where(eq(providerProfilesTable.id, providerAProfileId));

    const credential = await apiFetch("/providers/me/verification", {
      method: "POST",
      token: providerA.token,
      body: JSON.stringify({
        docType: "license",
        fileName: `phase4-test-license-${suffix}.pdf`,
        notes: "Private reviewer context must not leak to application responses.",
      }),
    });
    assert.equal(credential.status, 201);
    assert.equal((await apiFetch("/providers/me", { token: providerA.token })).status, 403);
    assert.equal(
      JSON.stringify((await apiFetch("/providers/application", { token: providerA.token })).body).includes("reviewerNotes"),
      false,
    );
  });
});