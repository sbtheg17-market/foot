/**
 * Provider first-login return path — schema-drift regression guard.
 *
 * Regression suite for the provider return-path blocker: a newly signed-up
 * provider signed up successfully (signup provisions via narrow raw SQL that
 * avoids Gate B-pending additive columns), but on logout → re-login →
 * /provider/application-status the owner status reads selected the Gate
 * B-pending columns (provider_applications.rejection_reason,
 * provider_profiles booking-page columns) and Gate B-pending tables
 * (provider_service_areas / provider_coverage_areas), failing 42703/42P01 →
 * 500 → the generic "We couldn't load your application status." error.
 *
 * This suite simulates a deployed database WITHOUT the frozen Gate B
 * artifacts and proves the whole first-return journey stays truthful:
 * signup → re-login → activation-status → application/status → refresh,
 * plus unchanged 401/403 boundaries, owner isolation, and no internals
 * leaking. A second describe proves the migrated (current-schema) path still
 * surfaces rejectionReason unchanged.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:return-path-drift
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { db, providerApplicationsTable } from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "return-path-drift-pass-1";
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

async function register(email: string, role: "provider" | "client") {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Return",
      lastName: "Path",
      email,
      password: PASSWORD,
      roleIntent: role,
      role,
    }),
  });
  assert.equal(r.status, 201, r.raw.slice(0, 300));
  return {
    token: r.body["token"] as string,
    userId: ((r.body["user"] as JsonBody)["id"]) as number,
  };
}

async function login(email: string) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(r.status, 200, r.raw.slice(0, 300));
  return r.body["token"] as string;
}

/** No raw SQL, pg error codes, or query internals in any client response. */
function assertNoInternalsLeak(raw: string) {
  for (const marker of [
    "42703",
    "42P01",
    "does not exist",
    "Failed query",
    "select \"",
    "DrizzleQueryError",
    "stack",
    "reviewerNotes",
  ]) {
    assert.ok(
      !raw.includes(marker),
      `response must not leak internals (found ${JSON.stringify(marker)}): ${raw.slice(0, 200)}`,
    );
  }
}

/** Same DDL the frozen Gate B artifacts add — dropped to simulate drift. */
async function dropGateBRelations() {
  await db.execute(sql`alter table provider_applications drop column if exists rejection_reason`);
  await db.execute(sql`drop index if exists provider_profiles_public_slug_unique_idx`);
  await db.execute(sql`
    alter table provider_profiles
      drop column if exists public_slug,
      drop column if exists booking_page_published,
      drop column if exists booking_page_published_at`);
  await db.execute(sql`drop table if exists provider_coverage_areas`);
  await db.execute(sql`drop table if exists provider_service_areas`);
}

/** Restore schema parity (same DDL as the frozen artifacts). */
async function restoreGateBRelations() {
  await db.execute(sql`alter table provider_applications add column if not exists rejection_reason text`);
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
  await db.execute(sql`
    create table if not exists provider_service_areas (
      id serial primary key,
      provider_id integer not null unique
        references provider_profiles(id) on delete cascade,
      country_code text default 'CA' not null,
      province_code text default '' not null,
      city text,
      public_description text,
      is_active boolean default true not null,
      created_at timestamp default now() not null,
      updated_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create table if not exists provider_coverage_areas (
      id serial primary key,
      provider_id integer not null
        references provider_profiles(id) on delete cascade,
      country_code text default 'CA' not null,
      prefix text not null,
      is_active boolean default true not null,
      created_at timestamp default now() not null
    )`);
  await db.execute(sql`
    create unique index if not exists provider_coverage_areas_active_prefix_unique_idx
      on provider_coverage_areas (provider_id, country_code, prefix)
      where is_active = true`);
  await db.execute(sql`
    create index if not exists provider_coverage_areas_provider_active_idx
      on provider_coverage_areas (provider_id, is_active)`);
}

