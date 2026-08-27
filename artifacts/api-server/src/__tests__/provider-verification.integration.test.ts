/**
 * Provider verification-document submission (POST/GET /providers/me/verification)
 * — integration.
 *
 * Regression suite for the provider onboarding "Internal server error"
 * blocker: getOwnProfile() selected every provider_profiles schema column, so
 * on a database where the Gate B-pending booking-page columns
 * (docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql) are not applied yet,
 * both verification routes failed 42703 → 500 before any validation or
 * persistence. Covers: registration regression, every supported doc type,
 * optional notes, required-field + bounds validation, ownership/authz
 * denials, cross-provider isolation, duplicate + concurrent idempotency,
 * forced-failure rollback + retry, safe error contract, schema-drift
 * simulation, and onboarding progression (pending → under_review,
 * verificationComplete).
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:verification
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "verification-pass-1";
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

let providerCounter = 0;

/** Registers a fresh provider (sanitized test identity) and returns its session. */
async function registerProvider(): Promise<{ token: string; email: string }> {
  providerCounter += 1;
  const email = `provider-verification-test-${suffix}-${providerCounter}@example.test`;
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Vera",
      lastName: "Fication",
      email,
      password: PASSWORD,
      roleIntent: "provider",
      role: "provider",
    }),
  });
  assert.equal(r.status, 201, `provider registration must succeed: ${r.raw.slice(0, 300)}`);
  return { token: r.body["token"] as string, email };
}

async function registerClient(): Promise<{ token: string }> {
  const email = `client-verification-test-${suffix}@example.test`;
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Cli",
      lastName: "Ent",
      email,
      password: PASSWORD,
      roleIntent: "client",
      role: "client",
    }),
  });
  assert.equal(r.status, 201, r.raw.slice(0, 300));
  return { token: r.body["token"] as string };
}

async function profileByEmail(
  email: string,
): Promise<{ id: number; verification_status: string }> {
  const result = await db.execute<{ id: number; verification_status: string }>(sql`
    select p.id, p.verification_status
    from provider_profiles p join users u on u.id = p.user_id
    where u.email = ${email}`);
  assert.ok(result.rows[0], `profile must exist for ${email}`);
  return result.rows[0]!;
}

async function docRows(
  profileId: number,
): Promise<Array<{ id: number; doc_type: string; file_name: string; status: string; reviewer_notes: string | null }>> {
  const result = await db.execute<{
    id: number;
    doc_type: string;
    file_name: string;
    status: string;
    reviewer_notes: string | null;
  }>(sql`
    select id, doc_type, file_name, status, reviewer_notes
    from verification_docs where provider_id = ${profileId} order by id`);
  return result.rows;
}

