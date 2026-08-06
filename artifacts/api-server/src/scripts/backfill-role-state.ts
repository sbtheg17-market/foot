import { eq } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  pool,
  providerApplicationsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";

type Role = "client" | "provider" | "admin";
type ProviderProfileStatus = "pending" | "under_review" | "approved" | "rejected";

const VALID_ROLES = new Set<Role>(["client", "provider", "admin"]);
const VALID_PROFILE_STATUSES = new Set<ProviderProfileStatus>([
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

function failPreflight(message: string): never {
  throw new Error(`Role-state backfill preflight failed: ${message}`);
}

function applicationStatusForProfile(
  status: ProviderProfileStatus,
): "under_review" | "approved" | "rejected" {
  if (status === "pending") {
    failPreflight(
      "provider_profiles.status=pending requires an approved submission/document mapping before backfill",
    );
  }
  if (!VALID_PROFILE_STATUSES.has(status)) {
    failPreflight(`unknown provider profile status: ${status}`);
  }
  return status;
}

async function runBackfill(): Promise<void> {
  await db.transaction(async (tx) => {
    const users = await tx
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(usersTable);
    const providerProfiles = await tx
      .select({
        id: providerProfilesTable.id,
        userId: providerProfilesTable.userId,
        verificationStatus: providerProfilesTable.verificationStatus,
        createdAt: providerProfilesTable.createdAt,
      })
      .from(providerProfilesTable);
    const existingRoles = await tx
      .select({
        userId: accountRolesTable.userId,
        role: accountRolesTable.role,
      })
      .from(accountRolesTable);
    const existingApplications = await tx
      .select({
        id: providerApplicationsTable.id,
        userId: providerApplicationsTable.userId,
        providerProfileId: providerApplicationsTable.providerProfileId,
      })
      .from(providerApplicationsTable);

    const userById = new Map(users.map((user) => [user.id, user]));
    const profileByUserId = new Map<number, (typeof providerProfiles)[number]>();
    const emails = new Set<string>();

    for (const user of users) {
      if (!VALID_ROLES.has(user.role)) {
        failPreflight(`user ${user.id} has an unknown role`);
      }
      if (emails.has(user.email)) {
        failPreflight(`duplicate email detected: ${user.email}`);
      }
      emails.add(user.email);
    }

    for (const profile of providerProfiles) {
      const owner = userById.get(profile.userId);
      if (!owner) {
        failPreflight(`provider profile ${profile.id} has no user owner`);
      }
      if (owner.role !== "provider") {
        failPreflight(
          `provider profile ${profile.id} belongs to non-provider user ${owner.id}`,
        );
      }
      if (profileByUserId.has(profile.userId)) {
        failPreflight(`user ${profile.userId} has duplicate provider profiles`);
      }
      profileByUserId.set(profile.userId, profile);
      if (!VALID_PROFILE_STATUSES.has(profile.verificationStatus)) {
        failPreflight(`provider profile ${profile.id} has an unknown status`);
      }
      if (profile.verificationStatus === "pending") {
        failPreflight(
          `provider profile ${profile.id} is pending and needs an explicit mapping decision`,
        );
      }
    }

    for (const user of users) {
      if (user.role === "provider" && !profileByUserId.has(user.id)) {
        failPreflight(`provider user ${user.id} has no provider profile`);
      }
    }

    const existingRoleKeys = new Set(
      existingRoles.map((row) => `${row.userId}:${row.role}`),
    );
    const existingApplicationUsers = new Set<number>();
    const existingApplicationProfiles = new Set<number>();

    for (const application of existingApplications) {
      const owner = userById.get(application.userId);
      const profile = providerProfiles.find(
        (candidate) => candidate.id === application.providerProfileId,
      );
      if (!owner || !profile || profile.userId !== application.userId) {
        failPreflight(
          `provider application ${application.id} has inconsistent ownership`,
        );
      }
      if (existingApplicationUsers.has(application.userId)) {
        failPreflight(`user ${application.userId} has duplicate applications`);
      }
      if (existingApplicationProfiles.has(application.providerProfileId)) {
        failPreflight(
          `provider profile ${application.providerProfileId} has duplicate applications`,
        );
      }
      existingApplicationUsers.add(application.userId);
      existingApplicationProfiles.add(application.providerProfileId);
    }

    let roleRowsInserted = 0;
    for (const user of users) {
      const key = `${user.id}:${user.role}`;
      if (existingRoleKeys.has(key)) continue;
      await tx
        .insert(accountRolesTable)
        .values({ userId: user.id, role: user.role })
        .onConflictDoNothing();
      roleRowsInserted += 1;
    }

    let applicationRowsInserted = 0;
    for (const profile of providerProfiles) {
      if (existingApplicationUsers.has(profile.userId)) continue;
      await tx
        .insert(providerApplicationsTable)
        .values({
          userId: profile.userId,
          providerProfileId: profile.id,
          status: applicationStatusForProfile(profile.verificationStatus),
          currentStep: "submitted",
          submittedAt: profile.createdAt,
        })
        .onConflictDoNothing();
      applicationRowsInserted += 1;
    }

    console.log(
      JSON.stringify({
        usersScanned: users.length,
        providerProfilesScanned: providerProfiles.length,
        roleRowsInserted,
        applicationRowsInserted,
        idempotent: true,
      }),
    );
  });
}

try {
  await runBackfill();
} finally {
  await pool.end();
}