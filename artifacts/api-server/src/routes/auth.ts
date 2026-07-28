import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, registerSchema, loginSchema } from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input.", details: parsed.error.flatten() });
    return;
  }

  const { email, password, firstName, lastName, role, phone } = parsed.data;

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

  const [user] = await db
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

  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  res.status(201).json({ token, user });
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
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    },
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

  res.json({ user });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// JWT is stateless — the client drops the token. We confirm gracefully.

router.post("/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out. Please discard your token." });
});

export default router;
