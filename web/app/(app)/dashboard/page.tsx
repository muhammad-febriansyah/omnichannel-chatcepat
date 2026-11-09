import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Bot, Clock, Inbox, MessageSquare, MessagesSquare, Plug, UserPlus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { sessionEntitlements } from "@/lib/entitlements";
import { loadAiBalance } from "@/lib/ai-balance";
import { cleanIDR, timeAgo } from "@/lib/format";
import { CHANNEL_FILTERS, RANGES, loadTenantDashboard, parseFilters, type Delta } from "@/lib/tenant-dashboard";
import { ChannelLogo, type ChannelKey } from "@/components/app/charts";
import { DonutChart, GroupedBarChart, HeatmapChart, RadialGauge, RankingChart, TimeSeriesChart } from "@/components/app/apex-charts";
import { DashboardFilters } from "@/components/app/dashboard-filters";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SectionCard } from "@/components/app/section-card";

const CH_KEY: Record<string, ChannelKey> = {
  wa_official: "whatsapp",
  wa_unofficial: "whatsapp",
  facebook: "messenger",
  instagram: "instagram",
  telegram: "telegram",
};
const CH_LABEL: Record<string, string> = Object.fromEntries(CHANNEL_FILTERS.map((c) => [c.id, c.label]));
const OPT_IN_LABEL: Record<string, string> = { opted_in: "Opt-in", opted_out: "Opt-out", unknown: "Belum jelas" };
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

function greeting(hour: number) {
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 19) return "Selamat Sore";
  return "Selamat Malam";
}

// % change vs previous period: null = new (nothing before), 0 = flat.
function delta(d: Delta): number | null {
  if (d.prev === 0) return d.cur === 0 ? 0 : null;
  return Math.round(((d.cur - d.prev) / d.prev) * 100);
}

