import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, CheckCheck, XCircle, ShieldOff, Clock, MousePointerClick, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { broadcasts, channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { cleanIDR, CHANNEL_META, timeAgo, type ChannelType } from "@/lib/format";
import { ActionLink } from "@/components/app/action-link";
import { StatusPill } from "@/components/app/status-pill";
import { SectionCard } from "@/components/app/section-card";

const STATUS_TONE: Record<string, "blue" | "amber" | "emerald" | "red" | "slate"> = {
  draft: "slate",
  scheduled: "blue",
  running: "amber",
  done: "emerald",
  failed: "red",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  scheduled: "Terjadwal",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

async function recipientCounts(tenantId: string, broadcastId: string) {
  try {
    const r = await db.execute(
      sql`select status, count(*)::int n from broadcast_recipients where tenant_id = ${tenantId} and broadcast_id = ${broadcastId} group by status`,
    );
    const rows = r as unknown as Array<{ status: string; n: number }>;
    const map: Record<string, number> = {};
    for (const row of rows) map[row.status] = Number(row.n);
    return map;
  } catch {
    return {};
  }
}

type ClickRow = { button: string; n: number };
type Clicker = { name: string | null; phone: string | null; button: string; at: string };

// Klik tombol per label + daftar pengklik terbaru (tenant-scoped).
async function buttonClicks(tenantId: string, broadcastId: string) {
  try {
    const [byButton, recent] = await Promise.all([
      db.execute(sql`
        select clicked_button as button, count(*)::int n
          from broadcast_recipients
         where tenant_id = ${tenantId} and broadcast_id = ${broadcastId} and clicked_button is not null
         group by clicked_button order by n desc`),
      db.execute(sql`
        select c.name, c.phone, r.clicked_button as button, r.clicked_at as at
          from broadcast_recipients r join contacts c on c.id = r.contact_id
         where r.tenant_id = ${tenantId} and r.broadcast_id = ${broadcastId} and r.clicked_button is not null
         order by r.clicked_at desc limit 50`),
    ]);
    return {
      byButton: (byButton as unknown as ClickRow[]).map((r) => ({ button: r.button, n: Number(r.n) })),
      recent: recent as unknown as Clicker[],
    };
  } catch {
    return { byButton: [] as ClickRow[], recent: [] as Clicker[] };
  }
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageAbility("broadcast.manage");
  if (!session.tenantId) notFound();

  const b = await db.query.broadcasts.findFirst({
    where: and(eq(broadcasts.id, id), eq(broadcasts.tenantId, session.tenantId)),
  });
  if (!b) notFound();

  const [channel, counts, clicks] = await Promise.all([
    db.query.channels.findFirst({
      where: and(eq(channels.id, b.channelId), eq(channels.tenantId, session.tenantId)),
    }),
    recipientCounts(session.tenantId, id),
    buttonClicks(session.tenantId, id),
  ]);
  // Tombol dari snapshot template, supaya tombol yang belum diklik tetap tampil (0).
  const snapButtons = ((b.templateParams as { buttons?: { text?: string }[] })?.buttons ?? [])
    .map((x) => x.text ?? "")
    .filter(Boolean);
  const clickMap = new Map(clicks.byButton.map((r) => [r.button, r.n]));
  const buttonRows = [...new Set([...snapButtons, ...clickMap.keys()])].map((label) => ({ label, n: clickMap.get(label) ?? 0 }));
  const totalClicks = buttonRows.reduce((a, r) => a + r.n, 0);

  const sent = (counts.sent ?? 0) + (counts.delivered ?? 0);
  const delivered = counts.delivered ?? 0;
  const failed = counts.failed ?? 0;
  const skipped = counts.skipped_optout ?? 0;
  const pending = counts.pending ?? 0;
  const total = sent + failed + skipped + pending;
  const chMeta = channel ? CHANNEL_META[channel.type as ChannelType] : null;

  const cards = [
    { label: "Total Penerima", value: total, icon: Send, tone: "#3b82f6" },
    { label: "Terkirim", value: sent, icon: Send, tone: "#10b981" },
    { label: "Delivered", value: delivered, icon: CheckCheck, tone: "#0ea5e9" },
    { label: "Gagal", value: failed, icon: XCircle, tone: "#ef4444" },
    { label: "Skip Opt-out", value: skipped, icon: ShieldOff, tone: "#f59e0b" },
    { label: "Pending", value: pending, icon: Clock, tone: "#8b5cf6" },
  ];

  return (
    <div className="p-6">
      <ActionLink href="/broadcasts" variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Broadcast
      </ActionLink>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{b.name}</h1>
            <StatusPill tone={STATUS_TONE[b.status] ?? "slate"}>
              {STATUS_LABEL[b.status] ?? b.status}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {chMeta ? `${chMeta.label} · ` : ""}
            {b.status === "scheduled" ? `Dijadwalkan ${fmtDateTime(b.scheduledAt)}` : `Dibuat ${fmtDateTime(b.createdAt)}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

      {/* Progress bar */}
      {total > 0 && (
        <SectionCard className="mt-6" title="Distribusi Pengiriman">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {[
              { v: sent, c: "#10b981" },
              { v: failed, c: "#ef4444" },
              { v: skipped, c: "#f59e0b" },
              { v: pending, c: "#8b5cf6" },
            ].map((s, i) =>
              s.v > 0 ? <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} /> : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <Legend c="#10b981" label={`Terkirim ${cleanIDR(sent)}`} />
            <Legend c="#ef4444" label={`Gagal ${cleanIDR(failed)}`} />
            <Legend c="#f59e0b" label={`Skip opt-out ${cleanIDR(skipped)}`} />
            <Legend c="#8b5cf6" label={`Pending ${cleanIDR(pending)}`} />
          </div>
        </SectionCard>
      )}

      {buttonRows.length > 0 && (
        <SectionCard
          className="mt-6"
          title="Klik Tombol"
          description={`${cleanIDR(totalClicks)} penerima mengklik tombol${sent > 0 ? ` · ${Math.round((totalClicks / sent) * 100)}% dari yang terkirim` : ""}`}
        >
          <div className="space-y-3">
            {buttonRows.map((r) => {
              const pct = totalClicks > 0 ? (r.n / totalClicks) * 100 : 0;
              return (
                <div key={r.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                      <MousePointerClick className="size-3.5 shrink-0 text-indigo-500" />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      <b className="text-foreground">{cleanIDR(r.n)}</b> · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {clicks.recent.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kontak</th>
                    <th className="px-3 py-2 font-medium">Tombol</th>
                    <th className="px-3 py-2 text-right font-medium">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.recent.map((c, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.name || "Tanpa nama"}</div>
                        <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {c.button}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(c.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Tag className="mt-0.5 size-3.5 shrink-0" />
            Mau follow-up yang klik tombol tertentu? Tambahkan langkah <b>Beri Tag</b> di flow tombol itu, lalu broadcast ke tag tersebut.
          </p>
        </SectionCard>
      )}

      {/* Body snapshot */}
      <SectionCard className="mt-6" title="Isi Pesan">
        {b.bodySnapshot ? (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">{b.bodySnapshot}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{b.templateId ? `Template: ${b.templateId}` : "Tidak ada isi pesan."}</p>
        )}
      </SectionCard>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: c }} /> {label}
    </span>
  );
}
