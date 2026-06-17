import { sql } from "drizzle-orm";
import { MessageSquare, Inbox, Clock, CheckCircle2, TrendingUp, TrendingDown, ChevronRight, Plug, Send, Tag, UserPlus, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { cleanIDR, initials } from "@/lib/format";
import { Sparkline, ChannelVolumeChart, ChannelDonut, type ChannelKey } from "@/components/app/charts";
import { DateRangePicker } from "@/components/app/date-range";
import { PageHeader } from "@/components/app/page-header";

async function counts(tenantId: string | null) {
  if (!tenantId) return { conversations: 0, open: 0, contacts: 0, broadcasts: 0 };
  try {
    const one = async (q: string) => {
      const r = await db.execute(sql.raw(q));
      const rows = r as unknown as Array<{ n: number }>;
      return Number(rows[0]?.n ?? 0);
    };
    const t = `'${tenantId}'`;
    return {
      conversations: await one(`select count(*)::int n from conversations where tenant_id=${t}`),
      open: await one(`select count(*)::int n from conversations where tenant_id=${t} and status='open'`),
      contacts: await one(`select count(*)::int n from contacts where tenant_id=${t}`),
      broadcasts: await one(`select count(*)::int n from broadcasts where tenant_id=${t}`),
    };
  } catch {
    return { conversations: 0, open: 0, contacts: 0, broadcasts: 0 };
  }
}

const CHANNEL_VOLUMES: { ch: ChannelKey; value: number }[] = [
  { ch: "whatsapp", value: 4280 },
  { ch: "instagram", value: 1860 },
  { ch: "messenger", value: 1240 },
  { ch: "telegram", value: 720 },
];

const TEAM = [
  { rank: 1, name: "Budi Santoso", color: "#3B82F6", convs: 47, response: "1m 12s", csat: 4.9 },
  { rank: 2, name: "Dewi Rahayu", color: "#EC4899", convs: 41, response: "1m 38s", csat: 4.8 },
  { rank: 3, name: "Ari Rizki", color: "#10B981", convs: 38, response: "2m 04s", csat: 4.7 },
  { rank: 4, name: "Sari Indah", color: "#F59E0B", convs: 32, response: "2m 21s", csat: 4.6 },
  { rank: 5, name: "Maya Putri", color: "#8B5CF6", convs: 28, response: "2m 45s", csat: 4.5 },
];

const ACTIVITY = [
  { icon: CheckCircle2, bg: "#DCFCE7", fg: "#10B981", text: "Budi menyelesaikan percakapan dengan Andi P.", time: "2m lalu" },
  { icon: Plug, bg: "#DBEAFE", fg: "#3B82F6", text: "Channel Instagram terhubung kembali", time: "18m lalu" },
  { icon: Send, bg: "#EDE9FE", fg: "#8B5CF6", text: "Broadcast 'Promo Akhir Pekan' terkirim ke 234 kontak", time: "1j lalu" },
  { icon: Tag, bg: "#FEF3C7", fg: "#F59E0B", text: "Tag 'VIP' ditambahkan ke Dewi Lestari", time: "2j lalu" },
  { icon: UserPlus, bg: "#FCE7F3", fg: "#EC4899", text: "Sari Indah bergabung sebagai agent", time: "Kemarin" },
  { icon: Zap, bg: "#CFFAFE", fg: "#06B6D4", text: "Otomasi 'Salam Pembuka' dijalankan 47x", time: "Kemarin" },
];

const RANK_BG: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-300 to-amber-500 text-white",
  2: "bg-gradient-to-br from-slate-200 to-slate-400 text-white",
  3: "bg-gradient-to-br from-orange-300 to-orange-500 text-white",
};

function greeting(hour: number) {
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 19) return "Selamat Sore";
  return "Selamat Malam";
}

type Kpi = {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
  trend: number;
  up: boolean;
  spark: number[];
};

