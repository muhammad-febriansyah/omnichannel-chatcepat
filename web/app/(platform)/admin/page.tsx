import Link from "next/link";
import { Building2, CircleDollarSign, Coins, MessageSquare, Receipt, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/session";
import { cleanIDR, rupiah } from "@/lib/format";
import { listTenants } from "@/lib/platform-stats";
import { loadPlatformDashboard, type RangeDays } from "@/lib/platform-dashboard";
import { fmtTokens } from "@/lib/plan-config";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { TenantsTable } from "@/components/app/tenants-table";
import { AdminRecentOrders } from "@/components/app/admin-recent-orders";
import { DonutChart, RankingChart, TimeSeriesChart } from "@/components/app/apex-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 hari" },
  { value: 30, label: "30 hari" },
  { value: 90, label: "90 hari" },
];

const STATUS_LABEL: Record<string, string> = { paid: "Berhasil", pending: "Menunggu", failed: "Gagal", expired: "Kedaluwarsa" };

function Panel({ title, desc, children, className }: { title: string; desc?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireSession();
  const { range } = await searchParams;
  const days = (RANGES.find((r) => String(r.value) === range)?.value ?? 30) as RangeDays;
  const [d, tenants] = await Promise.all([loadPlatformDashboard(days), listTenants()]);
  const k = d.kpi;
  const periodLabel = `${days} hari terakhir`;

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <PageHeader
        title="Ringkasan Platform"
        description={`Rekap transaksi, pendapatan, token AI, dan aktivitas tenant · ${periodLabel}`}
        actions={
          <div className="inline-flex gap-1 rounded-xl bg-card p-1">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={r.value === 30 ? "/admin" : `/admin?range=${r.value}`}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  r.value === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={CircleDollarSign} label="Pendapatan" value={rupiah(k.revenue)} tone="#2547F9" delta={k.revenueDelta} hint={`Top-up AI: ${rupiah(k.topupRevenue)}`} />
        <StatCard icon={Receipt} label="Transaksi berhasil" value={cleanIDR(k.paid)} tone="#10B981" delta={k.paidDelta} hint={`${cleanIDR(k.pending)} menunggu pembayaran`} />
        <StatCard icon={Building2} label="Tenant baru" value={cleanIDR(k.tenantsNew)} tone="#8B5CF6" delta={k.tenantsNewDelta} hint={`${cleanIDR(k.tenantsActive)} aktif dari ${cleanIDR(k.tenants)} tenant`} />
        <StatCard icon={Coins} label="Token AI terpakai" value={fmtTokens(k.tokens)} tone="#F59E0B" delta={k.tokensDelta} hint={`${cleanIDR(k.aiCalls)} panggilan AI`} />
        <StatCard icon={MessageSquare} label="Pesan diproses" value={cleanIDR(k.messages)} tone="#EC4899" delta={k.messagesDelta} hint={`${cleanIDR(k.channels)} channel terhubung`} />
        <StatCard
          icon={Sparkles}
          label="Rata-rata per transaksi"
          value={rupiah(k.paid ? Math.round(k.revenue / k.paid) : 0)}
          tone="#06B6D4"
          hint="Pendapatan ÷ transaksi berhasil"
        />
      </div>

      {/* Revenue */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Pendapatan harian" desc="Paket langganan vs top-up token AI (pembayaran berhasil, WIB)">
          <TimeSeriesChart type="bar" stacked categories={d.days} series={d.revenueSeries} format="rupiah" height={320} />
        </Panel>
        <Panel title="Komposisi pendapatan" desc={periodLabel}>
          <DonutChart labels={d.revenueByItem.labels} values={d.revenueByItem.values} format="rupiah" totalLabel="Pendapatan" height={320} />
        </Panel>
      </div>

      {/* AI tokens */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Pemakaian token AI harian" desc="Token tenant yang dipotong, per fitur">
          <TimeSeriesChart type="bar" stacked categories={d.days} series={d.tokenSeries} format="tokens" height={300} />
        </Panel>
        <Panel title="Tenant paling banyak memakai AI" desc="Token dipotong">
          <RankingChart labels={d.topTokenTenants.labels} values={d.topTokenTenants.values} format="tokens" height={300} />
        </Panel>
      </div>

      {/* Activity */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr_1fr]">
        <Panel title="Volume pesan" desc="Pesan masuk & keluar semua tenant">
          <TimeSeriesChart type="area" categories={d.days} series={d.messageSeries} height={280} />
        </Panel>
        <Panel title="Status transaksi" desc={periodLabel}>
          <DonutChart labels={d.orderStatus.map((s) => STATUS_LABEL[s.status])} values={d.orderStatus.map((s) => s.n)} totalLabel="Transaksi" height={280} />
        </Panel>
        <Panel title="Tenant aktif per paket" desc="Saat ini">
          <DonutChart labels={d.planMix.labels} values={d.planMix.values} totalLabel="Tenant" height={280} />
        </Panel>
      </div>

      <Panel title="Transaksi terbaru" desc="50 transaksi terakhir — paket & top-up">
        <AdminRecentOrders rows={d.recentOrders} />
      </Panel>

      <Panel title="Daftar tenant">
        <TenantsTable rows={tenants} />
      </Panel>
    </div>
  );
}
