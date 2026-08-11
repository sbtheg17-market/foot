// Comfort Profile API — Phase 4C contract test suite.
// Convention (contract §8): node:test with fetch-against-BASE.
// Run: BASE=http://localhost:8001 node --test tests/comfort-profile.api.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:8001";

async function req(method, path, { patient, provider, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (patient) headers["X-Patient-Id"] = patient;
  if (provider) headers["X-Provider-Id"] = provider;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204 has no body */
  }
  return { status: res.status, json };
}

const PROVIDER = `provider-${randomUUID()}`;

// ---------- 401 matrix: every operation requires an identity ----------
test("401 — all six operations reject missing identity", async () => {
  const cases = [
    ["POST", "/api/comfort-profile/consent", { body: { scope: ["notes"] } }],
    ["POST", "/api/comfort-profile/consent/withdraw", {}],
    ["DELETE", "/api/comfort-profile", {}],
    ["GET", "/api/comfort-profile", {}],
    ["PUT", "/api/comfort-profile/preferences", { body: { noise: "quiet" } }],
    ["GET", `/api/provider/comfort-projection/${randomUUID()}`, {}],
  ];
  for (const [method, path, opts] of cases) {
    const { status } = await req(method, path, opts);
    assert.equal(status, 401, `${method} ${path} should be 401 without identity`);
  }
});

// ---------- grantConsent: 201 success, 400 validation ----------
test("grantConsent — 201 with consent row payload", async () => {
  const patient = randomUUID();
  const { status, json } = await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["temperature", "noise"] },
  });
  assert.equal(status, 201, "grant success MUST be 201, not 200");
  assert.equal(json.status, "ACTIVE");
  assert.deepEqual(json.scope, ["temperature", "noise"]);
  assert.ok(json.consentId);
  assert.ok(json.createdAt);
});

test("grantConsent — 400 on invalid scope payloads", async () => {
  const patient = randomUUID();
  const badBodies = [
    { scope: [] },
    { scope: ["bogus"] },
    { scope: "temperature" },
    {},
    { scope: [42] },
  ];
  for (const body of badBodies) {
    const { status } = await req("POST", "/api/comfort-profile/consent", { patient, body });
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
});

// ---------- getComfortProfile: fresh patient baseline ----------
test("getComfortProfile — fresh patient: inactive, no profile", async () => {
  const patient = randomUUID();
  const { status, json } = await req("GET", "/api/comfort-profile", { patient });
  assert.equal(status, 200);
  assert.equal(json.isConsentActive, false);
  assert.equal(json.hasProfile, false);
  assert.equal(json.preferences, null);
});

// ---------- updateComfortPreferences: 409 gate, 400 validation, 200 ----------
test("updateComfortPreferences — 409 when consent not active (editor locked)", async () => {
  const patient = randomUUID();
  const { status, json } = await req("PUT", "/api/comfort-profile/preferences", {
    patient,
    body: { temperature: "cool" },
  });
  assert.equal(status, 409);
  assert.equal(json.error, "CONSENT_NOT_ACTIVE");
});

test("updateComfortPreferences — 400 invalid enum / unknown field; 200 valid", async () => {
  const patient = randomUUID();
  await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["temperature", "lighting", "noise", "notes"] },
  });
  for (const body of [{ temperature: "freezing" }, { hacker: true }, {}]) {
    const { status } = await req("PUT", "/api/comfort-profile/preferences", { patient, body });
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  const ok = await req("PUT", "/api/comfort-profile/preferences", {
    patient,
    body: { temperature: "warm", noise: "quiet", notes: "Extra blanket please." },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.preferences.temperature, "warm");
  assert.equal(ok.json.preferences.noise, "quiet");
  assert.equal(ok.json.preferences.lighting, null);
});

// ---------- full lifecycle: grant -> save -> read -> project ----------
test("lifecycle — grant, save, read back, provider sees scoped projection", async () => {
  const patient = randomUUID();
  await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["temperature", "noise"] }, // lighting/notes NOT granted
  });
  await req("PUT", "/api/comfort-profile/preferences", {
    patient,
    body: { temperature: "cool", lighting: "dim", noise: "low", notes: "hi" },
  });
  const me = await req("GET", "/api/comfort-profile", { patient });
  assert.equal(me.json.isConsentActive, true);
  assert.equal(me.json.hasProfile, true);
  assert.equal(me.json.preferences.lighting, "dim");

  const proj = await req("GET", `/api/provider/comfort-projection/${patient}`, {
    provider: PROVIDER,
  });
  assert.equal(proj.status, 200);
  // Condition 4: only granted-scope, non-null fields appear
  assert.deepEqual(proj.json.projection, { temperature: "cool", noise: "low" });
  assert.equal(proj.json.projection.lighting, undefined, "ungranted field must not leak");
  assert.equal(proj.json.projection.notes, undefined, "ungranted field must not leak");
});