// KPI per role: admin = ringkasan bisnis; supervisor = operasional tim & SLA.
function kpisFor(role: string, c: { conversations: number; open: number; contacts: number; broadcasts: number }): Kpi[] {
  if (role === "supervisor") {
    return [
      { icon: Inbox, label: "Inbox Terbuka", value: cleanIDR(c.open), tone: "#F59E0B", trend: 4.2, up: true, spark: [70, 72, 75, 80, 78, 84, 87] },
      { icon: CheckCircle2, label: "Resolusi Minggu Ini", value: "94%", tone: "#10B981", trend: 2.1, up: true, spark: [80, 82, 85, 88, 90, 92, 94] },
      { icon: Clock, label: "Rata-rata Respon", value: "1m 24s", tone: "#3B82F6", trend: 6.0, up: false, spark: [110, 104, 98, 96, 92, 88, 84] },
      { icon: UserPlus, label: "Agen Aktif", value: String(TEAM.length), tone: "#8B5CF6", trend: 0, up: true, spark: [4, 5, 5, 4, 5, 5, 5] },
    ];
  }
  return [
    { icon: MessageSquare, label: "Total Percakapan", value: cleanIDR(c.conversations), tone: "#3B82F6", trend: 12.5, up: true, spark: [22, 28, 26, 34, 40, 52, 64] },
    { icon: Inbox, label: "Inbox Terbuka", value: cleanIDR(c.open), tone: "#F59E0B", trend: 4.2, up: true, spark: [70, 72, 75, 80, 78, 84, 87] },
    { icon: Clock, label: "Total Kontak", value: cleanIDR(c.contacts), tone: "#8B5CF6", trend: 8.1, up: true, spark: [40, 44, 48, 52, 60, 68, 75] },
    { icon: CheckCircle2, label: "Broadcast", value: cleanIDR(c.broadcasts), tone: "#10B981", trend: 1.8, up: true, spark: [12, 18, 16, 22, 28, 30, 36] },
  ];
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  spark,
  trend,
  up,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
  spark: number[];
  trend: number;
  up: boolean;
}) {
  const Trend = up ? TrendingUp : TrendingDown;
  const tColor = up ? "#10B981" : "#EF4444";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl" style={{ background: `${tone}1F`, color: tone }}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <Sparkline data={spark} color={tone} />
      </div>
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold tracking-tight text-brand-navy">{value}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tColor }}>
        <Trend className="size-3.5" /> {up ? "+" : ""}
        {trend}% <span className="font-medium text-muted-foreground">dari kemarin</span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const c = await counts(session.tenantId);

  const now = new Date();
  const wibHour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(now),
  );
  const dateStr = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(now);

  const firstName = session.name.split(/\s+/)[0];
  const roleLabel = session.role === "supervisor" ? "Ringkasan operasional tim" : "Ringkasan workspace";
  const kpis = kpisFor(session.role, c);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${greeting(wibHour)}, ${firstName}!`}
        description={`${dateStr} · ${roleLabel}`}
        actions={<DateRangePicker />}
      />

      {/* Stat cards — per role */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} icon={k.icon} label={k.label} value={k.value} tone={k.tone} trend={k.trend} up={k.up} spark={k.spark} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <ChannelVolumeChart data={CHANNEL_VOLUMES} />
        <ChannelDonut data={CHANNEL_VOLUMES} />
      </div>

      {/* Panels row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Team table */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:px-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">Top Performer Tim</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Berdasarkan resolusi minggu ini</p>
            </div>
            <button className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-brand-blue hover:text-brand-navy">
              Lihat Semua <ChevronRight className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-[32px_1.4fr_1fr_1fr_1fr] items-center gap-3 border-b-2 border-border px-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>#</span>
            <span>Agent</span>
            <span>Percakapan</span>
            <span>Respon</span>
            <span>CSAT</span>
          </div>
          {TEAM.map((a) => (
            <div
              key={a.rank}
              className="grid grid-cols-[32px_1.4fr_1fr_1fr_1fr] items-center gap-3 border-b border-slate-100 px-1 py-2.5 text-[13.5px] text-foreground transition-colors last:border-0 hover:bg-background"
            >
              <span className={`grid size-[26px] place-items-center rounded-lg text-xs font-bold ${RANK_BG[a.rank] ?? "bg-slate-100 text-muted-foreground"}`}>
                {a.rank}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: a.color }}>
                  {initials(a.name)}
                </span>
                <span className="truncate font-semibold">{a.name}</span>
              </span>
              <span className="font-semibold text-brand-navy">{a.convs}</span>
              <span className="font-semibold tabular-nums text-brand-navy">{a.response}</span>
              <span className="flex items-center gap-2">
                <span className="min-w-7 text-[13px] font-bold text-brand-navy">{a.csat}</span>
                <span className="h-1.5 max-w-20 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-light" style={{ width: `${(a.csat / 5) * 100}%` }} />
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:px-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">Aktivitas Terbaru</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Live update</p>
            </div>
            <button className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-brand-blue hover:text-brand-navy">
              Lihat Semua <ChevronRight className="size-3.5" />
            </button>
          </div>
          <ul className="flex flex-col">
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="grid grid-cols-[32px_1fr] gap-3 border-b border-slate-100 py-3 last:border-0">
                  <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: a.bg, color: a.fg }}>
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[13.5px] leading-snug text-brand-navy">{a.text}</p>
                    <span className="mt-0.5 inline-block text-[11.5px] text-muted-foreground">{a.time}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
