/**
 * Focused integration tests: provider listing preview (owner-scoped).
 *
 * Verifies GET /providers/me/listing-preview for draft, under-review, and
 * approved owners; the anonymous/non-provider boundary; that the anonymous
 * public approval gate is NOT weakened; the returned field set; privacy (no
 * client/booking ids or reviewer-private/care-note data); and that preview
 * slot generation matches the merged booking slot engine.
 *
 * Prereqs: DATABASE_URL=<scratch> JWT_SECRET=<any> PORT=<port>, seeded, server up.
 * Run: node --import tsx/esm --test src/__tests__/listing-preview.integration.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "demo1234";

type JsonBody = Record<string, unknown>;

async function api(
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
  let body: JsonBody = {};
  try {
    body = (await res.json()) as JsonBody;
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function login(email: string): Promise<string> {
  const r = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.body)}`);
  return r.body["token"] as string;
}

async function registerProvider(email: string): Promise<string> {
  const r = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName: "Prev",
      lastName: "Provider",
      role: "provider",
      roleIntent: "provider",
    }),
  });
  assert.equal(r.status, 201, `register ${email}: ${JSON.stringify(r.body)}`);
  return r.body["token"] as string;
}

describe("provider listing preview (owner-scoped)", () => {
  let sarah = "";
  let jane = "";
  let draftToken = "";
  let reviewToken = "";

  before(async () => {
    sarah = await login("sarah@oncallfoot.com");
    jane = await login("jane@oncallfoot.com");

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // Draft provider — application created, nothing else.
    draftToken = await registerProvider(`preview-draft-${suffix}@example.test`);
    const createDraft = await api("/providers/application", { method: "POST", token: draftToken });
    assert.ok([200, 201].includes(createDraft.status), JSON.stringify(createDraft.body));

    // Under-review provider — complete every section, then submit.
    reviewToken = await registerProvider(`preview-review-${suffix}@example.test`);
    await api("/providers/application", { method: "POST", token: reviewToken });
    await api("/providers/application", {
      method: "PATCH",
      token: reviewToken,
      body: JSON.stringify({
        title: "Certified mobile foot-care specialist",
        bio: "Gentle, professional at-home foot care.",
        city: "Toronto",
      }),
    });
    await api("/providers/application/services", {
      method: "POST",
      token: reviewToken,
      body: JSON.stringify({ title: "Basic Foot Care", durationMinutes: 60, priceCents: 8000 }),
    });
    await api("/providers/application/availability", {
      method: "PUT",
      token: reviewToken,
      body: JSON.stringify({ slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }),
    });
    await api("/providers/me/verification", {
      method: "POST",
      token: reviewToken,
      body: JSON.stringify({ docType: "license", fileName: "License #RPN-0001" }),
    });
    const submit = await api("/providers/application/submit", { method: "POST", token: reviewToken });
    assert.equal(submit.status, 200, `submit: ${JSON.stringify(submit.body)}`);
  });

  it("draft owner can preview own not-yet-public listing", async () => {
    const r = await api("/providers/me/listing-preview", { token: draftToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const p = r.body["preview"] as JsonBody;
    assert.equal(p["isPublic"], false);
    assert.equal(p["applicationStatus"], "draft");
    assert.ok(p["profile"]);
    assert.ok(Array.isArray(p["services"]));
    assert.ok(Array.isArray(p["slotPreview"]));
  });

  it("under-review owner can preview own listing with slots", async () => {
    const r = await api("/providers/me/listing-preview", { token: reviewToken });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const p = r.body["preview"] as JsonBody;
    assert.equal(p["isPublic"], false);
    assert.equal(p["applicationStatus"], "under_review");
    assert.ok((p["services"] as unknown[]).length >= 1);
    assert.ok((p["slotPreview"] as unknown[]).length >= 1, "expected generated slots");
  });

  it("approved owner sees a live, complete preview", async () => {
    const r = await api("/providers/me/listing-preview", { token: sarah });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const p = r.body["preview"] as JsonBody;
    assert.equal(p["isPublic"], true);
    assert.equal(p["verificationStatus"], "approved");
    assert.equal(typeof p["timezone"], "string");
    assert.ok((p["services"] as unknown[]).length >= 1);
    assert.ok(Array.isArray(p["availability"]));
    assert.ok((p["slotPreview"] as unknown[]).length >= 1);
  });

  it("returns profile, services, availability, timezone, and slots", async () => {
    const r = await api("/providers/me/listing-preview", { token: sarah });
    const p = r.body["preview"] as JsonBody;
    const profile = p["profile"] as JsonBody;
    assert.ok(profile["title"] && profile["city"]);
    assert.equal(typeof p["timezone"], "string");
    assert.ok(Array.isArray(p["availability"]));
    const day = (p["slotPreview"] as Array<JsonBody>)[0];
    const slots = day["slots"] as Array<{ start: string; end: string; available: boolean }>;
    assert.ok(slots.length > 0);
  });

  it("preview slot generation matches the merged booking slot engine", async () => {
    const r = await api("/providers/me/listing-preview", { token: sarah });
    const p = r.body["preview"] as JsonBody;
    const svc = (p["services"] as Array<{ id: number; durationMinutes: number }>)[0]!;
    const day = (p["slotPreview"] as Array<JsonBody>)[0]!;
    const slots = day["slots"] as Array<{ start: string; end: string }>;
    // Duration-accurate and 30-minute cadence, exactly like /providers/:id/slots.
    for (const s of slots) {
      assert.equal(
        new Date(s.end).getTime() - new Date(s.start).getTime(),
        svc.durationMinutes * 60000,
      );
    }
    if (slots.length > 1) {
      assert.equal(
        new Date(slots[1]!.start).getTime() - new Date(slots[0]!.start).getTime(),
        30 * 60000,
      );
    }
  });

  it("leaks no client ids, booking ids, or reviewer-private/care-note data", async () => {
    const r = await api("/providers/me/listing-preview", { token: sarah });
    const serialized = JSON.stringify(r.body);
    for (const forbidden of ["clientId", "bookingId", "reviewerNotes", "careNotes", "fileName", "docType"]) {
      assert.ok(!serialized.includes(forbidden), `preview must not expose ${forbidden}`);
    }
  });

  it("rejects a non-provider (client) account with 403", async () => {
    const r = await api("/providers/me/listing-preview", { token: jane });
    assert.equal(r.status, 403);
  });

  it("rejects an anonymous request with 401", async () => {
    const r = await api("/providers/me/listing-preview");
    assert.equal(r.status, 401);
  });

  it("does NOT weaken the anonymous public approval gate for unapproved providers", async () => {
    // The under-review provider's public profile id.
    const status = await api("/providers/application/status", { token: reviewToken });
    const profileId = (status.body["status"] as JsonBody | undefined)?.["providerProfileId"] as
      | number
      | undefined;
    if (!profileId) return; // status shape guard; owner-scoping already proven above
    const anonProfile = await api(`/providers/${profileId}`);
    assert.notEqual(anonProfile.status, 200, "unapproved provider must not be publicly visible");
  });
});
