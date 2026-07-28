import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt.js";

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Require a valid JWT Bearer token. Attaches req.user on success. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

/** Require the authenticated user to have a specific role. */
export function requireRole(...roles: Array<"client" | "provider" | "admin">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to do that." });
      return;
    }
    next();
  };
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
    if (req.user.sub !== paramId && req.user.role !== "admin") {
      res.status(403).json({ error: "You can only access your own resources." });
      return;
    }
    next();
  };
}
