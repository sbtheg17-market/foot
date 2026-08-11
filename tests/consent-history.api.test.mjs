// Consent history + versioned consent + scoped grant — V3.1 addendum test suite.
// Convention (contract §8): node:test with fetch-against-BASE.
// Run: BASE=http://localhost:8001 node --test tests/consent-history.api.test.mjs
// NOTE: this environment runs with ALLOW_TEST_IDENTITY_HEADERS=true (dev flag);
// the production hard-stop in comfort_profile._bypass_enabled (APP_ENV=production
// refuses the bypass regardless of the flag) is enforced in code.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

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

test("history — 401 without identity", async () => {
  const r = await req("GET", "/api/comfort-profile/consent/history");
  assert.equal(r.status, 401);
});

test("history — fresh patient: empty history, advertised consent text is hash-consistent", async () => {
  const patient = `patient-${randomUUID()}`;
  const r = await req("GET", "/api/comfort-profile/consent/history", { patient });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.history, []);
  assert.equal(typeof r.json.consentText, "string");
  assert.ok(r.json.consentText.length > 20);
  assert.equal(r.json.consentTextVersion, "1");
  const expected = createHash("sha256").update(r.json.consentText).digest("hex");
  assert.equal(r.json.consentTextHash, expected, "advertised hash must equal sha256(consentText)");
  // Language rule: the consent text must never make medical claims.
  assert.ok(!/medic|diagnos|suitab/i.test(r.json.consentText));
});

test("scoped grant — partial scope is stored and versioned in history", async () => {
  const patient = `patient-${randomUUID()}`;
  const g = await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["temperature", "noise"] },
  });
  assert.equal(g.status, 201);
  assert.deepEqual(g.json.scope, ["temperature", "noise"]);

  const h = await req("GET", "/api/comfort-profile/consent/history", { patient });
  assert.equal(h.status, 200);
  assert.equal(h.json.history.length, 1);
  const row = h.json.history[0];
  assert.equal(row.status, "ACTIVE");
  assert.deepEqual(row.scope, ["temperature", "noise"]);
  assert.equal(row.consentVersion, "1");
  assert.equal(row.consentTextHash, h.json.consentTextHash);
  assert.equal(row.purpose, "comfort-profile-sharing");
  assert.ok(row.createdAt);
  assert.ok(row.id);
});

test("timeline — grant then withdraw: newest-first, both versioned, immutable ids", async () => {
  const patient = `patient-${randomUUID()}`;
  await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["lighting"] },
  });
  const w = await req("POST", "/api/comfort-profile/consent/withdraw", { patient });
  assert.equal(w.status, 200);

  const h = await req("GET", "/api/comfort-profile/consent/history", { patient });
  assert.equal(h.json.history.length, 2);
  const [newest, oldest] = h.json.history;
  assert.equal(newest.status, "WITHDRAWN");
  assert.equal(oldest.status, "ACTIVE");
  assert.notEqual(newest.id, oldest.id);
  // Withdrawal is also versioned evidence.
  assert.equal(newest.consentVersion, "1");
  assert.equal(newest.consentTextHash, h.json.consentTextHash);
  // Append-only: the original grant row is untouched.
  assert.deepEqual(oldest.scope, ["lighting"]);
});

test("owner-scoping — a patient never sees another patient's consent events", async () => {
  const a = `patient-${randomUUID()}`;
  const b = `patient-${randomUUID()}`;
  await req("POST", "/api/comfort-profile/consent", { patient: a, body: { scope: ["noise"] } });
  const hb = await req("GET", "/api/comfort-profile/consent/history", { patient: b });
  assert.equal(hb.status, 200);
  assert.deepEqual(hb.json.history, []);
});

test("conservative sharing — ungranted notes never reach the provider projection", async () => {
  const patient = `patient-${randomUUID()}`;
  // Grant WITHOUT notes (the conservative default of the scope picker).
  await req("POST", "/api/comfort-profile/consent", {
    patient,
    body: { scope: ["temperature", "lighting", "noise"] },
  });
  await req("PUT", "/api/comfort-profile/preferences", {
    patient,
    body: { temperature: "warm", notes: "private free text — must never leak" },
  });
  const p = await req("GET", `/api/provider/comfort-projection/${patient}`, {
    provider: PROVIDER,
  });
  assert.equal(p.status, 200);
  assert.equal(p.json.projection.temperature, "warm");
  assert.equal(p.json.projection.notes, undefined, "notes outside scope must not appear");
});

test("grant validation still holds — empty scope 400; history unchanged by the failure", async () => {
  const patient = `patient-${randomUUID()}`;
  const bad = await req("POST", "/api/comfort-profile/consent", { patient, body: { scope: [] } });
  assert.equal(bad.status, 400);
  const h = await req("GET", "/api/comfort-profile/consent/history", { patient });
  assert.deepEqual(h.json.history, [], "failed grants are never recorded");
});
