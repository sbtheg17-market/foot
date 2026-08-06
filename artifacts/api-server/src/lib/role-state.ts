import { eq } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  providerApplicationsTable,
  type User,
} from "@workspace/db";

export type AccountRole = "client" | "provider" | "admin";

const ROLE_ORDER: readonly AccountRole[] = ["client", "provider", "admin"];

export interface ProviderApplicationState {
  id: number;
  status: "draft" | "under_review" | "approved" | "rejected" | "suspended";
  currentStep:
    | "profile"
    | "services"
    | "availability"
    | "verification"
    | "submitted";
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export interface RoleState {
  roles: AccountRole[];
  activeRole: AccountRole;
  onboarding: {
    client: "complete" | null;
    provider: ProviderApplicationState["status"] | null;
  };
  providerApplication: ProviderApplicationState | null;
}

/**
 * Reads the additive role/application state without changing authorization.
 *
 * The legacy users.role value is included as a compatibility fallback until
 * every account has a membership row. This function never grants a role or
 * provider access; it only reports persisted state.
 */
export async function loadRoleState(
  userId: number,
  legacyRole: User["role"],
): Promise<RoleState> {
  const [roleRows, applicationRows] = await Promise.all([
    db
      .select({ role: accountRolesTable.role })
      .from(accountRolesTable)
      .where(eq(accountRolesTable.userId, userId)),
    db
      .select({
        id: providerApplicationsTable.id,
        status: providerApplicationsTable.status,
        currentStep: providerApplicationsTable.currentStep,
        submittedAt: providerApplicationsTable.submittedAt,
        reviewedAt: providerApplicationsTable.reviewedAt,
      })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, userId))
      .limit(1),
  ]);

  const membershipRoles = new Set<AccountRole>([
    legacyRole,
    ...roleRows.map((row) => row.role),
  ]);
  const roles = ROLE_ORDER.filter((role) => membershipRoles.has(role));
  const providerApplication = applicationRows[0] ?? null;

  return {
    roles,
    activeRole: legacyRole,
    onboarding: {
      client: roles.includes("client") ? "complete" : null,
      provider: providerApplication?.status ?? null,
    },
    providerApplication,
  };
}