function submitBody(overrides: JsonBody = {}): string {
  return JSON.stringify({
    docType: "license",
    fileName: `LIC-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  });
}

describe("submission success paths", () => {
  it("accepts a valid professional-license reference and advances pending → under_review", async () => {
    const { token, email } = await registerProvider();
    const before = await profileByEmail(email);
    assert.equal(before.verification_status, "pending");

    const r = await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: submitBody({ fileName: "License #RPN-12345, College of Nurses" }),
    });
    assert.equal(r.status, 201, r.raw.slice(0, 300));
    const doc = r.body["doc"] as JsonBody;
    assert.equal(doc["docType"], "license");
    assert.equal(doc["fileName"], "License #RPN-12345, College of Nurses");
    assert.equal(doc["status"], "pending");
    assert.equal(doc["reviewerNotes"], null);

    const after = await profileByEmail(email);
    assert.equal(after.verification_status, "under_review");
    assert.equal((await docRows(after.id)).length, 1, "exactly one record written");

    const g = await apiFetch("/providers/me/verification", { token });
    assert.equal(g.status, 200);
    assert.equal(g.body["verificationStatus"], "under_review");
    assert.equal((g.body["docs"] as JsonBody[]).length, 1);
  });

  it("accepts every supported document type", async () => {
    const { token, email } = await registerProvider();
    for (const docType of ["license", "insurance", "certification", "other"]) {
      const r = await apiFetch("/providers/me/verification", {
        method: "POST",
        token,
        body: submitBody({ docType, fileName: `REF-${docType}-${suffix}` }),
      });
      assert.equal(r.status, 201, `${docType}: ${r.raw.slice(0, 200)}`);
      assert.equal((r.body["doc"] as JsonBody)["docType"], docType);
    }
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 4);
  });

  it("stores trimmed optional reviewer notes, and null when omitted", async () => {
    const { token, email } = await registerProvider();
    const withNotes = await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: submitBody({ fileName: `REF-notes-${suffix}`, notes: "  issued 2024, renews yearly  " }),
    });
    assert.equal(withNotes.status, 201);
    assert.equal((withNotes.body["doc"] as JsonBody)["reviewerNotes"], "issued 2024, renews yearly");

    const withoutNotes = await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: submitBody({ fileName: `REF-no-notes-${suffix}` }),
    });
    assert.equal(withoutNotes.status, 201);
    assert.equal((withoutNotes.body["doc"] as JsonBody)["reviewerNotes"], null);

    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 2);
  });

  it("marks verification complete for onboarding after the first document", async () => {
    const { token } = await registerProvider();
    const before = await apiFetch("/providers/application/completion", { token });
    assert.equal(before.status, 200, before.raw.slice(0, 200));
    assert.equal((before.body["completion"] as JsonBody)["verificationComplete"], false);

    const r = await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: submitBody(),
    });
    assert.equal(r.status, 201);

    const after = await apiFetch("/providers/application/completion", { token });
    assert.equal(after.status, 200);
    assert.equal((after.body["completion"] as JsonBody)["verificationComplete"], true);
  });
});

describe("validation (client-safe 400s, nothing persisted)", () => {
  it("rejects missing/invalid docType, missing/short/over-length reference, and over-length or non-string notes", async () => {
    const { token, email } = await registerProvider();
    const cases: Array<{ name: string; body: string }> = [
      { name: "missing docType", body: JSON.stringify({ fileName: "REF-123456" }) },
      { name: "invalid docType", body: submitBody({ docType: "passport" }) },
      { name: "non-string docType", body: submitBody({ docType: 7 }) },
      { name: "missing fileName", body: JSON.stringify({ docType: "license" }) },
      { name: "blank fileName", body: submitBody({ fileName: "   " }) },
      { name: "too-short fileName", body: submitBody({ fileName: "ab" }) },
      { name: "over-length fileName", body: submitBody({ fileName: "x".repeat(201) }) },
      { name: "non-string fileName", body: submitBody({ fileName: 12345 }) },
      { name: "over-length notes", body: submitBody({ notes: "n".repeat(1001) }) },
      { name: "non-string notes", body: submitBody({ notes: { nested: true } }) },
    ];
    for (const c of cases) {
      const r = await apiFetch("/providers/me/verification", { method: "POST", token, body: c.body });
      assert.equal(r.status, 400, `${c.name}: expected 400, got ${r.status} ${r.raw.slice(0, 200)}`);
      assert.ok(r.body["error"], `${c.name}: must return a client-safe error message`);
      assert.ok(!r.raw.includes("Internal server error"), `${c.name}: never a generic 500 message`);
    }
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 0, "no record persisted by invalid input");
    assert.equal(profile.verification_status, "pending", "status untouched by invalid input");
  });

  it("accepts a reference of exactly 200 chars and notes of exactly 1000 chars (boundary)", async () => {
    const { token } = await registerProvider();
    const r = await apiFetch("/providers/me/verification", {
      method: "POST",
      token,
      body: submitBody({ fileName: "R".repeat(200), notes: "n".repeat(1000) }),
    });
    assert.equal(r.status, 201, r.raw.slice(0, 200));
  });
});

describe("authorization and privacy", () => {
  it("denies unauthenticated, client-role, and keeps providers isolated from each other", async () => {
    const unauth = await apiFetch("/providers/me/verification", { method: "POST", body: submitBody() });
    assert.equal(unauth.status, 401);

    const { token: clientToken } = await registerClient();
    const asClient = await apiFetch("/providers/me/verification", { method: "POST", token: clientToken, body: submitBody() });
    assert.equal(asClient.status, 403);
    const clientGet = await apiFetch("/providers/me/verification", { token: clientToken });
    assert.equal(clientGet.status, 403);

    // Cross-provider isolation: the route is owner-scoped by session; another
    // provider can never read or write someone else's documents.
    const a = await registerProvider();
    const b = await registerProvider();
    const submitA = await apiFetch("/providers/me/verification", {
      method: "POST",
      token: a.token,
      body: submitBody({ fileName: `REF-owner-a-${suffix}` }),
    });
    assert.equal(submitA.status, 201);
    const bView = await apiFetch("/providers/me/verification", { token: b.token });
    assert.equal(bView.status, 200);
    assert.equal((bView.body["docs"] as JsonBody[]).length, 0, "provider B must not see provider A's docs");
    const bProfile = await profileByEmail(b.email);
    assert.equal(bProfile.verification_status, "pending", "provider B status untouched by A's submission");
  });
});

describe("duplicate, retry, and concurrency safety", () => {
  it("is idempotent for an identical pending submission (retry/double-tap)", async () => {
    const { token, email } = await registerProvider();
    const payload = submitBody({ fileName: `REF-idem-${suffix}` });
    const first = await apiFetch("/providers/me/verification", { method: "POST", token, body: payload });
    const second = await apiFetch("/providers/me/verification", { method: "POST", token, body: payload });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(
      (first.body["doc"] as JsonBody)["id"],
      (second.body["doc"] as JsonBody)["id"],
      "retry returns the same record",
    );
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 1, "exactly one record after retry");
  });

  it("creates exactly one record under concurrent double submission", async () => {
    const { token, email } = await registerProvider();
    const payload = submitBody({ fileName: `REF-conc-${suffix}` });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiFetch("/providers/me/verification", { method: "POST", token, body: payload }),
      ),
    );
    for (const r of results) assert.equal(r.status, 201, r.raw.slice(0, 200));
    const ids = new Set(results.map((r) => (r.body["doc"] as JsonBody)["id"]));
    assert.equal(ids.size, 1, "all concurrent submissions resolve to the same record");
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 1);
    assert.equal(profile.verification_status, "under_review");
  });

  it("still records distinct documents (different reference) separately", async () => {
    const { token, email } = await registerProvider();
    const r1 = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: `REF-d1-${suffix}` }) });
    const r2 = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: `REF-d2-${suffix}` }) });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 2);
  });

  it("allows resubmission after a rejection (rejected docs do not block)", async () => {
    const { token, email } = await registerProvider();
    const ref = `REF-resub-${suffix}`;
    const first = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: ref }) });
    assert.equal(first.status, 201);
    const profile = await profileByEmail(email);
    await db.execute(sql`update verification_docs set status = 'rejected' where provider_id = ${profile.id}`);

    const again = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: ref }) });
    assert.equal(again.status, 201);
    assert.notEqual(
      (again.body["doc"] as JsonBody)["id"],
      (first.body["doc"] as JsonBody)["id"],
      "resubmission after rejection creates a fresh pending record",
    );
    const rows = await docRows(profile.id);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.status).sort(), ["pending", "rejected"]);
  });

  it("rolls back everything on a forced failure (safe 500, no orphan) and a retry then succeeds", async () => {
    const { token, email } = await registerProvider();
    await db.execute(sql`
      create or replace function verif_test_fail_${sql.raw(String(process.pid))}() returns trigger as $$
      begin raise exception 'verif-test forced insert failure'; end;
      $$ language plpgsql`);
    await db.execute(sql`
      create trigger verif_test_block before insert on verification_docs
      for each row execute function verif_test_fail_${sql.raw(String(process.pid))}()`);
    try {
      const r = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: `REF-fail-${suffix}` }) });
      assert.equal(r.status, 500);
      assert.deepEqual(r.body, { error: "Internal server error" }, "safe error contract");
      assert.ok(!r.raw.toLowerCase().includes("drizzle"), "no ORM internals leaked");
      assert.ok(!r.raw.includes("select "), "no SQL leaked");

      const profile = await profileByEmail(email);
      assert.equal((await docRows(profile.id)).length, 0, "no orphaned record");
      assert.equal(profile.verification_status, "pending", "status bump rolled back with the insert");
    } finally {
      await db.execute(sql`drop trigger if exists verif_test_block on verification_docs`);
      await db.execute(sql`drop function if exists verif_test_fail_${sql.raw(String(process.pid))}()`);
    }

    const retry = await apiFetch("/providers/me/verification", { method: "POST", token, body: submitBody({ fileName: `REF-fail-${suffix}` }) });
    assert.equal(retry.status, 201, "retry after the transient failure succeeds");
    const profile = await profileByEmail(email);
    assert.equal((await docRows(profile.id)).length, 1);
    assert.equal(profile.verification_status, "under_review");
  });
});

describe("schema-drift safety (Gate B pending columns)", () => {
  it("REGRESSION: verification GET+POST succeed when newer additive columns are absent", async () => {
    // Same drift simulation as registration.test.ts: a deployed database
    // whose newest additive columns still await the frozen Gate B artifacts
    // (PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql booking-page columns and
    // PROVIDER_APPLICATION_REJECTION_REASON_V1.sql rejection_reason).
    // Previously both routes failed 42703 → 500 here, before any validation
    // or persistence, because getOwnProfile() selected every schema column.
    await db.execute(sql`alter table provider_applications drop column if exists rejection_reason`);
    await db.execute(sql`drop index if exists provider_profiles_public_slug_unique_idx`);
    await db.execute(sql`
      alter table provider_profiles
        drop column if exists public_slug,
        drop column if exists booking_page_published,
        drop column if exists booking_page_published_at`);
    try {
      const { token, email } = await registerProvider();

      const g = await apiFetch("/providers/me/verification", { token });
      assert.equal(g.status, 200, `GET under drift: ${g.raw.slice(0, 200)}`);

      const r = await apiFetch("/providers/me/verification", {
        method: "POST",
        token,
        body: submitBody({ fileName: `REF-drift-${suffix}`, notes: "submitted under drift" }),
      });
      assert.equal(r.status, 201, `POST under drift: ${r.raw.slice(0, 200)}`);

      // Success is not masked: the record genuinely exists and status advanced.
      const profile = await profileByEmail(email);
      const rows = await docRows(profile.id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.file_name, `REF-drift-${suffix}`);
      assert.equal(rows[0]!.reviewer_notes, "submitted under drift");
      assert.equal(profile.verification_status, "under_review");
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
});
