import { AppShell } from "@/components/app/app-shell";
import { requireSession } from "@/lib/session";
import { getSidebarStats } from "@/lib/sidebar-stats";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const stats = await getSidebarStats(session.tenantId);
  return (
    <AppShell session={session} workspaceName={session.tenantName ?? undefined} stats={stats}>
      {children}
    </AppShell>
  );
}
