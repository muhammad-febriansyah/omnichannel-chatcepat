import { TrendingUp, Wallet, Building2, MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/session";
import { rupiah, cleanIDR } from "@/lib/format";
import { getMonthlyAnalytics, getRevenueStats } from "@/lib/platform-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { TimeSeriesChart } from "@/components/app/apex-charts";

export default async function PlatformAnalyticsPage() {
  await requireSession();
  const [points, stats] = await Promise.all([getMonthlyAnalytics(), getRevenueStats()]);

  const totalTenants6mo = points.reduce((s, p) => s + p.tenants, 0);
  const totalMsg6mo = points.reduce((s, p) => s + p.messages, 0);

  const cards = [
    { label: "Total Pendapatan", value: rupiah(stats.totalPaidIdr), icon: Wallet, tone: "#10b981" },
    { label: "Pendapatan Bulan Ini", value: rupiah(stats.monthPaidIdr), icon: TrendingUp, tone: "#2547f9" },
    { label: "Tenant Baru (6 bln)", value: cleanIDR(totalTenants6mo), icon: Building2, tone: "#8b5cf6" },
    { label: "Pesan (6 bln)", value: cleanIDR(totalMsg6mo), icon: MessageSquare, tone: "#f59e0b" },
  ];

  const months = points.map((p) => p.label);

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <PageHeader title="Analitik Platform" description="Tren 6 bulan terakhir: pendapatan, tenant baru, dan volume pesan." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendapatan per bulan</CardTitle>
          <CardDescription>Pembayaran berhasil (paket + top-up token AI)</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart type="bar" categories={months} series={[{ name: "Pendapatan", data: points.map((p) => p.revenue) }]} format="rupiah" height={300} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant baru per bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart type="bar" categories={months} series={[{ name: "Tenant baru", data: points.map((p) => p.tenants) }]} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pesan per bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart type="area" categories={months} series={[{ name: "Pesan", data: points.map((p) => p.messages) }]} height={260} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
