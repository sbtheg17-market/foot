/**
 * Phase 3 authorization hardening coverage.
 *
 * Prerequisites: API server must be running with the development seed and
 * Phase 2 backfill applied.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:authorization
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, ne } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";

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

const providerOperations = [
  "/providers/me",
  "/providers/me/services",
  "/providers/me/availability",
  "/providers/me/travel-zones",
  "/providers/me/earnings",
  "/providers/me/earnings/export",
  "/bookings",
  "/bookings/1",
  "/bookings/1/status",
  "/invoices",
  "/invoices/1",
] as const;

describe("Phase 3 authorization hardening", () => {
  let providerId: number;
  let adminId: number;
  let providerApplicationId: number;
  let providerProfileId: number;
  let otherProviderApplication:
    | typeof providerApplicationsTable.$inferSelect
    | undefined;
  let otherProviderProfileId: number;
  let providerToken: string;
  let adminToken: string;

  before(async () => {
    const provider = await login("sarah@oncallfoot.com");
    const admin = await login("admin@oncallfoot.com");
    providerId = (provider.user["id"] as number);
    adminId = (admin.user["id"] as number);
    providerToken = provider.token;
    adminToken = admin.token;

    const [providerProfile] = await db
      .select({
        id: providerProfilesTable.id,
        userId: providerProfilesTable.userId,
      })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, providerId))
      .limit(1);
    assert.ok(providerProfile);
    providerProfileId = providerProfile.id;

    const [providerApplication] = await db
      .select()
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, providerId))
      .limit(1);
    assert.ok(providerApplication);
    providerApplicationId = providerApplication.id;

    const [otherApplication] = await db
      .select()
      .from(providerApplicationsTable)
      .where(
        and(
          ne(providerApplicationsTable.userId, providerId),
          eq(providerApplicationsTable.status, "approved"),
        ),
      )
      .limit(1);
    assert.ok(otherApplication);
    otherProviderApplication = otherApplication;
    otherProviderProfileId = otherApplication.providerProfileId;
  });

  after(async () => {
    // The individual tests restore every temporary state. This final guard
    // restores the provider application status/profile linkage if a test
    // assertion interrupts its normal cleanup.
    await db
      .update(providerApplicationsTable)
      .set({
        userId: providerId,
        providerProfileId,
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(providerApplicationsTable.id, providerApplicationId));

    if (otherProviderApplication) {
      const existing = await db
        .select({ id: providerApplicationsTable.id })
        .from(providerApplicationsTable)
        .where(eq(providerApplicationsTable.id, otherProviderApplication.id))
        .limit(1);
      if (existing.length === 0) {
        await db
          .insert(providerApplicationsTable)
          .values(otherProviderApplication)
          .onConflictDoNothing();
      } else {
        await db
          .update(providerApplicationsTable)
          .set({
            userId: otherProviderApplication.userId,
            providerProfileId: otherProviderProfileId,
            status: otherProviderApplication.status,
            updatedAt: new Date(),
          })
          .where(eq(providerApplicationsTable.id, otherProviderApplication.id));
      }
    }

    await db
      .insert(accountRolesTable)
      .values({ userId: providerId, role: "provider" })
      .onConflictDoNothing();
    await db
      .insert(accountRolesTable)
      .values({ userId: adminId, role: "admin" })
      .onConflictDoNothing();
  });

  it("requires a database-backed provider membership, not only the JWT role", async () => {
    await db
      .delete(accountRolesTable)
      .where(eq(accountRolesTable.userId, providerId));

    try {
      const result = await apiFetch("/providers/me", { token: providerToken });
      assert.equal(result.status, 403);
    } finally {
      await db
        .insert(accountRolesTable)
        .values({ userId: providerId, role: "provider" })
        .onConflictDoNothing();
    }
  });

  it("requires database-backed admin membership for admin routes", async () => {
    const allowed = await apiFetch("/admin/verification/queue", {
      token: adminToken,
    });
    assert.equal(allowed.status, 200);

    await db
      .delete(accountRolesTable)
      .where(eq(accountRolesTable.userId, adminId));

    try {
      const denied = await apiFetch("/admin/verification/queue", {
        token: adminToken,
      });
      assert.equal(denied.status, 403);
    } finally {
      await db
        .insert(accountRolesTable)
        .values({ userId: adminId, role: "admin" })
        .onConflictDoNothing();
    }
  });

  it("rejects a provider application linked to another provider profile", async () => {
    assert.ok(otherProviderApplication);

    await db
      .delete(providerApplicationsTable)
      .where(eq(providerApplicationsTable.id, otherProviderApplication.id));
    await db
      .update(providerApplicationsTable)
      .set({
        providerProfileId: otherProviderProfileId,
        updatedAt: new Date(),
      })
      .where(eq(providerApplicationsTable.id, providerApplicationId));

    try {
      const result = await apiFetch("/providers/me", { token: providerToken });
      assert.equal(result.status, 403);
    } finally {
      await db
        .update(providerApplicationsTable)
        .set({
          providerProfileId,
          status: "approved",
          updatedAt: new Date(),
        })
        .where(eq(providerApplicationsTable.id, providerApplicationId));
      await db
        .insert(providerApplicationsTable)
        .values(otherProviderApplication)
        .onConflictDoNothing();
    }
  });

  for (const status of [
    "under_review",
    "rejected",
    "suspended",
  ] as const) {
    it(`denies all operational provider routes while application is ${status}`, async () => {
      await db
        .update(providerApplicationsTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(providerApplicationsTable.id, providerApplicationId));

      try {
        for (const path of providerOperations) {
          const result = await apiFetch(path, {
            token: providerToken,
            ...(path.endsWith("/status")
              ? {
                  method: "PATCH",
                  body: JSON.stringify({ status: "confirmed" }),
                }
              : {}),
          });
          assert.equal(
            result.status,
            403,
            `${status} provider unexpectedly accessed ${path}`,
          );
        }
      } finally {
        await db
          .update(providerApplicationsTable)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(providerApplicationsTable.id, providerApplicationId));
      }
    });
  }

  it("denies provider operations when the profile verification is not approved", async () => {
    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "pending", updatedAt: new Date() })
      .where(eq(providerProfilesTable.id, providerProfileId));

    try {
      const result = await apiFetch("/providers/me", { token: providerToken });
      assert.equal(result.status, 403);
    } finally {
      await db
        .update(providerProfilesTable)
        .set({ verificationStatus: "approved", updatedAt: new Date() })
        .where(eq(providerProfilesTable.id, providerProfileId));
    }
  });
});