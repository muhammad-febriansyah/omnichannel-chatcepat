import { Building2, CheckCircle2, PauseCircle, Plug, MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/session";
import { cleanIDR } from "@/lib/format";
import { getPlatformOverview, listTenants } from "@/lib/platform-stats";
import { TenantsTable } from "@/components/app/tenants-table";

export default async function PlatformAdminPage() {
  await requireSession();
  const [ov, tenants] = await Promise.all([getPlatformOverview(), listTenants()]);

  const cards = [
    { label: "Total Tenant", value: ov.totalTenants, icon: Building2, tone: "#3b82f6" },
    { label: "Tenant Aktif", value: ov.activeTenants, icon: CheckCircle2, tone: "#10b981" },
    { label: "Disuspend", value: ov.suspendedTenants, icon: PauseCircle, tone: "#ef4444" },
    { label: "Channel Aktif", value: ov.channelsConnected, icon: Plug, tone: "#8b5cf6" },
    { label: "Pesan Bulan Ini", value: ov.messagesThisMonth, icon: MessageSquare, tone: "#f59e0b" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Ringkasan Platform</h1>
        <p className="text-sm text-muted-foreground">Monitoring seluruh tenant ChatCepat.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}>
                <Icon className="size-[18px]" />
              </span>
              <div className="mt-3 text-2xl font-bold tracking-tight">{cleanIDR(c.value)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tenant table */}
      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Daftar Tenant</h2>
        <TenantsTable rows={tenants} />
      </div>
    </div>
  );
}
