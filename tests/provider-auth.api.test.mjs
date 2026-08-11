// Provider Auth + role enforcement + bypass confinement — test suite.
// Convention: node:test with fetch-against-BASE.
// Run: BASE=http://localhost:8001 node --test tests/provider-auth.api.test.mjs
// NOTE: this environment runs with ALLOW_TEST_IDENTITY_HEADERS=true (dev flag);
// header-bypass behavior when the flag is OFF is enforced in code
// (comfort_profile._bypass_enabled) and verified manually before deploy.

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:8001";

async function req(method, path, { token, body, headers: extra } = {}) {
  const headers = { "Content-Type": "application/json", ...(extra || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const provEmail = `provider-${randomUUID()}@test.dev`;
const password = "sup3r-secure-pw";

test("provider register — 201 with token; duplicate 409; validation 400", async () => {
  const ok = await req("POST", "/api/auth/provider/register", {
    body: { email: provEmail, password, name: "Dr. Test" },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.json.token);
  assert.equal(ok.json.provider.email, provEmail);

  const dup = await req("POST", "/api/auth/provider/register", {
    body: { email: provEmail, password },
  });
  assert.equal(dup.status, 409);

  const bad = await req("POST", "/api/auth/provider/register", {
    body: { email: "nope", password },
  });
  assert.equal(bad.status, 400);
});

test("provider login/me — 200 valid; 401 wrong password; role enforced on /provider/me", async () => {
  const bad = await req("POST", "/api/auth/provider/login", {
    body: { email: provEmail, password: "wrong-pw-123" },
  });
  assert.equal(bad.status, 401);

  const ok = await req("POST", "/api/auth/provider/login", {
    body: { email: provEmail, password },
  });
  assert.equal(ok.status, 200);

  const me = await req("GET", "/api/auth/provider/me", { token: ok.json.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.provider.email, provEmail);

  // a PATIENT token must NOT pass as a provider identity
  const patient = await req("POST", "/api/auth/register", {
    body: { email: `p-${randomUUID()}@test.dev`, password, name: "P" },
  });
  const crossed = await req("GET", "/api/auth/provider/me", { token: patient.json.token });
  assert.equal(crossed.status, 401, "patient token must be rejected on provider/me");
});

test("projection accepts provider Bearer; enforces role; revocation kills access", async () => {
  // Seed a sharing patient through the REAL patient Bearer flow (no bypass)
  const patient = await req("POST", "/api/auth/register", {
    body: { email: `share-${randomUUID()}@test.dev`, password, name: "Sharer" },
  });
  const pTok = patient.json.token;
  const meP = await req("GET", "/api/comfort-profile", { token: pTok });
  assert.equal(meP.status, 200);
  await req("POST", "/api/comfort-profile/consent", {
    token: pTok,
    body: { scope: ["temperature"] },
  });
  await req("PUT", "/api/comfort-profile/preferences", {
    token: pTok,
    body: { temperature: "cool", noise: "low" },
  });
  // need the patient's internal id for the projection URL — providers receive it
  // via booking context in the real product; here we read it from /auth/me
  const meAuth = await req("GET", "/api/auth/me", { token: pTok });
  const patientId = meAuth.json.patient.id;

  const provider = await req("POST", "/api/auth/provider/login", {
    body: { email: provEmail, password },
  });
  const vTok = provider.json.token;

  // provider Bearer -> 200, scope-filtered
  const hit = await req("GET", `/api/provider/comfort-projection/${patientId}`, { token: vTok });
  assert.equal(hit.status, 200);
  assert.deepEqual(hit.json.projection, { temperature: "cool" });

  // PATIENT Bearer must NOT work as provider identity (role enforcement)
  const crossed = await req("GET", `/api/provider/comfort-projection/${patientId}`, {
    token: pTok,
  });
  assert.equal(crossed.status, 401, "patient token must be rejected on projection");

  // hardened shared logout revokes the provider session
  const out = await req("POST", "/api/auth/logout", { token: vTok });
  assert.equal(out.status, 200);
  const afterMe = await req("GET", "/api/auth/provider/me", { token: vTok });
  assert.equal(afterMe.status, 401);
});

test("dev bypass headers still work while ALLOW_TEST_IDENTITY_HEADERS=true", async () => {
  // This documents current dev behavior; production runs without the flag.
  const pid = `bypass-${randomUUID()}`;
  const grant = await req("POST", "/api/comfort-profile/consent", {
    headers: { "X-Patient-Id": pid },
    body: { scope: ["notes"] },
  });
  assert.equal(grant.status, 201);
  const proj = await req("GET", `/api/provider/comfort-projection/${pid}`, {
    headers: { "X-Provider-Id": "dev-provider" },
  });
  // no profile yet -> 404 (condition 3), but identity was accepted (not 401)
  assert.equal(proj.status, 404);
});
