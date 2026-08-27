import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  accountRolesTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  usersTable,
  registerSchema,
  loginSchema,
} from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { loadRoleState } from "../lib/role-state.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

/** True when the error chain contains a PostgreSQL unique violation (23505). */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function withRoleState<T extends { id: number; role: "client" | "provider" | "admin" }>(
  user: T,
) {
  return {
    ...user,
    ...(await loadRoleState(user.id, user.role)),
  };
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input.", details: parsed.error.flatten() });
    return;
  }

  const { email, password, firstName, lastName, phone } = parsed.data;
  const role = parsed.data.roleIntent ?? parsed.data.role;

  // Fast-path duplicate check (saves a bcrypt round). Correctness under
  // concurrency is guaranteed by the unique-violation handling below, not here.
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(usersTable)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role,
          phone: phone ?? null,
        })
        .returning({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        });

      if (!created) {
        throw new Error("User insert did not return a row.");
      }

      await tx.insert(accountRolesTable).values({
        userId: created.id,
        role: created.role,
      });

      if (created.role === "provider") {
        const [profile] = await tx
          .insert(providerProfilesTable)
          .values({ userId: created.id })
          .returning({ id: providerProfilesTable.id });

        if (!profile) {
          throw new Error("Provider profile insert did not return a row.");
        }

        await tx.insert(providerApplicationsTable).values({
          userId: created.id,
          providerProfileId: profile.id,
        });
      }

      return created;
    });
  } catch (error) {
    // TOCTOU race: two concurrent submissions (e.g. a mobile double-tap) can
    // both pass the SELECT pre-check above; the losing INSERT then violates
    // the users.email unique constraint and previously surfaced as a generic
    // 500 "Internal server error". Return the same safe conflict response as
    // the pre-check instead. Any other failure still propagates as 500.
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  res.status(201).json({ token, user: await withRoleState(user) });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input.", details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.isActive) {
    // Vague on purpose — don't reveal whether email exists
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  res.json({
    token,
    user: await withRoleState({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    }),
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phone: usersTable.phone,
      avatarUrl: usersTable.avatarUrl,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.sub))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json({ user: await withRoleState(user) });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// JWT is stateless — the client drops the token. We confirm gracefully.

router.post("/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out. Please discard your token." });
});

export default router;
