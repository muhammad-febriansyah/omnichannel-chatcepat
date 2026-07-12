import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { tenants } from "./db/schema";
import { ACTING_TENANT_COOKIE, IMPERSONATE_COOKIE, SESSION_COOKIE, verifySession } from "./auth";
import { can, type Ability, type Role, type SessionUser } from "./rbac";
import { type TenantPlan } from "./plan";

export interface Session extends SessionUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  tenantName: string | null;
  plan: TenantPlan | null; // paket tenant aktif (lock fitur; null utk admin tanpa tenant)
  isPlatformAdmin: boolean;
  // admin platform god-mode: tenant yang sedang dilihat (impersonasi). null untuk client.
  actingTenantId: string | null;
  // admin platform sedang masuk sebagai tenant (operasikan menu omnichannel).
  impersonating: boolean;
}

// Baca sesi dari cookie JWT httpOnly. null = belum login.
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const isPlatformAdmin = payload.role === "admin";
  // admin platform tak punya tenant sendiri → pakai acting tenant (cookie), default tenant pertama.
  let tenantId = payload.tenantId;
  let actingTenantId: string | null = null;
  if (isPlatformAdmin) {
    const cookieTenant = store.get(ACTING_TENANT_COOKIE)?.value || null;
    try {
      const acting = cookieTenant
        ? await db.query.tenants.findFirst({ where: eq(tenants.id, cookieTenant) })
        : await db.query.tenants.findFirst({ orderBy: asc(tenants.createdAt) });
      actingTenantId = acting?.id ?? null;
    } catch {
      actingTenantId = null;
    }
    tenantId = actingTenantId;
  }

  let tenantName: string | null = null;
  let plan: TenantPlan | null = null;
  try {
    if (tenantId) {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
      tenantName = t?.name ?? null;
      plan = (t?.plan as TenantPlan) ?? null;
    }
  } catch {
    /* abaikan */
  }
  return {
    id: payload.sub,
    role: payload.role as Role,
    tenantId,
    name: payload.name,
    email: payload.email,
    avatarUrl: payload.avatarUrl ?? null,
    tenantName,
    plan,
    isPlatformAdmin,
    actingTenantId,
    // Impersonasi aktif hanya bila admin DAN cookie ada DAN tenant target resolve.
    impersonating: isPlatformAdmin && !!store.get(IMPERSONATE_COOKIE)?.value && !!tenantId,
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
