import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { broadcastRecipients, broadcasts, knowledgeDocuments, promos } from "./db/schema";
import type { BroadcastRow } from "@/components/app/broadcasts-table";
import type { PromoItem, PromoState } from "./ai-agent-options";

// YYYY-MM-DD in WIB, for <input type="date">.
const wibDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "";

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : null;

export async function loadDocs(tenantId: string) {
  return db.query.knowledgeDocuments.findMany({
    where: eq(knowledgeDocuments.tenantId, tenantId),
    orderBy: [desc(knowledgeDocuments.createdAt)],
    columns: { id: true, title: true, status: true },
  });
}

export async function loadPromos(tenantId: string): Promise<PromoItem[]> {
  const list = await db.query.promos.findMany({ where: eq(promos.tenantId, tenantId), orderBy: [desc(promos.createdAt)] });
  const now = Date.now();
  return list.map((p) => {
    const start = p.startsAt ? new Date(p.startsAt).getTime() : null;
    const end = p.endsAt ? new Date(p.endsAt).getTime() : null;
    const state: PromoState = !p.isActive
      ? "nonaktif"
      : end !== null && end < now
        ? "berakhir"
        : start !== null && start > now
          ? "terjadwal"
          : "berjalan";
    const from = fmtDate(p.startsAt);
    const to = fmtDate(p.endsAt);
    return {
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      code: p.code ?? "",
      startsAt: wibDay(p.startsAt),
      endsAt: wibDay(p.endsAt),
      isActive: p.isActive,
      period: from && to ? `${from} – ${to}` : to ? `s/d ${to}` : from ? `Mulai ${from}` : "Tanpa batas",
      state,
    };
  });
}

// Automation → Riwayat Broadcast: every broadcast (flow and older wizard ones),
// newest first, with button-click totals from one grouped query.
export async function loadBroadcastHistory(tenantId: string): Promise<BroadcastRow[]> {
  const rows = await db.query.broadcasts.findMany({
    where: eq(broadcasts.tenantId, tenantId),
    orderBy: [desc(broadcasts.createdAt)],
    limit: 200,
    columns: { id: true, name: true, status: true, scheduledAt: true, createdAt: true, stats: true, flowId: true },
    with: { channel: { columns: { name: true, type: true } }, flow: { columns: { id: true, name: true } } },
  });
  if (rows.length === 0) return [];
  const clicks = await db
    .select({ id: broadcastRecipients.broadcastId, n: sql<number>`count(*)::int` })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.tenantId, tenantId),
        inArray(broadcastRecipients.broadcastId, rows.map((r) => r.id)),
        isNotNull(broadcastRecipients.clickedButton),
      ),
    )
    .groupBy(broadcastRecipients.broadcastId);
  const clickMap = new Map(clicks.map((c) => [c.id, Number(c.n)]));
  return rows.map((b) => {
    const stats = (b.stats ?? {}) as Record<string, number | string>;
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      channel: b.channel?.name ?? "—",
      channelType: b.channel?.type ?? "",
      flowId: b.flow?.id ?? null,
      flowName: b.flow?.name ?? null,
      when: b.scheduledAt ?? b.createdAt,
      sent: Number(stats.sent ?? 0),
      total: Number(stats.total ?? 0),
      skipped: Number(stats.skipped_optout ?? 0),
      clicks: clickMap.get(b.id) ?? 0,
      error: typeof stats.error === "string" ? stats.error : null,
    };
  });
}
