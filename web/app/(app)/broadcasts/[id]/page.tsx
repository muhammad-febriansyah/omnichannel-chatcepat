import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, CheckCheck, XCircle, ShieldOff, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { broadcasts, channels } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { cleanIDR, CHANNEL_META, type ChannelType } from "@/lib/format";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-50 text-blue-700",
  running: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
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
      sql.raw(
        `select status, count(*)::int n from broadcast_recipients where tenant_id='${tenantId}' and broadcast_id='${broadcastId}' group by status`,
      ),
    );
    const rows = r as unknown as Array<{ status: string; n: number }>;
    const map: Record<string, number> = {};
    for (const row of rows) map[row.status] = Number(row.n);
    return map;
  } catch {
    return {};
  }
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();

  const b = await db.query.broadcasts.findFirst({
    where: and(eq(broadcasts.id, id), eq(broadcasts.tenantId, session.tenantId)),
  });
  if (!b) notFound();

  const [channel, counts] = await Promise.all([
    db.query.channels.findFirst({
      where: and(eq(channels.id, b.channelId), eq(channels.tenantId, session.tenantId)),
    }),
    recipientCounts(session.tenantId, id),
  ]);

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
      <Link
        href="/broadcasts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Broadcast
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{b.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[b.status] ?? "bg-slate-100"}`}>
              {STATUS_LABEL[b.status] ?? b.status}
            </span>
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
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Distribusi Pengiriman</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
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
        </div>
      )}

      {/* Body snapshot */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Isi Pesan</h2>
        {b.bodySnapshot ? (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">{b.bodySnapshot}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{b.templateId ? `Template: ${b.templateId}` : "Tidak ada isi pesan."}</p>
        )}
      </div>
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
