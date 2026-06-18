import { MessageSquare, CheckCircle2, Users, ShieldCheck, Send, BarChart3 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { cleanIDR } from "@/lib/format";
import { getReportStats } from "@/lib/report-stats";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";

const CONV_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Terbuka", color: "#3b82f6" },
  pending: { label: "Pending", color: "#f59e0b" },
  resolved: { label: "Selesai", color: "#10b981" },
  snoozed: { label: "Ditunda", color: "#8b5cf6" },
};
const OPTIN_STATUS: Record<string, { label: string; color: string }> = {
  opted_in: { label: "Opted-in", color: "#10b981" },
  opted_out: { label: "Opted-out", color: "#ef4444" },
  unknown: { label: "Unknown", color: "#94a3b8" },
};

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso + "T00:00:00+07:00"));
}

function Breakdown({ title, rows, map, total }: { title: string; rows: { status: string; n: number }[]; map: Record<string, { label: string; color: string }>; total: number }) {
  return (
    <SectionCard title={title}>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const m = map[r.status] ?? { label: r.status, color: "#94a3b8" };
            const pct = total ? Math.round((r.n / total) * 100) : 0;
            return (
              <div key={r.status} className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted-foreground">{m.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                </div>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">
                  {cleanIDR(r.n)} <span className="font-normal text-muted-foreground">{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default async function ReportsPage() {
  const session = await requireSession();
  const s = await getReportStats(session.tenantId);
  const resRate = s.conversations ? Math.round((s.resolved / s.conversations) * 100) : 0;
  const maxDay = Math.max(1, ...s.msgPerDay.map((d) => d.n));

  const cards = [
    { label: "Total Percakapan", value: s.conversations, icon: MessageSquare, tone: "#3b82f6" },
    { label: "Tingkat Resolusi", value: `${resRate}%`, icon: CheckCircle2, tone: "#10b981" },
    { label: "Total Kontak", value: cleanIDR(s.contacts), icon: Users, tone: "#8b5cf6" },
    { label: "Kontak Opted-in", value: cleanIDR(s.optedIn), icon: ShieldCheck, tone: "#0ea5e9" },
    { label: "Pesan Terkirim (bln ini)", value: cleanIDR(s.messagesOut), icon: Send, tone: "#f59e0b" },
  ];

  return (
    <div className="p-6">
      <PageHeader icon={BarChart3} title="Laporan" description="Ringkasan metrik & performa workspace." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}>
                <Icon className="size-[18px]" />
              </span>
              <div className="mt-3 text-2xl font-bold tracking-tight dark:text-foreground">{typeof c.value === "number" ? cleanIDR(c.value) : c.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Pesan per hari */}
      <SectionCard title="Volume Pesan · 7 Hari Terakhir" className="mt-6">
        <div className="flex h-44 items-end justify-between gap-2">
          {s.msgPerDay.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-b from-brand-blue to-brand-light"
                  style={{ height: `${(d.n / maxDay) * 100}%`, minHeight: d.n > 0 ? 4 : 0 }}
                  title={`${d.n} pesan`}
                />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{dayLabel(d.day)}</span>
              <span className="text-[11px] tabular-nums text-foreground">{cleanIDR(d.n)}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown title="Status Percakapan" rows={s.convByStatus} map={CONV_STATUS} total={s.conversations} />
        <Breakdown title="Opt-in Kontak" rows={s.optInByStatus} map={OPTIN_STATUS} total={s.contacts} />
      </div>
    </div>
  );
}
