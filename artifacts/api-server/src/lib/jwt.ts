import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: number; // user id
  email: string;
  role: "client" | "provider" | "admin";
  iat?: number;
  exp?: number;
}

function getSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return secret;
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  const expiresIn = (process.env["JWT_EXPIRES_IN"] ?? "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as unknown as JwtPayload;
}
