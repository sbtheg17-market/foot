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
import { eq, sql } from "drizzle-orm";
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

describe("provider provisioning", () => {
  const providerPayload = (email: string) =>
    registerPayload({ email, roleIntent: "provider", role: "provider" });

  async function providerRecords(email: string) {
    const result = await db.execute<{
      user_id: number;
      profile_id: number;
      application_id: number;
      status: string;
    }>(sql`
      select u.id as user_id, p.id as profile_id, a.id as application_id, a.status
      from users u
      join provider_profiles p on p.user_id = u.id
      join provider_applications a on a.user_id = u.id and a.provider_profile_id = p.id
      where u.email = ${email}`);
    return result.rows;
  }

  it("REGRESSION: provider signup succeeds when newer additive provider columns are absent (Gate B pending)", async () => {
    // Simulates a deployed database whose newest additive provider columns
    // are still pending the frozen Gate B migrations (docs/migrations/*):
    // provider_profiles booking-page columns (#11) and
    // provider_applications.rejection_reason. Drizzle's insert builder lists
    // every schema column, so signup previously failed 42703 → 500 on such a
    // database — provider-only, while client signup worked.
    await db.execute(sql`alter table provider_applications drop column if exists rejection_reason`);
    await db.execute(sql`drop index if exists provider_profiles_public_slug_unique_idx`);
    await db.execute(sql`
      alter table provider_profiles
        drop column if exists public_slug,
        drop column if exists booking_page_published,
        drop column if exists booking_page_published_at`);
    try {
      const email = `provider-signup-test-drift-${suffix}@example.test`;
      const r = await apiFetch("/auth/register", { method: "POST", body: providerPayload(email) });
      assert.equal(r.status, 201, r.raw.slice(0, 300));
      const user = r.body["user"] as JsonBody;
      assert.equal(user["role"], "provider");
      assert.equal((user["providerApplication"] as JsonBody)["status"], "draft");

      // Success is not masked: the required records genuinely exist.
      const rows = await providerRecords(email);
      assert.equal(rows.length, 1, "profile + application must exist");
      assert.equal(rows[0]!.status, "draft");
    } finally {
      // Restore schema parity (same DDL as the frozen artifacts).
      await db.execute(sql`alter table provider_profiles add column if not exists public_slug text`);
      await db.execute(
        sql`alter table provider_profiles add column if not exists booking_page_published boolean default false not null`,
      );
      await db.execute(
        sql`alter table provider_profiles add column if not exists booking_page_published_at timestamp`,
      );
      await db.execute(
        sql`create unique index if not exists provider_profiles_public_slug_unique_idx on provider_profiles (public_slug)`,
      );
      await db.execute(sql`alter table provider_applications add column if not exists rejection_reason text`);
    }
  });

  it("rolls back the whole registration when provisioning fails, then a retry succeeds", async () => {
    const email = `provider-signup-test-retry-${suffix}@example.test`;
    await db.execute(sql`
      create or replace function reg_test_fail_provisioning() returns trigger as $$
      begin raise exception 'reg-test forced provisioning failure'; end;
      $$ language plpgsql`);
    await db.execute(sql`
      create trigger reg_test_block_applications
      before insert on provider_applications
      for each row execute function reg_test_fail_provisioning()`);
    try {
      const r = await apiFetch("/auth/register", { method: "POST", body: providerPayload(email) });
      assert.equal(r.status, 500);
      assert.equal(r.body["error"], "Internal server error", "safe generic body only");
      assert.ok(
        !r.raw.toLowerCase().includes("provisioning failure"),
        "must not leak SQL/exception details",
      );

      // Full rollback — no orphaned user, profile, or application.
      const users = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email));
      assert.equal(users.length, 0, "failed provisioning must not orphan a user");
    } finally {
      await db.execute(sql`drop trigger if exists reg_test_block_applications on provider_applications`);
      await db.execute(sql`drop function if exists reg_test_fail_provisioning`);
    }

    // Retry with the same email now succeeds (idempotent recovery), with
    // exactly one profile and one application.
    const retry = await apiFetch("/auth/register", { method: "POST", body: providerPayload(email) });
    assert.equal(retry.status, 201, retry.raw.slice(0, 300));
    const rows = await providerRecords(email);
    assert.equal(rows.length, 1, "exactly one profile + application after retry");
  });

  it("concurrent duplicate PROVIDER submissions create exactly one account and one application", async () => {
    const email = `provider-signup-test-race-${suffix}@example.test`;
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiFetch("/auth/register", { method: "POST", body: providerPayload(email) }),
      ),
    );
    const statuses = attempts.map((a) => a.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1, `exactly one create: ${statuses}`);
    assert.equal(statuses.filter((s) => s === 409).length, 3, `losers must conflict: ${statuses}`);
    assert.ok(!statuses.includes(500), `no internal server error: ${statuses}`);

    const rows = await providerRecords(email);
    assert.equal(rows.length, 1, "no duplicate provider profiles/applications");
  });
});
