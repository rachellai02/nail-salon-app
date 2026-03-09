import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "auth-session";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "chusen-prestige-nail-salon-secret-key-2024"
);

const USERS = [
  { username: "admin", password: "chusen661477", role: "admin" as const },
  { username: "prestige", password: "002338", role: "employee" as const },
];

export type Role = "admin" | "employee";

export interface SessionPayload {
  username: string;
  role: Role;
}

export function validateCredentials(
  username: string,
  password: string
): SessionPayload | null {
  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return null;
  return { username: user.username, role: user.role };
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