function duration(seconds: number): string {
  if (!seconds) return "–";
  if (seconds < 60) return `${Math.round(seconds)} dtk`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h} j ${m} m` : `${h} jam`;
}

function Empty({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; ch?: string }> }) {
  const session = await requireSession();
  if (session.isPlatformAdmin) redirect("/admin");
  // Tenant comes from the signed-in session only — never from the URL.
  if (!session.tenantId) redirect("/login");
  const filters = parseFilters(await searchParams);

  const entitlements = await sessionEntitlements(session);
  const [d, ai] = await Promise.all([
    loadTenantDashboard(session.tenantId, filters),
    loadAiBalance(session.tenantId, entitlements.aiTokensMonthly).catch(() => null),
  ]);

  const now = new Date();
  const wibHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(now));
  const dateStr = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(now);
  const firstName = session.name.split(/\s+/)[0];
  const rangeLabel = RANGES.find((r) => r.id === filters.range)?.label ?? "";
  const periodHint = filters.range === "today" ? "hari ini" : `${rangeLabel} terakhir`;
  const k = d.kpi;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const trend = (xs: number[]) => (xs.length > 1 && xs.some((x) => x > 0) ? xs : undefined);
  const botReplies = sum(d.series.bot);
  const agentReplies = sum(d.series.agent);
  const aiPct = ai && ai.monthlyAllowance > 0 ? Math.min(100, (ai.usedThisMonth / ai.monthlyAllowance) * 100) : 0;
  const problemChannels = d.channels.filter((c) => c.status === "banned" || c.status === "disconnected");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`${greeting(wibHour)}, ${firstName}!`}
        description={`${dateStr} · Ringkasan workspace ${periodHint}${filters.channel ? ` · ${CH_LABEL[filters.channel]}` : ""}`}
        actions={<DashboardFilters ranges={[...RANGES]} channels={[...CHANNEL_FILTERS]} range={filters.range} channel={filters.channel} />}
      />

      {problemChannels.length > 0 && (
        <Link
          href="/channels"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <span>
            <b>{problemChannels.length} channel bermasalah:</b> {problemChannels.map((c) => `${c.name} (${c.status === "banned" ? "dibatasi WhatsApp" : "terputus"})`).join(", ")}.
            Pesan dari channel ini tidak terkirim. Klik untuk menyambungkan ulang.
          </span>
        </Link>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={MessageSquare} label="Pesan masuk" value={cleanIDR(k.inbound.cur)} tone="#2547F9" delta={delta(k.inbound)} spark={trend(d.series.inbound)} />
        <StatCard icon={MessagesSquare} label="Percakapan baru" value={cleanIDR(k.newConversations.cur)} tone="#06B6D4" delta={delta(k.newConversations)} spark={trend(d.series.conversations)} />
        <StatCard
          icon={Bot}
          label="Dibalas otomatis"
          value={`${k.automation.cur}%`}
          tone="#8B5CF6"
          delta={k.automation.prev || k.automation.cur ? k.automation.cur - k.automation.prev : undefined}
          hint={`${cleanIDR(botReplies)} oleh bot/AI · ${cleanIDR(agentReplies)} oleh agen`}
        />
        <StatCard
          icon={Clock}
          label="Waktu balas pertama"
          value={duration(k.firstResponse.cur)}
          tone="#F59E0B"
          delta={k.firstResponse.cur && k.firstResponse.prev ? delta(k.firstResponse) : undefined}
          lowerIsBetter
          hint={`Agen saja: ${duration(k.firstResponseAgent)}`}
        />
        <StatCard icon={UserPlus} label="Kontak baru" value={cleanIDR(k.newContacts.cur)} tone="#10B981" delta={delta(k.newContacts)} spark={trend(d.series.contacts)} hint={`${cleanIDR(k.optIns)} opt-in baru`} />
        <StatCard icon={Inbox} label="Menunggu dibalas" value={cleanIDR(k.waiting)} tone={k.waiting > 0 ? "#EF4444" : "#64748B"} hint={<Link href="/inbox" className="font-medium text-brand-blue hover:underline">Buka inbox →</Link>} />
      </div>

      {/* Trend + channel mix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <SectionCard title="Tren Pesan" description={`Masuk vs balasan bot/AI vs agen · ${periodHint}`} contentClassName="pt-2">
          <TimeSeriesChart
            type="area"
            categories={d.labels}
            series={[
              { name: "Pesan masuk", data: d.series.inbound },
              { name: "Bot/AI", data: d.series.bot },
              { name: "Agen", data: d.series.agent },
            ]}
            height={300}
          />
        </SectionCard>
        <SectionCard title="Pesan per Channel" description={periodHint} contentClassName="pt-2">
          {d.byChannel.length ? (
            <DonutChart labels={d.byChannel.map((c) => CH_LABEL[c.type] ?? c.type)} values={d.byChannel.map((c) => c.n)} totalLabel="Pesan" height={300} />
          ) : (
            <Empty icon={Plug} title="Belum ada pesan" text="Hubungkan WhatsApp, Instagram, Facebook, atau Telegram untuk mulai melihat volume pesan." />
          )}
        </SectionCard>
      </div>

      {/* Busy hours + bot/AI */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard title="Jam Tersibuk" description={`Pesan masuk per hari & jam (WIB) · ${periodHint}. Pakai untuk mengatur jam jaga CS.`} contentClassName="pt-2">
          <HeatmapChart rows={DAYS} columns={HOURS} values={d.heatmap} height={290} />
        </SectionCard>
        <SectionCard title="Bot & AI" description="Porsi balasan otomatis dan kuota token AI" contentClassName="pt-2">
          <RadialGauge value={k.automation.cur} label="Dibalas otomatis" color="#8B5CF6" height={200} />
          <div className="mt-2 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Jawaban AI {periodHint}</span>
              <span className="font-semibold tabular-nums">{cleanIDR(d.ai.calls)}×</span>
            </div>
            {ai && ai.monthlyAllowance > 0 && (
              <div>
                <div className="mb-1.5 flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Token AI bulan ini</span>
                  <span className="font-medium tabular-nums">
                    {cleanIDR(ai.usedThisMonth)} / {cleanIDR(ai.monthlyAllowance)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={aiPct >= 90 ? "h-full bg-red-500" : aiPct >= 70 ? "h-full bg-amber-500" : "h-full bg-violet-500"} style={{ width: `${aiPct}%` }} />
                </div>
                {aiPct >= 80 && (
                  <Link href="/billing" className="mt-1.5 inline-block text-xs font-medium text-red-600 hover:underline">
                    Kuota hampir habis, top-up di Tagihan →
                  </Link>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* AI tokens per day */}
      {d.ai.tokens > 0 && (
        <SectionCard title="Pemakaian Token AI" description={periodHint} contentClassName="pt-2">
          <TimeSeriesChart type="bar" categories={d.labels} series={[{ name: "Token", data: d.series.aiTokens }]} format="tokens" height={240} />
        </SectionCard>
      )}

      {/* Broadcast + contacts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Hasil Broadcast" description="6 broadcast terakhir: terkirim → diterima → dibaca → klik" contentClassName="pt-2">
          {d.broadcasts.length ? (
            <GroupedBarChart
              categories={d.broadcasts.map((b) => (b.name.length > 22 ? `${b.name.slice(0, 21)}…` : b.name))}
              series={[
                { name: "Terkirim", data: d.broadcasts.map((b) => b.sent) },
                { name: "Diterima", data: d.broadcasts.map((b) => b.delivered) },
                { name: "Dibaca", data: d.broadcasts.map((b) => b.read) },
                { name: "Klik tombol", data: d.broadcasts.map((b) => b.clicked) },
                { name: "Gagal", data: d.broadcasts.map((b) => b.failed) },
              ]}
              height={Math.max(260, d.broadcasts.length * 70)}
            />
          ) : (
            <Empty icon={MessagesSquare} title="Belum ada broadcast terkirim" text="Hasil broadcast WhatsApp akan tampil di sini." />
          )}
        </SectionCard>
        <SectionCard title="Pertumbuhan Kontak" description={`Total ${cleanIDR(d.contacts.total)} kontak`} contentClassName="pt-2">
          <TimeSeriesChart type="area" categories={d.labels} series={[{ name: "Total kontak", data: d.contacts.growth }]} height={200} />
          <div className="mt-3 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <DonutChart
              labels={d.contacts.optIn.map((o) => OPT_IN_LABEL[o.status] ?? o.status)}
              values={d.contacts.optIn.map((o) => o.n)}
              totalLabel="Kontak"
              height={220}
            />
            {d.contacts.tags.length ? (
              <RankingChart labels={d.contacts.tags.map((x) => x.tag)} values={d.contacts.tags.map((x) => x.n)} height={220} />
            ) : (
              <p className="grid place-items-center text-center text-xs text-muted-foreground">Belum ada tag kontak.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Agents */}
      <SectionCard title="Kinerja Agen" description={`Balasan manual CS · ${periodHint}`} contentClassName="pt-2">
        {d.agents.length === 0 ? (
          <Empty icon={UserPlus} title="Belum ada balasan agen" text="Saat CS membalas dari inbox, jumlah pesan & waktu balasnya tampil di sini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-1 py-2.5">Agen</th>
                  <th className="px-1 py-2.5 text-right">Pesan</th>
                  <th className="px-1 py-2.5 text-right">Percakapan</th>
                  <th className="px-1 py-2.5 text-right">Waktu balas</th>
                  <th className="px-1 py-2.5 text-right">Sedang ditangani</th>
                </tr>
              </thead>
              <tbody>
                {d.agents.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-1 py-2.5 font-medium">{a.name}</td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{cleanIDR(a.messages)}</td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{cleanIDR(a.conversations)}</td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{a.avgFirstResponse ? duration(a.avgFirstResponse) : "–"}</td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{cleanIDR(a.openAssigned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Channel status + recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Status Channel" description="Channel terhubung & jumlah percakapan" contentClassName="pt-2">
          {d.channels.length === 0 ? (
            <Empty icon={Plug} title="Belum ada channel" text="Hubungkan WhatsApp, Instagram, Facebook, atau Telegram di menu Channel." />
          ) : (
            <>
              <div className="grid grid-cols-[1.6fr_auto_auto] items-center gap-3 border-b-2 border-border px-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Channel</span>
                <span>Status</span>
                <span>Percakapan</span>
              </div>
              {d.channels.map((ch) => {
                const key = CH_KEY[ch.type];
                const tone =
                  ch.status === "connected"
                    ? { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", dot: "bg-emerald-500", label: "Terhubung" }
                    : ch.status === "banned"
                      ? { cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500", label: "Dibatasi" }
                      : ch.status === "pending"
                        ? { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500", label: "Menunggu" }
                        : { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50", label: "Terputus" };
                return (
                  <div key={ch.name + ch.type} className="grid grid-cols-[1.6fr_auto_auto] items-center gap-3 border-b border-border px-1 py-2.5 text-[13.5px] last:border-0 hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {key ? <ChannelLogo ch={key} size={20} /> : <Plug className="size-5 text-muted-foreground" />}
                      <span className="truncate font-semibold">{ch.name}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tone.cls}`}>
                      <span className={`size-1.5 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                    <span className="text-right font-semibold text-brand-navy dark:text-foreground">{ch.convs}</span>
                  </div>
                );
              })}
            </>
          )}
        </SectionCard>

        <SectionCard title="Aktivitas Terbaru" description="Percakapan terakhir" contentClassName="pt-2">
          {d.recent.length === 0 ? (
            <Empty icon={Inbox} title="Belum ada aktivitas" text="Percakapan masuk akan muncul di sini." />
          ) : (
            <ul className="flex flex-col">
              {d.recent.map((a, i) => (
                <li key={i} className="grid grid-cols-[32px_1fr] gap-3 border-b border-border py-3 last:border-0">
                  <span className="grid size-8 place-items-center rounded-[10px] bg-blue-50 text-brand-blue dark:bg-blue-500/15">
                    <MessageSquare className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium leading-snug">{a.contact}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">{a.preview}</p>
                    {a.at && <span className="mt-0.5 inline-block text-[11.5px] text-muted-foreground">{timeAgo(a.at)}</span>}
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
