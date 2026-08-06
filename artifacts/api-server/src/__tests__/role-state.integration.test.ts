/**
 * Phase 2 role-state integration coverage.
 *
 * Prerequisites: API server must be running and seeded/backfilled.
 * Run: pnpm --filter @workspace/api-server run test:role-state
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = options;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers as Record<string, string> ?? {}),
    },
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function login(email: string): Promise<{
  token: string;
  user: Record<string, unknown>;
}> {
  const result = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "demo1234" }),
  });
  assert.equal(result.status, 200);
  return {
    token: result.body["token"] as string,
    user: result.body["user"] as Record<string, unknown>,
  };
}

describe("server-confirmed role state", () => {
  before(async () => {
    const health = await apiFetch("/healthz");
    assert.equal(health.status, 200);
  });

  it("reports a backfilled client membership without changing legacy role", async () => {
    const session = await login("jane@oncallfoot.com");
    assert.equal(session.user["role"], "client");
    assert.deepEqual(session.user["roles"], ["client"]);
    assert.equal(session.user["activeRole"], "client");
    assert.deepEqual(session.user["onboarding"], {
      client: "complete",
      provider: null,
    });
    assert.equal(session.user["providerApplication"], null);

    const me = await apiFetch("/auth/me", { token: session.token });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body["user"], {
      ...session.user,
      isActive: true,
      createdAt: (me.body["user"] as Record<string, unknown>)["createdAt"],
    });
  });

  it("reports the approved provider application separately from the role", async () => {
    const session = await login("sarah@oncallfoot.com");
    assert.equal(session.user["role"], "provider");
    assert.deepEqual(session.user["roles"], ["provider"]);
    assert.equal(session.user["activeRole"], "provider");
    assert.deepEqual(session.user["onboarding"], {
      client: null,
      provider: "approved",
    });

    const application = session.user["providerApplication"] as Record<string, unknown>;
    assert.equal(application["status"], "approved");
    assert.equal(application["currentStep"], "submitted");
    assert.equal(typeof application["id"], "number");
  });
});