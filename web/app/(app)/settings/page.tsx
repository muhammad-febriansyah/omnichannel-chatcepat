import { and, desc, eq, ne } from "drizzle-orm";
import { Settings } from "lucide-react";
import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { normalizeWebSettings, tenantWebDefaults } from "@/lib/web-settings";
import { normalizeBusinessHours } from "@/lib/business-hours";
import { PageHeader } from "@/components/app/page-header";
import { SettingsTabs } from "@/components/app/settings-tabs";
import type { UserRow } from "@/components/app/users-table";

async function loadUsers(tenantId: string, selfId: string): Promise<UserRow[]> {
  try {
    const rows = await db.query.users.findMany({
      where: and(eq(users.tenantId, tenantId), ne(users.role, "admin")),
      orderBy: [desc(users.createdAt)],
      limit: 200,
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      isSelf: u.id === selfId,
    }));
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const session = await requirePageAbility("billing.tenant");

  let raw: Record<string, unknown> | undefined;
  let teamUsers: UserRow[] = [];
  let tenantName = session.tenantName ?? "Workspace";
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      raw = t?.settings as Record<string, unknown> | undefined;
      if (t?.name) tenantName = t.name;
    } catch {
      /* default */
    }
    teamUsers = await loadUsers(session.tenantId, session.id);
  }

  // Default branding = nama tenant (bukan ChatCepat). Tenant punya data sendiri.
  const webSettings = normalizeWebSettings(raw?.web_settings, tenantWebDefaults(tenantName));
  const businessHours = normalizeBusinessHours(raw?.business_hours);

  return (
    <div className="p-6">
      <PageHeader icon={Settings} title="Pengaturan" description="Konfigurasi workspace kamu." />
      <SettingsTabs webSettings={webSettings} businessHours={businessHours} users={teamUsers} />
    </div>
  );
}
