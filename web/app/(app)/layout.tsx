import { AppShell } from "@/components/app/app-shell";
import { requireSession } from "@/lib/session";
import { getSidebarStats } from "@/lib/sidebar-stats";
import { getWebSettingsByTenant } from "@/lib/web-settings-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const stats = await getSidebarStats(session.tenantId);
  // Kontak "Hubungi Admin" (footer sidebar) diambil dari web_settings tenant (DB).
  let support: { whatsapp?: string; phone?: string; email?: string } | undefined;
  let logoUrl: string | undefined;
  let siteName: string | undefined;
  if (session.tenantId) {
    const ws = await getWebSettingsByTenant(session.tenantId);
    support = { whatsapp: ws.social.whatsapp, phone: ws.contact.phone, email: ws.contact.email };
    logoUrl = ws.logoUrl || undefined;
    siteName = ws.siteName || undefined;
  }
  return (
    <AppShell
      session={session}
      workspaceName={session.tenantName ?? undefined}
      stats={stats}
      support={support}
      logoUrl={logoUrl}
      siteName={siteName}
    >
      {children}
    </AppShell>
  );
}
