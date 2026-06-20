import { sql } from "drizzle-orm";
import { MessageSquare, Inbox, Clock, CheckCircle2, Info, Plug, Send, Tag, UserPlus, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { cleanIDR, initials } from "@/lib/format";
import { ChannelVolumeChart, ChannelDonut, type ChannelKey } from "@/components/app/charts";
import { DateRangePicker } from "@/components/app/date-range";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SectionCard } from "@/components/app/section-card";
import { SampleBadge } from "@/components/app/status-pill";

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

type Kpi = { icon: React.ElementType; label: string; value: string; tone: string; spark: number[] };

// KPI ringkasan workspace (client).
function kpisFor(c: { conversations: number; open: number; contacts: number; broadcasts: number }): Kpi[] {
  return [
    { icon: MessageSquare, label: "Total Percakapan", value: cleanIDR(c.conversations), tone: "#3B82F6", spark: [22, 28, 26, 34, 40, 52, 64] },
    { icon: Inbox, label: "Inbox Terbuka", value: cleanIDR(c.open), tone: "#F59E0B", spark: [70, 72, 75, 80, 78, 84, 87] },
    { icon: Clock, label: "Total Kontak", value: cleanIDR(c.contacts), tone: "#8B5CF6", spark: [40, 44, 48, 52, 60, 68, 75] },
    { icon: CheckCircle2, label: "Broadcast", value: cleanIDR(c.broadcasts), tone: "#10B981", spark: [12, 18, 16, 22, 28, 30, 36] },
  ];
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
  const roleLabel = "Ringkasan workspace";
  const kpis = kpisFor(c);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${greeting(wibHour)}, ${firstName}!`}
        description={`${dateStr} · ${roleLabel}`}
        actions={<DateRangePicker />}
      />

      {/* KPI — angka asli dari workspace */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} icon={k.icon} label={k.label} value={k.value} tone={k.tone} spark={k.spark} />
        ))}
      </div>

      {/* Catatan jujur: pisahkan data asli vs contoh supaya tidak membingungkan */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Angka <b>KPI</b> di atas diambil langsung dari workspace kamu. Grafik channel, tabel tim, dan aktivitas di bawah masih{" "}
          <b>data contoh</b> sampai channel & tim terhubung.
        </p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <ChannelVolumeChart data={CHANNEL_VOLUMES} />
        <ChannelDonut data={CHANNEL_VOLUMES} />
      </div>

      {/* Panels row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Team table */}
        <SectionCard title="Top Performer Tim" description="Berdasarkan resolusi minggu ini" action={<SampleBadge />} contentClassName="pt-2">
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
              className="grid grid-cols-[32px_1.4fr_1fr_1fr_1fr] items-center gap-3 border-b border-border px-1 py-2.5 text-[13.5px] text-foreground transition-colors last:border-0 hover:bg-muted/50"
            >
              <span className={`grid size-[26px] place-items-center rounded-lg text-xs font-bold ${RANK_BG[a.rank] ?? "bg-muted text-muted-foreground"}`}>
                {a.rank}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: a.color }}>
                  {initials(a.name)}
                </span>
                <span className="truncate font-semibold">{a.name}</span>
              </span>
              <span className="font-semibold text-brand-navy dark:text-foreground">{a.convs}</span>
              <span className="font-semibold tabular-nums text-brand-navy dark:text-foreground">{a.response}</span>
              <span className="flex items-center gap-2">
                <span className="min-w-7 text-[13px] font-bold text-brand-navy dark:text-foreground">{a.csat}</span>
                <span className="h-1.5 max-w-20 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-light" style={{ width: `${(a.csat / 5) * 100}%` }} />
                </span>
              </span>
            </div>
          ))}
        </SectionCard>

        {/* Activity feed */}
        <SectionCard title="Aktivitas Terbaru" description="Riwayat tindakan terakhir" action={<SampleBadge />} contentClassName="pt-2">
          <ul className="flex flex-col">
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="grid grid-cols-[32px_1fr] gap-3 border-b border-border py-3 last:border-0">
                  <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: a.bg, color: a.fg }}>
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[13.5px] leading-snug text-foreground">{a.text}</p>
                    <span className="mt-0.5 inline-block text-[11.5px] text-muted-foreground">{a.time}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
