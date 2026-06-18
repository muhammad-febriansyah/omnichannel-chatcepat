import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { tenants } from "./db/schema";
import { SESSION_COOKIE, verifySession } from "./auth";
import { can, type Ability, type Role, type SessionUser } from "./rbac";

export interface Session extends SessionUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  tenantName: string | null;
}

// Baca sesi dari cookie JWT httpOnly. null = belum login.
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  let tenantName: string | null = null;
  try {
    if (payload.tenantId) {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, payload.tenantId) });
      tenantName = t?.name ?? null;
    }
  } catch {
    /* abaikan */
  }
  return {
    id: payload.sub,
    role: payload.role as Role,
    tenantId: payload.tenantId,
    name: payload.name,
    email: payload.email,
    avatarUrl: payload.avatarUrl ?? null,
    tenantName,
  };
});

// Wajib login — redirect ke /login kalau belum.
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

// Gating halaman server-side: wajib login + punya ability, else redirect.
// Penegakan baca (read) — mutasi tetap pakai requireAbility di Server Action.
export async function requirePageAbility(ability: Ability): Promise<Session> {
  const s = await requireSession();
  if (!can(s, ability)) redirect("/dashboard");
  return s;
}
