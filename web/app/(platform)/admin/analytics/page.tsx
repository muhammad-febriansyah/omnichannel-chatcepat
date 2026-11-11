import { BadgeCheck, Repeat, RefreshCcw, UserPlus, Wallet } from "lucide-react";
import { requireSession } from "@/lib/session";
import { rupiah, cleanIDR } from "@/lib/format";
import { ADOPTION_FEATURES, loadSubscriptionAnalytics } from "@/lib/platform-subscriptions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { GroupedBarChart, TimeSeriesChart } from "@/components/app/apex-charts";
import { cn } from "@/lib/utils";

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

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

export default async function PlatformAnalyticsPage() {
  await requireSession();
  const a = await loadSubscriptionAnalytics();
  const k = a.kpi;
  const top = a.funnel[0]?.n ?? 0;

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <PageHeader
        title="Analitik Platform"
        description="Kesehatan bisnis langganan: MRR, konversi trial, perpanjangan, aktivasi, dan fitur yang dipakai per paket."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Repeat} label="MRR saat ini" value={rupiah(k.mrr)} tone="#2547F9" delta={k.mrrDelta} hint="vs akhir bulan lalu" />
        <StatCard icon={BadgeCheck} label="Tenant berbayar" value={cleanIDR(k.paying)} tone="#10B981" hint="Paket berbayar aktif" />
        <StatCard icon={Wallet} label="ARPU" value={rupiah(k.arpu)} tone="#06B6D4" hint="MRR ÷ tenant berbayar" />
        <StatCard icon={UserPlus} label="Konversi pendaftar" value={`${k.conversion}%`} tone="#8B5CF6" hint="Pendaftar 6 bln yang membayar" />
        <StatCard
          icon={RefreshCcw}
          label="Tingkat perpanjangan"
          value={k.renewal === null ? "—" : `${k.renewal}%`}
          tone="#F59E0B"
          hint="Periode berbayar yang diperpanjang (6 bln)"
        />
      </div>

      <Panel title="MRR per bulan" desc="Pendapatan bulanan berulang di akhir tiap bulan, per paket (paket tahunan dihitung ÷12)">
        <TimeSeriesChart type="bar" stacked categories={a.months} series={a.mrrSeries} format="rupiah" height={320} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Pendaftar → berbayar" desc="Per bulan pendaftaran: berapa yang akhirnya membayar paket">
          <GroupedBarChart
            horizontal={false}
            categories={a.cohorts.map((c) => `${c.label} · ${c.rate}%`)}
            series={[
              { name: "Pendaftar", data: a.cohorts.map((c) => c.signups) },
              { name: "Membayar", data: a.cohorts.map((c) => c.paid) },
            ]}
            height={280}
          />
        </Panel>
        <Panel title="Perpanjangan vs berhenti" desc="Periode berbayar yang berakhir tiap bulan">
          <TimeSeriesChart
            type="bar"
            stacked
            categories={a.retention.map((r) => (r.rate === null ? r.label : `${r.label} · ${r.rate}%`))}
            series={[
              { name: "Diperpanjang", data: a.retention.map((r) => r.renewed) },
              { name: "Berhenti", data: a.retention.map((r) => r.churned) },
            ]}
            height={280}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <Panel title="Funnel aktivasi" desc="Tenant yang mendaftar 90 hari terakhir">
          <ol className="space-y-3">
            {a.funnel.map((s, i) => {
              const share = pct(s.n, top);
              const prev = i > 0 ? a.funnel[i - 1].n : null;
              return (
                <li key={s.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{cleanIDR(s.n)}</span>
                      {prev !== null && ` · ${pct(s.n, prev)}% dari tahap sebelumnya`}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share, s.n ? 2 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title="Fitur yang dipakai per paket" desc="Persen tenant aktif yang memakai fitur (30 hari terakhir; katalog = punya produk)">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket</TableHead>
                  <TableHead className="text-right">Tenant</TableHead>
                  {ADOPTION_FEATURES.map((f) => (
                    <TableHead key={f.key} className="text-right">
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.adoption.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2 + ADOPTION_FEATURES.length} className="py-6 text-center text-muted-foreground">
                      Belum ada tenant aktif
                    </TableCell>
                  </TableRow>
                )}
                {a.adoption.map((r) => (
                  <TableRow key={r.plan}>
                    <TableCell className="font-medium">{r.plan}</TableCell>
                    <TableCell className="text-right tabular-nums">{cleanIDR(r.tenants)}</TableCell>
                    {ADOPTION_FEATURES.map((f) => {
                      const v = pct(r[f.key], r.tenants);
                      return (
                        <TableCell
                          key={f.key}
                          className={cn("text-right tabular-nums", v >= 50 ? "font-semibold text-foreground" : "text-muted-foreground")}
                        >
                          {v}%
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>

      <Panel title="Pendapatan paket per jenis" desc="12 bulan terakhir, pembayaran paket berhasil (tanpa top-up AI)">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paket</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Transaksi</TableHead>
                <TableHead className="text-right">Pendapatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.revenueByPlan.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Belum ada pembayaran paket
                  </TableCell>
                </TableRow>
              )}
              {a.revenueByPlan.map((r) => (
                <TableRow key={`${r.plan}-${r.period}`}>
                  <TableCell className="font-medium">{r.plan}</TableCell>
                  <TableCell>{r.period}</TableCell>
                  <TableCell className="text-right tabular-nums">{cleanIDR(r.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupiah(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
