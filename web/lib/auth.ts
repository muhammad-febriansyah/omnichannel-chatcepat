import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./rbac";

export const SESSION_COOKIE = "cc_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  tenantId: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

function secret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET || "dev-secret-change-me-in-production";
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const COOKIE_MAX_AGE = MAX_AGE;
