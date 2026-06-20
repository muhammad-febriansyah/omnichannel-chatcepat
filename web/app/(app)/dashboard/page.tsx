import { sql } from "drizzle-orm";
import { MessageSquare, Inbox, Clock, CheckCircle2, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { cleanIDR, initials, timeAgo } from "@/lib/format";
import { ChannelVolumeChart, ChannelDonut, type ChannelKey } from "@/components/app/charts";
import { DateRangePicker } from "@/components/app/date-range";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SectionCard } from "@/components/app/section-card";

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

// Petakan channel.type → ChannelKey grafik.
const CH_KEY: Record<string, ChannelKey> = {
  wa_official: "whatsapp",
  wa_unofficial: "whatsapp",
  facebook: "messenger",
  instagram: "instagram",
  telegram: "telegram",
};

// Volume pesan 7 hari per channel (data asli tenant).
async function channelVolumes(tenantId: string | null): Promise<{ ch: ChannelKey; value: number }[]> {
  if (!tenantId) return [];
  try {
    const r = await db.execute(
      sql`SELECT c.type, count(m.id)::int n
          FROM channels c
          LEFT JOIN messages m ON m.channel_id = c.id AND m.created_at >= now() - interval '7 days'
          WHERE c.tenant_id = ${tenantId}
          GROUP BY c.type`,
    );
    const rows = r as unknown as Array<{ type: string; n: number }>;
    const agg = new Map<ChannelKey, number>();
    for (const row of rows) {
      const key = CH_KEY[row.type];
      if (key) agg.set(key, (agg.get(key) ?? 0) + Number(row.n ?? 0));
    }
    return [...agg.entries()].map(([ch, value]) => ({ ch, value })).filter((d) => d.value > 0);
  } catch {
    return [];
  }
}

// Top agent berdasarkan jumlah percakapan ditangani (data asli).
async function teamPerf(tenantId: string | null): Promise<{ name: string; convs: number }[]> {
  if (!tenantId) return [];
  try {
    const r = await db.execute(
      sql`SELECT u.name, count(conv.id)::int convs
          FROM users u
          LEFT JOIN conversations conv ON conv.assigned_agent_id = u.id
          WHERE u.tenant_id = ${tenantId} AND u.role <> 'admin'
          GROUP BY u.id, u.name
          ORDER BY convs DESC
          LIMIT 5`,
    );
    const rows = r as unknown as Array<{ name: string; convs: number }>;
    return rows.map((row) => ({ name: String(row.name), convs: Number(row.convs ?? 0) }));
  } catch {
    return [];
  }
}

// Aktivitas terbaru: percakapan terakhir diperbarui (data asli).
async function recentConversations(
  tenantId: string | null,
): Promise<{ preview: string; contact: string; at: string | null }[]> {
  if (!tenantId) return [];
  try {
    const r = await db.execute(
      sql`SELECT coalesce(ct.name, 'Kontak') contact, conv.last_message_preview preview, conv.last_message_at at
          FROM conversations conv
          LEFT JOIN contacts ct ON ct.id = conv.contact_id
          WHERE conv.tenant_id = ${tenantId}
          ORDER BY conv.last_message_at DESC NULLS LAST
          LIMIT 6`,
    );
    const rows = r as unknown as Array<{ contact: string; preview: string | null; at: string | null }>;
    return rows.map((row) => ({
      contact: String(row.contact),
      preview: row.preview ? String(row.preview) : "(tanpa pratinjau)",
      at: row.at ? String(row.at) : null,
    }));
  } catch {
    return [];
  }
}

const RANK_COLORS = ["#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6"];

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
  const [c, volumes, team, activity] = await Promise.all([
    counts(session.tenantId),
    channelVolumes(session.tenantId),
    teamPerf(session.tenantId),
    recentConversations(session.tenantId),
  ]);
  const hasVolume = volumes.length > 0;
  const activeTeam = team.filter((t) => t.convs > 0);

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

      {/* Charts row — data asli; empty state bila belum ada pesan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {hasVolume ? (
          <>
            <ChannelVolumeChart data={volumes} />
            <ChannelDonut data={volumes} />
          </>
        ) : (
          <div className="lg:col-span-2">
            <SectionCard title="Volume Pesan per Channel" description="7 hari terakhir" contentClassName="pt-2">
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <MessageSquare className="size-6" />
                </span>
                <p className="text-sm font-medium">Belum ada pesan</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Hubungkan channel (WhatsApp, Instagram, Facebook, Telegram) untuk mulai melihat volume pesan di sini.
                </p>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Panels row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Team table — data asli */}
        <SectionCard title="Performa Tim" description="Berdasarkan percakapan ditangani" contentClassName="pt-2">
          {activeTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <UserPlus className="size-6" />
              </span>
              <p className="text-sm font-medium">Belum ada percakapan ditangani</p>
              <p className="text-xs text-muted-foreground">Statistik tim muncul setelah agent menangani percakapan.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[32px_1.6fr_1fr] items-center gap-3 border-b-2 border-border px-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Agent</span>
                <span>Percakapan</span>
              </div>
              {activeTeam.map((a, i) => (
                <div
                  key={a.name}
                  className="grid grid-cols-[32px_1.6fr_1fr] items-center gap-3 border-b border-border px-1 py-2.5 text-[13.5px] text-foreground transition-colors last:border-0 hover:bg-muted/50"
                >
                  <span className={`grid size-[26px] place-items-center rounded-lg text-xs font-bold ${RANK_BG[i + 1] ?? "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}
                    >
                      {initials(a.name)}
                    </span>
                    <span className="truncate font-semibold">{a.name}</span>
                  </span>
                  <span className="font-semibold text-brand-navy dark:text-foreground">{a.convs}</span>
                </div>
              ))}
            </>
          )}
        </SectionCard>

        {/* Activity feed — percakapan terakhir (data asli) */}
        <SectionCard title="Aktivitas Terbaru" description="Percakapan terakhir" contentClassName="pt-2">
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Inbox className="size-6" />
              </span>
              <p className="text-sm font-medium">Belum ada aktivitas</p>
              <p className="text-xs text-muted-foreground">Percakapan masuk akan muncul di sini.</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {activity.map((a, i) => (
                <li key={i} className="grid grid-cols-[32px_1fr] gap-3 border-b border-border py-3 last:border-0">
                  <span className="grid size-8 place-items-center rounded-[10px] bg-blue-50 text-brand-blue dark:bg-blue-500/15">
                    <MessageSquare className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium leading-snug text-foreground">{a.contact}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">{a.preview}</p>
                    {a.at && (
                      <span className="mt-0.5 inline-block text-[11.5px] text-muted-foreground">{timeAgo(a.at)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
