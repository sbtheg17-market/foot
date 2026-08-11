// Patient Auth API — test suite (node:test, fetch-against-BASE).
// Run: BASE=http://localhost:8001 node --test tests/auth.api.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:8001";

async function req(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
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

const email = `patient-${randomUUID()}@test.dev`;
const password = "sup3r-secure-pw";

test("register — 201 with token; duplicate 409; validation 400", async () => {
  const ok = await req("POST", "/api/auth/register", {
    body: { email, password, name: "Test Patient" },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.json.token);
  assert.equal(ok.json.patient.email, email);

  const dup = await req("POST", "/api/auth/register", { body: { email, password } });
  assert.equal(dup.status, 409);

  const badEmail = await req("POST", "/api/auth/register", {
    body: { email: "nope", password },
  });
  assert.equal(badEmail.status, 400);

  const shortPw = await req("POST", "/api/auth/register", {
    body: { email: `x-${randomUUID()}@test.dev`, password: "short" },
  });
  assert.equal(shortPw.status, 400);
});

test("login — 200 valid; 401 wrong password; me works with token", async () => {
  const bad = await req("POST", "/api/auth/login", { body: { email, password: "wrong-pw-123" } });
  assert.equal(bad.status, 401);

  const ok = await req("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);

  const me = await req("GET", "/api/auth/me", { token: ok.json.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.patient.email, email);

  const noTok = await req("GET", "/api/auth/me", {});
  assert.equal(noTok.status, 401);
  const garbage = await req("GET", "/api/auth/me", { token: "garbage-token" });
  assert.equal(garbage.status, 401);
});

test("logout — hardened: always 200, session revoked, idempotent", async () => {
  const login = await req("POST", "/api/auth/login", { body: { email, password } });
  const token = login.json.token;

  const out = await req("POST", "/api/auth/logout", { token });
  assert.equal(out.status, 200);

  // session is dead now
  const me = await req("GET", "/api/auth/me", { token });
  assert.equal(me.status, 401);

  // hardened paths: repeat logout, invalid token, and NO token all still 200
  for (const t of [token, "totally-invalid", undefined]) {
    const again = await req("POST", "/api/auth/logout", { token: t });
    assert.equal(again.status, 200, "logout must never fail for auth reasons");
  }
});

test("comfort routes accept Bearer identity end to end", async () => {
  const reg = await req("POST", "/api/auth/register", {
    body: { email: `flow-${randomUUID()}@test.dev`, password, name: "Flow" },
  });
  const token = reg.json.token;

  const grant = await req("POST", "/api/comfort-profile/consent", {
    token,
    body: { scope: ["temperature", "notes"] },
  });
  assert.equal(grant.status, 201);

  const put = await req("PUT", "/api/comfort-profile/preferences", {
    token,
    body: { temperature: "moderate", notes: "Bearer works" },
  });
  assert.equal(put.status, 200);

  const me = await req("GET", "/api/comfort-profile", { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.isConsentActive, true);
  assert.equal(me.json.preferences.temperature, "moderate");

  // revoked token no longer resolves -> 401 on comfort routes
  await req("POST", "/api/auth/logout", { token });
  const after = await req("GET", "/api/comfort-profile", { token });
  assert.equal(after.status, 401);
});
