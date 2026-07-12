import { TrendingUp, Wallet, Building2, MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/session";
import { rupiah, cleanIDR } from "@/lib/format";
import { getMonthlyAnalytics, getRevenueStats, type MonthlyPoint } from "@/lib/platform-stats";

function BarRow({
  points,
  pick,
  fmt,
  color,
}: {
  points: MonthlyPoint[];
  pick: (p: MonthlyPoint) => number;
  fmt: (n: number) => string;
  color: string;
}) {
  const max = Math.max(1, ...points.map(pick));
  return (
    <div className="flex items-end gap-3 sm:gap-5">
      {points.map((p) => {
        const v = pick(p);
        const h = Math.round((v / max) * 100);
        return (
          <div key={p.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="text-[11px] font-semibold tabular-nums text-foreground">{fmt(v)}</div>
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t-md transition-all"
                style={{ height: `${Math.max(h, 3)}%`, background: color }}
                title={`${p.label}: ${fmt(v)}`}
              />
            </div>
            <div className="text-xs text-muted-foreground">{p.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default async function PlatformAnalyticsPage() {
  await requireSession();
  const [points, stats] = await Promise.all([getMonthlyAnalytics(), getRevenueStats()]);

  const totalTenants6mo = points.reduce((s, p) => s + p.tenants, 0);
  const totalMsg6mo = points.reduce((s, p) => s + p.messages, 0);

  const cards = [
    { label: "Total Pendapatan", value: rupiah(stats.totalPaidIdr), icon: Wallet, tone: "#10b981" },
    { label: "Pendapatan Bulan Ini", value: rupiah(stats.monthPaidIdr), icon: TrendingUp, tone: "#3b82f6" },
    { label: "Tenant Baru (6 bln)", value: cleanIDR(totalTenants6mo), icon: Building2, tone: "#8b5cf6" },
    { label: "Pesan (6 bln)", value: cleanIDR(totalMsg6mo), icon: MessageSquare, tone: "#f59e0b" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analitik Platform</h1>
        <p className="text-sm text-muted-foreground">Tren 6 bulan terakhir.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <span
                className="flex size-9 items-center justify-center rounded-lg"
                style={{ background: `${c.tone}1a`, color: c.tone }}
              >
                <Icon className="size-[18px]" />
              </span>
              <div className="mt-3 text-xl font-bold tracking-tight">{c.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Pendapatan / Bulan</h2>
          <BarRow points={points} pick={(p) => p.revenue} fmt={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} color="#10b981" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Tenant Baru / Bulan</h2>
          <BarRow points={points} pick={(p) => p.tenants} fmt={(n) => String(n)} color="#8b5cf6" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Pesan / Bulan</h2>
          <BarRow points={points} pick={(p) => p.messages} fmt={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}
