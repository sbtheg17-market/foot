/**
 * Registration (POST /auth/register) — integration.
 *
 * Regression suite for the mobile "Internal server error" blocker: two
 * concurrent submissions with the same email both passed the SELECT
 * pre-check, the losing INSERT violated users.email uniqueness, and the
 * unhandled error surfaced as a generic 500. Covers: client/provider
 * success + role-intent mapping, session creation, password hashing, safe
 * validation errors, sequential + concurrent duplicate email (409, never
 * 500), case-insensitive email uniqueness, and no sensitive data in
 * responses.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:registration
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "registration-pass-1";
const suffix = `${process.pid}-${Date.now()}`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody; raw: string }> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((rest.headers as Record<string, string>) ?? {}),
    },
  });
  const raw = await res.text();
  let body: JsonBody;
  try {
    body = JSON.parse(raw) as JsonBody;
  } catch {
    body = { error: raw.slice(0, 200) };
  }
  return { status: res.status, body, raw };
}

function registerPayload(overrides: JsonBody = {}): string {
  return JSON.stringify({
    firstName: "Stan",
    lastName: "Bent",
    email: `reg-${suffix}-${Math.random().toString(36).slice(2, 8)}@oncallfoot.test`,
    password: PASSWORD,
    roleIntent: "client",
    role: "client",
    ...overrides,
  });
}

describe("registration success paths", () => {
  it("registers a client ('looking for care') with a working session", async () => {
    const email = `reg-client-${suffix}@oncallfoot.test`;
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({ email }),
    });
    assert.equal(r.status, 201, r.raw.slice(0, 300));
    const user = r.body["user"] as JsonBody;
    assert.equal(user["role"], "client");
    assert.equal(user["activeRole"], "client");
    assert.deepEqual(user["roles"], ["client"]);
    assert.equal((user["onboarding"] as JsonBody)["client"], "complete");
    assert.equal(user["providerApplication"], null);

    // Session/token works against an authenticated route.
    const me = await apiFetch("/auth/me", { token: r.body["token"] as string });
    assert.equal(me.status, 200);
    assert.equal((me.body["user"] as JsonBody)["email"], email);
  });

  it("registers a provider with a draft application", async () => {
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({
        email: `reg-provider-${suffix}@oncallfoot.test`,
        roleIntent: "provider",
        role: "provider",
      }),
    });
    assert.equal(r.status, 201, r.raw.slice(0, 300));
    const user = r.body["user"] as JsonBody;
    assert.equal(user["role"], "provider");
    const application = user["providerApplication"] as JsonBody;
    assert.ok(application, "provider registration must create an application");
    assert.equal(application["status"], "draft");
  });

  it("maps roleIntent over legacy role when both are present", async () => {
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({
        email: `reg-intent-${suffix}@oncallfoot.test`,
        roleIntent: "provider",
        role: "client",
      }),
    });
    assert.equal(r.status, 201);
    assert.equal((r.body["user"] as JsonBody)["role"], "provider");
  });

  it("hashes the password (bcrypt) and login verifies it", async () => {
    const email = `reg-hash-${suffix}@oncallfoot.test`;
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({ email }),
    });
    assert.equal(r.status, 201);

    const [row] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    assert.ok(row, "user row must exist");
    assert.notEqual(row!.passwordHash, PASSWORD);
    assert.ok(row!.passwordHash.startsWith("$2"), "expected a bcrypt hash");

    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    assert.equal(login.status, 200);
  });

  it("never returns password material in the response", async () => {
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({ email: `reg-safe-${suffix}@oncallfoot.test` }),
    });
    assert.equal(r.status, 201);
    assert.ok(!r.raw.includes(PASSWORD), "plaintext password must not be echoed");
    assert.ok(!r.raw.toLowerCase().includes("passwordhash"), "hash must not be exposed");
  });
});

describe("registration validation", () => {
  it("returns field-specific 400 guidance for invalid input (never 500)", async () => {
    const r = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ firstName: "", lastName: "Bent", email: "not-an-email", password: "short" }),
    });
    assert.equal(r.status, 400);
    const details = r.body["details"] as JsonBody;
    const fieldErrors = details["fieldErrors"] as JsonBody;
    assert.ok(fieldErrors["email"], "email error expected");
    assert.ok(fieldErrors["password"], "password error expected");
    assert.ok(fieldErrors["firstName"], "firstName error expected");
  });

  it("rejects a missing body safely", async () => {
    const r = await apiFetch("/auth/register", { method: "POST", body: "{}" });
    assert.equal(r.status, 400);
  });
});

describe("duplicate email handling", () => {
  it("returns 409 for a sequential duplicate registration", async () => {
    const email = `reg-dup-${suffix}@oncallfoot.test`;
    const first = await apiFetch("/auth/register", { method: "POST", body: registerPayload({ email }) });
    assert.equal(first.status, 201);
    const second = await apiFetch("/auth/register", { method: "POST", body: registerPayload({ email }) });
    assert.equal(second.status, 409);
    assert.equal(second.body["error"], "An account with that email already exists.");
  });

  it("treats email uniqueness case-insensitively", async () => {
    const email = `reg-case-${suffix}@oncallfoot.test`;
    const first = await apiFetch("/auth/register", { method: "POST", body: registerPayload({ email }) });
    assert.equal(first.status, 201);
    const second = await apiFetch("/auth/register", {
      method: "POST",
      body: registerPayload({ email: email.toUpperCase() }),
    });
    assert.equal(second.status, 409);
  });

  it("REGRESSION: concurrent duplicate submissions return 409, never 500 (mobile double-tap)", async () => {
    const email = `reg-race-${suffix}@oncallfoot.test`;
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiFetch("/auth/register", { method: "POST", body: registerPayload({ email }) }),
      ),
    );
    const statuses = attempts.map((a) => a.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1, `exactly one create: ${statuses}`);
    assert.equal(statuses.filter((s) => s === 409).length, 3, `losers must conflict: ${statuses}`);
    assert.ok(!statuses.includes(500), `no internal server error: ${statuses}`);
    for (const attempt of attempts.filter((a) => a.status === 409)) {
      assert.equal(attempt.body["error"], "An account with that email already exists.");
    }

    // Exactly one user row exists.
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    assert.equal(rows.length, 1);
  });
});

describe("auth regression", () => {
  it("login still rejects bad credentials without leaking account existence", async () => {
    const r = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: `reg-nope-${suffix}@oncallfoot.test`, password: "wrong-pass-1" }),
    });
    assert.equal(r.status, 401);
    assert.equal(r.body["error"], "Invalid email or password.");
  });

  it("authenticated routes still reject missing tokens", async () => {
    assert.equal((await apiFetch("/auth/me")).status, 401);
  });
});
