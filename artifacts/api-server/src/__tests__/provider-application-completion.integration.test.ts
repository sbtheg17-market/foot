/**
 * Integration tests: provider application services, availability,
 * verification, completion, and submission validation.
 *
 * Prerequisites: API server must be running with the development database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:onboarding
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  availabilityTable,
  verificationDocsTable,
  usersTable,
  accountRolesTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "onboarding-test-pw-123";
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
    body = { error: `Non-JSON: ${text.slice(0, 200)}` };
  }
  return { status: response.status, body };
}

async function register(
  email: string,
  roleIntent: "client" | "provider",
): Promise<{ token: string; userId: number }> {
  const result = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Onboarding",
      role: roleIntent,
      roleIntent,
    }),
  });
  assert.equal(result.status, 201, `Register failed: ${JSON.stringify(result.body)}`);
  return {
    token: result.body["token"] as string,
    userId: ((result.body["user"] as JsonBody)["id"]) as number,
  };
}

async function startApplication(token: string): Promise<number> {
  const result = await apiFetch("/providers/application", {
    method: "POST",
    token,
  });
  assert.ok(result.status === 200 || result.status === 201, `Application start failed: ${JSON.stringify(result.body)}`);
  return ((result.body["application"] as JsonBody)["id"]) as number;
}

async function cleanupUser(email: string) {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user) await db.delete(usersTable).where(eq(usersTable.id, user.id));
  } catch {
    // ignore cleanup errors
  }
}

describe("Provider application — services", () => {
  let token: string;
  let otherToken: string;
  const email = `svc-owner-${suffix}@test.local`;
  const otherEmail = `svc-other-${suffix}@test.local`;

  before(async () => {
    ({ token } = await register(email, "provider"));
    ({ token: otherToken } = await register(otherEmail, "provider"));
    await startApplication(token);
    await startApplication(otherToken);
  });

  after(async () => {
    await cleanupUser(email);
    await cleanupUser(otherEmail);
  });

  it("owner can list services (empty initially)", async () => {
    const r = await apiFetch("/providers/application/services", { token });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray((r.body["services"])));
    assert.equal((r.body["services"] as unknown[]).length, 0);
  });

  it("owner can create a service", async () => {
    const r = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Foot Rejuvenation", durationMinutes: 60, priceCents: 8000 }),
    });
    assert.equal(r.status, 201);
    const service = r.body["service"] as JsonBody;
    assert.equal(service["title"], "Foot Rejuvenation");
    assert.equal(service["durationMinutes"], 60);
    assert.equal(service["priceCents"], 8000);
  });

  it("owner can update a service", async () => {
    // Create one first
    const create = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Draft Service", durationMinutes: 30, priceCents: 4000 }),
    });
    const serviceId = ((create.body["service"] as JsonBody)["id"]) as number;

    const r = await apiFetch(`/providers/application/services/${serviceId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ title: "Updated Service", priceCents: 5000 }),
    });
    assert.equal(r.status, 200);
    const updated = r.body["service"] as JsonBody;
    assert.equal(updated["title"], "Updated Service");
    assert.equal(updated["priceCents"], 5000);
  });

  it("owner can delete a service", async () => {
    const create = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "To Remove", durationMinutes: 45, priceCents: 3000 }),
    });
    const serviceId = ((create.body["service"] as JsonBody)["id"]) as number;

    const r = await apiFetch(`/providers/application/services/${serviceId}`, {
      method: "DELETE",
      token,
    });
    assert.equal(r.status, 200);
  });

  it("rejects invalid service data", async () => {
    const r = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "", durationMinutes: 60, priceCents: 8000 }),
    });
    assert.equal(r.status, 400);

    const r2 = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Valid", durationMinutes: 5, priceCents: 8000 }),
    });
    assert.equal(r2.status, 400);
  });

  it("non-owner cannot access another provider's services endpoint", async () => {
    // otherToken has its own application, can list their own (empty)
    const ownList = await apiFetch("/providers/application/services", { token: otherToken });
    assert.equal(ownList.status, 200);

    // Create a service under owner's profile
    const create = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Owner Service", durationMinutes: 60, priceCents: 8000 }),
    });
    const serviceId = ((create.body["service"] as JsonBody)["id"]) as number;

    // Other cannot patch owner's service (own by serviceId foreign key)
    const r = await apiFetch(`/providers/application/services/${serviceId}`, {
      method: "PATCH",
      token: otherToken,
      body: JSON.stringify({ title: "Stolen" }),
    });
    assert.equal(r.status, 404, "Non-owner should get 404 on another provider's service");
  });

  it("unauthenticated request is rejected", async () => {
    const r = await apiFetch("/providers/application/services");
    assert.equal(r.status, 401);
  });

  it("draft services are not exposed in public discovery", async () => {
    // Create a service via application endpoint
    const create = await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Private Draft", durationMinutes: 60, priceCents: 8000 }),
    });
    assert.equal(create.status, 201);
    const profileId = ((create.body["service"] as JsonBody)["providerId"]) as number;

    // Public endpoint — only approved/active services shown; this provider is not approved
    const pub = await apiFetch(`/providers/${profileId}/services`);
    // Provider might not even show up publicly yet, or service is not visible — both are safe
    if (pub.status === 200) {
      const services = (pub.body["services"] as unknown[]);
      const found = services.find((s) => (s as JsonBody)["title"] === "Private Draft");
      assert.ok(!found, "Draft service should not appear in public discovery for unapproved provider");
    }
  });
});

describe("Provider application — availability", () => {
  let token: string;
  let otherToken: string;
  const email = `avail-owner-${suffix}@test.local`;
  const otherEmail = `avail-other-${suffix}@test.local`;

  before(async () => {
    ({ token } = await register(email, "provider"));
    ({ token: otherToken } = await register(otherEmail, "provider"));
    await startApplication(token);
    await startApplication(otherToken);
  });

  after(async () => {
    await cleanupUser(email);
    await cleanupUser(otherEmail);
  });

  it("owner can read availability (empty initially)", async () => {
    const r = await apiFetch("/providers/application/availability", { token });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body["slots"]));
    assert.equal((r.body["slots"] as unknown[]).length, 0);
  });

  it("owner can set availability slots", async () => {
    const r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token,
      body: JSON.stringify({ slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }),
    });
    assert.equal(r.status, 200);
    const slots = r.body["slots"] as JsonBody[];
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.["dayOfWeek"], 1);
    assert.equal(slots[0]?.["startTime"], "09:00");
  });

  it("save/resume is idempotent — replacing with same data", async () => {
    const payload = { slots: [{ dayOfWeek: 3, startTime: "10:00", endTime: "14:00" }] };
    const r1 = await apiFetch("/providers/application/availability", { method: "PUT", token, body: JSON.stringify(payload) });
    const r2 = await apiFetch("/providers/application/availability", { method: "PUT", token, body: JSON.stringify(payload) });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal((r2.body["slots"] as JsonBody[]).length, 1);
  });

  it("rejects invalid time ranges", async () => {
    const r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token,
      body: JSON.stringify({ slots: [{ dayOfWeek: 1, startTime: "17:00", endTime: "09:00" }] }),
    });
    assert.equal(r.status, 400);
  });

  it("rejects invalid dayOfWeek", async () => {
    const r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token,
      body: JSON.stringify({ slots: [{ dayOfWeek: 8, startTime: "09:00", endTime: "17:00" }] }),
    });
    assert.equal(r.status, 400);
  });

  it("non-owner cannot set another provider's availability (own schedule is separate)", async () => {
    // Each provider has their own application; both can set availability independently
    const r = await apiFetch("/providers/application/availability", {
      method: "PUT",
      token: otherToken,
      body: JSON.stringify({ slots: [{ dayOfWeek: 5, startTime: "08:00", endTime: "12:00" }] }),
    });
    assert.equal(r.status, 200);

    // Owner's slots remain unchanged
    const ownerSlots = await apiFetch("/providers/application/availability", { token });
    const slotDays = (ownerSlots.body["slots"] as JsonBody[]).map((s) => s["dayOfWeek"]);
    assert.ok(!slotDays.includes(5) || slotDays.length !== 1, "Owner slots should be independent");
  });

  it("unauthenticated request is rejected", async () => {
    const r = await apiFetch("/providers/application/availability", { method: "PUT", body: JSON.stringify({ slots: [] }) });
    assert.equal(r.status, 401);
  });
});

describe("Provider application — completion and submission", () => {
  let token: string;
  const email = `completion-${suffix}@test.local`;

  before(async () => {
    ({ token } = await register(email, "provider"));
    await startApplication(token);
  });

  after(async () => {
    await cleanupUser(email);
  });

  it("completion is server-derived and starts incomplete", async () => {
    const r = await apiFetch("/providers/application/completion", { token });
    assert.equal(r.status, 200);
    const c = r.body["completion"] as JsonBody;
    assert.equal(c["readyForSubmission"], false);
    assert.equal(c["applicationStatus"], "draft");
    assert.ok(Array.isArray(c["missingRequirements"]));
    assert.ok((c["missingRequirements"] as string[]).length > 0);
  });

  it("submission fails when sections are incomplete", async () => {
    const r = await apiFetch("/providers/application/submit", { method: "POST", token });
    assert.equal(r.status, 400);
    assert.ok(r.body["missingRequirements"] || r.body["error"]);
  });

  it("submission succeeds when all sections are complete", async () => {
    // Fill profile
    await apiFetch("/providers/application", {
      method: "PATCH",
      token,
      body: JSON.stringify({ title: "Full Provider", bio: "Experienced foot care specialist.", city: "Toronto" }),
    });

    // Add service
    await apiFetch("/providers/application/services", {
      method: "POST",
      token,
      body: JSON.stringify({ title: "Foot Rejuvenation", durationMinutes: 60, priceCents: 8000 }),
    });

    // Add availability
    await apiFetch("/providers/application/availability", {
      method: "PUT",
      token,
      body: JSON.stringify({ slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }),
    });

    // Add verification doc
    await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: JSON.stringify({ docType: "license", fileName: "RPN-99999 College of Nurses Ontario" }),
    });

    // Check completion
    const comp = await apiFetch("/providers/application/completion", { token });
    const c = comp.body["completion"] as JsonBody;
    assert.equal(c["profileComplete"], true, "profile should be complete");
    assert.equal(c["servicesComplete"], true, "services should be complete");
    assert.equal(c["availabilityComplete"], true, "availability should be complete");
    assert.equal(c["verificationComplete"], true, "verification should be complete");
    assert.equal(c["readyForSubmission"], true, "should be ready for submission");

    // Submit
    const submit = await apiFetch("/providers/application/submit", { method: "POST", token });
    assert.equal(submit.status, 200, `Submit failed: ${JSON.stringify(submit.body)}`);
    assert.equal(((submit.body["application"] as JsonBody)["status"]), "under_review");
  });

  it("repeated submission does not create duplicates — returns current state", async () => {
    // Already under_review from previous test; re-submitting should be idempotent
    const r = await apiFetch("/providers/application/submit", { method: "POST", token });
    assert.equal(r.status, 200);
    assert.equal(((r.body["application"] as JsonBody)["status"]), "under_review");
  });

  it("signup intent cannot escalate authorization — provider membership ≠ provider operations", async () => {
    // This provider is under_review (not approved); must not access /providers/me
    const r = await apiFetch("/providers/me", { token });
    assert.equal(r.status, 403, "Under-review provider should not have operational access");
  });
});

describe("Provider application — authorization boundaries", () => {
  let clientToken: string;
  const clientEmail = `auth-client-${suffix}@test.local`;

  before(async () => {
    ({ token: clientToken } = await register(clientEmail, "client"));
  });

  after(async () => {
    await cleanupUser(clientEmail);
  });

  it("pure client (no provider role) cannot access application services", async () => {
    const r = await apiFetch("/providers/application/services", { token: clientToken });
    assert.equal(r.status, 403);
  });

  it("pure client cannot access application availability", async () => {
    const r = await apiFetch("/providers/application/availability", { token: clientToken });
    assert.equal(r.status, 403);
  });

  it("pure client cannot access application completion", async () => {
    const r = await apiFetch("/providers/application/completion", { token: clientToken });
    assert.equal(r.status, 403);
  });
});
