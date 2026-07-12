import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { requireSession } from "@/lib/session";
import { getSidebarStats } from "@/lib/sidebar-stats";
import { getPublicWebSettings, getWebSettingsByTenant } from "@/lib/web-settings-server";
import { listTenants } from "@/lib/actions";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Hanya admin platform. client dilempar ke panel-nya (middleware juga enforce).
  if (session.role !== "admin") redirect("/dashboard");

  // Shell sama persis dgn panel tenant; tenant aktif = acting tenant admin.
  const stats = await getSidebarStats(session.tenantId);
  let support: { whatsapp?: string; phone?: string; email?: string } | undefined;
  let logoUrl: string | undefined;
  let siteName: string | undefined;
  if (session.tenantId) {
    const ws = await getWebSettingsByTenant(session.tenantId);
    support = { whatsapp: ws.social.whatsapp, phone: ws.contact.phone, email: ws.contact.email };
    logoUrl = ws.logoUrl || undefined;
    siteName = ws.siteName || undefined;
  }
  // Konsol platform: acting tenant sering tak punya logo → pakai branding platform
  // (public web settings, di-set di /admin/settings), bukan placeholder bulan.
  if (!logoUrl) {
    const pub = await getPublicWebSettings();
    logoUrl = pub.logoUrl || undefined;
  }
  const tenants = await listTenants();

  return (
    <AppShell
      session={session}
      workspaceName={session.tenantName ?? undefined}
      stats={stats}
      support={support}
      logoUrl={logoUrl}
      siteName={siteName}
      tenants={tenants}
    >
      {children}
    </AppShell>
  );
}
