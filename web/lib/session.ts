import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { tenants, users } from "./db/schema";
import type { Role, SessionUser } from "./rbac";

export interface Session extends SessionUser {
  name: string;
  email: string;
  tenantName: string | null;
}

// DEV: ambil admin pertama dari DB. TODO(08): auth nyata (JWT httpOnly cookie / NextAuth),
// tenant_id dari sesi — JANGAN dari input user. Lihat docs/prd/09.
export const getSession = cache(async (): Promise<Session> => {
  const fallback: Session = {
    id: "dev",
    role: "admin",
    tenantId: null,
    name: "Dev Admin",
    email: "dev@chatcepat.local",
    tenantName: null,
  };
  try {
    const tenant = await db.query.tenants.findFirst();
    if (!tenant) return fallback;
    const admin = await db.query.users.findFirst({
      where: and(eq(users.tenantId, tenant.id), eq(users.role, "admin")),
    });
    return {
      id: admin?.id ?? "dev",
      role: (admin?.role as Role) ?? "admin",
      tenantId: tenant.id,
      name: admin?.name ?? "Dev Admin",
      email: admin?.email ?? "dev@chatcepat.local",
      tenantName: tenant.name,
    };
  } catch {
    return fallback;
  }
});

export { tenants, users };
