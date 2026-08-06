import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  usersTable,
} from "@workspace/db";
import { verifyToken, JwtPayload } from "../lib/jwt.js";

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      authz?: AuthorizationContext;
    }
  }
}

export type AuthorizationRole = "client" | "provider" | "admin";
export type ProviderApplicationStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export interface AuthorizationContext {
  userId: number;
  activeRole: AuthorizationRole;
  roles: AuthorizationRole[];
  isActive: boolean;
  providerApplication: {
    id: number;
    status: ProviderApplicationStatus;
    providerProfileId: number;
    providerProfileUserId: number;
    verificationStatus: "pending" | "under_review" | "approved" | "rejected";
  } | null;
}

/**
 * Load authorization state from the database.
 *
 * JWT claims remain the compatibility session envelope. Authorization decisions
 * use this database-backed context instead of trusting the token's role alone.
 */
export async function loadAuthorizationContext(
  userId: number,
): Promise<AuthorizationContext | null> {
  const [userRows, roleRows, applicationRows] = await Promise.all([
    db
      .select({
        role: usersTable.role,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
    db
      .select({ role: accountRolesTable.role })
      .from(accountRolesTable)
      .where(eq(accountRolesTable.userId, userId)),
    db
      .select({
        id: providerApplicationsTable.id,
        status: providerApplicationsTable.status,
        providerProfileId: providerApplicationsTable.providerProfileId,
        providerProfileUserId: providerProfilesTable.userId,
        verificationStatus: providerProfilesTable.verificationStatus,
      })
      .from(providerApplicationsTable)
      .innerJoin(
        providerProfilesTable,
        eq(providerProfilesTable.id, providerApplicationsTable.providerProfileId),
      )
      .where(eq(providerApplicationsTable.userId, userId))
      .limit(1),
  ]);

  const user = userRows[0];
  if (!user || !user.isActive) return null;

  return {
    userId,
    activeRole: user.role,
    roles: roleRows.map((row) => row.role),
    isActive: user.isActive,
    providerApplication: applicationRows[0] ?? null,
  };
}

/** Require a valid JWT Bearer token. Attaches req.user on success. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  const authz = await loadAuthorizationContext(req.user.sub);
  if (!authz || authz.activeRole !== req.user.role) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  req.authz = authz;
  next();
}

/** Require a database-backed active role membership. */
export function requireRole(...roles: Array<"client" | "provider" | "admin">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authz = req.authz;
    if (!req.user || !authz) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (
      !roles.includes(authz.activeRole) ||
      !authz.roles.includes(authz.activeRole)
    ) {
      res.status(403).json({ error: "You do not have permission to do that." });
      return;
    }
    next();
  };
}

/** Require an owned, approved provider application and approved profile. */
export function requireApprovedProvider(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authz = req.authz;
  const application = authz?.providerApplication;
  if (
    !req.user ||
    !authz ||
    authz.activeRole !== "provider" ||
    !authz.roles.includes("provider") ||
    !application ||
    application.providerProfileUserId !== req.user.sub ||
    application.status !== "approved" ||
    application.verificationStatus !== "approved"
  ) {
    res.status(403).json({
      error: "Approved provider access is required for this operation.",
    });
    return;
  }
  next();
}

/**
 * Apply approved-provider enforcement only when the active context is provider.
 * Client and admin booking/invoice routes retain their existing behavior.
 */
export function requireApprovedProviderIfProvider(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.authz?.activeRole === "provider") {
    requireApprovedProvider(req, res, next);
    return;
  }
  next();
}

/**
 * Require the authenticated user to be accessing their own resource.
 * Compares req.user.sub against req.params.userId (or a custom param name).
 */
export function requireSelf(paramName = "userId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const paramId = Number(req.params[paramName]);
    if (req.user.sub !== paramId && req.authz?.activeRole !== "admin") {
      res.status(403).json({ error: "You can only access your own resources." });
      return;
    }
    next();
  };
}