// ---------- withdraw: hides, never deletes; separate from delete ----------
test("withdrawConsent — hides projection but NEVER deletes profile data", async () => {
  const patient = randomUUID();
  await req("POST", "/api/comfort-profile/consent", { patient, body: { scope: ["noise"] } });
  await req("PUT", "/api/comfort-profile/preferences", { patient, body: { noise: "quiet" } });

  const w = await req("POST", "/api/comfort-profile/consent/withdraw", { patient });
  assert.equal(w.status, 200);
  assert.equal(w.json.status, "WITHDRAWN");

  // isConsentActive derives from the LATEST row -> now false
  const me = await req("GET", "/api/comfort-profile", { patient });
  assert.equal(me.json.isConsentActive, false);
  // …but the profile data is still there (hide-without-delete)
  assert.equal(me.json.hasProfile, true);
  assert.equal(me.json.preferences.noise, "quiet");

  // Provider projection is now 404 (condition 2 fails) — and never 403
  const proj = await req("GET", `/api/provider/comfort-projection/${patient}`, {
    provider: PROVIDER,
  });
  assert.equal(proj.status, 404);
});

test("withdrawConsent — 404 when patient has no consent record at all", async () => {
  const patient = randomUUID();
  const { status } = await req("POST", "/api/comfort-profile/consent/withdraw", { patient });
  assert.equal(status, 404);
});

test("re-grant after withdraw — latest-row rule restores access", async () => {
  const patient = randomUUID();
  await req("POST", "/api/comfort-profile/consent", { patient, body: { scope: ["notes"] } });
  await req("PUT", "/api/comfort-profile/preferences", { patient, body: { notes: "water nearby" } });
  await req("POST", "/api/comfort-profile/consent/withdraw", { patient });
  await req("POST", "/api/comfort-profile/consent", { patient, body: { scope: ["notes"] } });
  const proj = await req("GET", `/api/provider/comfort-projection/${patient}`, {
    provider: PROVIDER,
  });
  assert.equal(proj.status, 200);
  assert.deepEqual(proj.json.projection, { notes: "water nearby" });
});

// ---------- deleteComfortProfile: 204 / 404, separate from withdraw ----------
test("deleteComfortProfile — 204 on delete, 404 when nothing to delete", async () => {
  const patient = randomUUID();
  // nothing to delete yet
  const miss = await req("DELETE", "/api/comfort-profile", { patient });
  assert.equal(miss.status, 404);

  await req("POST", "/api/comfort-profile/consent", { patient, body: { scope: ["noise"] } });
  await req("PUT", "/api/comfort-profile/preferences", { patient, body: { noise: "low" } });
  const del = await req("DELETE", "/api/comfort-profile", { patient });
  assert.equal(del.status, 204);

  const me = await req("GET", "/api/comfort-profile", { patient });
  assert.equal(me.json.hasProfile, false);
  // consent row remains ACTIVE (delete is not withdraw)
  assert.equal(me.json.isConsentActive, true);

  const again = await req("DELETE", "/api/comfort-profile", { patient });
  assert.equal(again.status, 404);
});

// ---------- projection 404 matrix: each of the four conditions ----------
test("projection — 404 for each failing condition; never 403", async () => {
  // C1: no consent rows at all
  const p1 = randomUUID();
  const c1 = await req("GET", `/api/provider/comfort-projection/${p1}`, { provider: PROVIDER });
  assert.equal(c1.status, 404);

  // C3: consent active but no profile document
  const p2 = randomUUID();
  await req("POST", "/api/comfort-profile/consent", { patient: p2, body: { scope: ["noise"] } });
  const c3 = await req("GET", `/api/provider/comfort-projection/${p2}`, { provider: PROVIDER });
  assert.equal(c3.status, 404);

  // C4: profile exists but granted scope yields only null fields
  const p3 = randomUUID();
  await req("POST", "/api/comfort-profile/consent", { patient: p3, body: { scope: ["notes"] } });
  await req("PUT", "/api/comfort-profile/preferences", { patient: p3, body: { noise: "low" } });
  const c4 = await req("GET", `/api/provider/comfort-projection/${p3}`, { provider: PROVIDER });
  assert.equal(c4.status, 404);

  // No 403 appeared anywhere in this suite — assert the canonical miss is 404
  for (const r of [c1, c3, c4]) assert.notEqual(r.status, 403, "403 path is forbidden");
});