describe("provider first-return journey on a pre-Gate-B database (drift simulation)", () => {
  const PROVIDER_EMAIL = `drift-return-provider-${suffix}@oncallfoot.test`;
  const OTHER_EMAIL = `drift-return-other-${suffix}@oncallfoot.test`;
  const CLIENT_EMAIL = `drift-return-client-${suffix}@oncallfoot.test`;

  before(dropGateBRelations);
  after(restoreGateBRelations);

  let reloginToken = "";

  it("fresh provider signup provisions the required state (201, draft application)", async () => {
    const { token } = await register(PROVIDER_EMAIL, "provider");
    assert.ok(token, "signup must return a working session token");
  });

  it("logout → re-login issues a working session", async () => {
    reloginToken = await login(PROVIDER_EMAIL);
    const me = await apiFetch("/auth/me", { token: reloginToken });
    assert.equal(me.status, 200, me.raw.slice(0, 300));
  });

  it("GET /providers/me/activation-status returns a truthful draft state — not 500", async () => {
    const r = await apiFetch("/providers/me/activation-status", { token: reloginToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const activation = r.body["activation"] as JsonBody;
    assert.ok(activation, "response must include activation");
    assert.equal(activation["applicationStatus"], "draft");
    assert.equal(activation["nextAction"], "continue_onboarding");
    assert.equal(activation["rejectionReason"], null, "degrades to null, never 500");
    const milestones = activation["milestones"] as JsonBody;
    assert.equal(milestones["accountCreated"], true);
    assert.equal(milestones["approved"], false, "no fabricated approval");
    assert.equal(milestones["bookingPagePublished"], false, "truthful pre-#11 state");
    assert.equal(milestones["serviceAreaConfigured"], false, "truthful pre-#12 state");
    const bookingPage = activation["bookingPage"] as JsonBody;
    assert.equal(bookingPage["slug"], null);
    assert.equal(bookingPage["published"], false);
    assert.equal(bookingPage["eligible"], false);
    assertNoInternalsLeak(r.raw);
  });

  it("GET /providers/application/status (mobile hub path) returns the draft status — not 500", async () => {
    const r = await apiFetch("/providers/application/status", { token: reloginToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const status = r.body["status"] as JsonBody;
    assert.ok(status, "response must include status");
    assert.equal(status["status"], "draft");
    assert.equal(status["nextAction"], "resume_draft");
    assert.equal(status["rejectionReason"], null);
    assert.equal(status["submissionCount"], 0);
    assert.equal(status["canEdit"], true);
    assertNoInternalsLeak(r.raw);
  });

  it("browser-refresh equivalent (fresh request, same token) still succeeds", async () => {
    const r = await apiFetch("/providers/me/activation-status", { token: reloginToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    assert.equal(((r.body["activation"] as JsonBody) ?? {})["applicationStatus"], "draft");
  });

  it("GET /providers/application (owner read) also survives drift", async () => {
    const r = await apiFetch("/providers/application", { token: reloginToken });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const application = r.body["application"] as JsonBody;
    assert.equal(application["status"], "draft");
    assert.equal(application["rejectionReason"], null);
    assertNoInternalsLeak(r.raw);
  });

  it("owner scoping is intact: a second provider only ever sees their own application", async () => {
    await register(OTHER_EMAIL, "provider");
    const otherToken = await login(OTHER_EMAIL);
    const own = await apiFetch("/providers/application", { token: reloginToken });
    const other = await apiFetch("/providers/application", { token: otherToken });
    assert.equal(other.status, 200, other.raw.slice(0, 300));
    const ownId = (own.body["application"] as JsonBody)["id"];
    const otherId = (other.body["application"] as JsonBody)["id"];
    assert.notEqual(ownId, otherId, "each provider must see only their own application");
  });

  it("client-only account still gets the dedicated 403 branch (never masked)", async () => {
    const { token } = await register(CLIENT_EMAIL, "client");
    const activation = await apiFetch("/providers/me/activation-status", { token });
    assert.equal(activation.status, 403);
    const status = await apiFetch("/providers/application/status", { token });
    assert.equal(status.status, 403);
  });

  it("unauthenticated access is still denied with 401 (never masked)", async () => {
    const activation = await apiFetch("/providers/me/activation-status");
    assert.equal(activation.status, 401);
    const status = await apiFetch("/providers/application/status");
    assert.equal(status.status, 401);
  });
});

describe("migrated (current-schema) path is unchanged after the drift guard", () => {
  const EMAIL = `drift-return-healthy-${suffix}@oncallfoot.test`;
  const REASON = "Please re-upload a readable copy of your insurance document.";

  it("rejected application still surfaces the provider-visible rejectionReason", async () => {
    const { token, userId } = await register(EMAIL, "provider");
    await db
      .update(providerApplicationsTable)
      .set({ status: "rejected", rejectionReason: REASON, reviewedAt: new Date() })
      .where(eq(providerApplicationsTable.userId, userId));

    const status = await apiFetch("/providers/application/status", { token });
    assert.equal(status.status, 200, status.raw.slice(0, 300));
    const view = status.body["status"] as JsonBody;
    assert.equal(view["status"], "rejected");
    assert.equal(view["rejectionReason"], REASON, "migrated column must pass through");
    assert.equal(view["canReset"], true);
    assert.equal(view["nextAction"], "reset_to_draft");

    const activation = await apiFetch("/providers/me/activation-status", { token });
    assert.equal(activation.status, 200, activation.raw.slice(0, 300));
    const act = activation.body["activation"] as JsonBody;
    assert.equal(act["applicationStatus"], "rejected");
    assert.equal(act["rejectionReason"], REASON);
    assert.equal(act["nextAction"], "review_update_needed");
    assert.equal(act["canReset"], true);
  });

  it("draft provider on the migrated schema gets the same truthful state as under drift", async () => {
    const email = `drift-return-parity-${suffix}@oncallfoot.test`;
    const { token } = await register(email, "provider");
    const r = await apiFetch("/providers/me/activation-status", { token });
    assert.equal(r.status, 200, r.raw.slice(0, 300));
    const activation = r.body["activation"] as JsonBody;
    assert.equal(activation["applicationStatus"], "draft");
    assert.equal(activation["nextAction"], "continue_onboarding");
    assert.equal(activation["rejectionReason"], null);
    assert.equal((activation["bookingPage"] as JsonBody)["published"], false);
  });
});
