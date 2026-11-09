import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { aiAgentKnowledge, aiAgents, aiUnanswered, broadcastRecipients, broadcasts, knowledgeDocuments, knowledgeFaqs, products, promos } from "./db/schema";
import type { BroadcastRow } from "@/components/app/broadcasts-table";
import {
  businessFromEngine,
  normalizeAiConfig,
  type AgentInput,
  type PromoItem,
  type PromoState,
} from "./ai-agent-options";

export type AgentSummary = {
  id: string;
  name: string;
  role: string;
  tone: string;
  assistantName: string;
  businessName: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
};

// Menu Asisten AI list + pickers (Pengaturan Balasan, flow AI node).
export async function loadAgents(tenantId: string): Promise<AgentSummary[]> {
  const rows = await db.query.aiAgents.findMany({
    where: eq(aiAgents.tenantId, tenantId),
    orderBy: [desc(aiAgents.isDefault), aiAgents.createdAt],
    columns: { id: true, name: true, role: true, tone: true, businessInfo: true, isDefault: true, isActive: true, updatedAt: true },
  });
  return rows.map((a) => {
    const info = businessFromEngine(a.businessInfo);
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      tone: a.tone,
      assistantName: info.assistantName,
      businessName: info.businessName,
      isDefault: a.isDefault,
      isActive: a.isActive,
      updatedAt: a.updatedAt,
    };
  });
}

// One assistant as editor values (null = not this tenant's).
export async function loadAgent(tenantId: string, id: string): Promise<(AgentInput & { id: string; isDefault: boolean }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const a = await db.query.aiAgents.findFirst({ where: and(eq(aiAgents.id, id), eq(aiAgents.tenantId, tenantId)) });
  if (!a) return null;
  const docs = await db
    .select({ id: aiAgentKnowledge.documentId })
    .from(aiAgentKnowledge)
    .where(and(eq(aiAgentKnowledge.tenantId, tenantId), eq(aiAgentKnowledge.agentId, a.id)));
  const config = normalizeAiConfig({
    role: a.role,
    tone: a.tone,
    emoji: a.emoji,
    length: a.length,
    greeting: a.greeting,
    language: a.language,
    goal: a.goal ?? "",
    instructions: a.instructions ?? "",
    examples: Array.isArray(a.examples) ? a.examples : [],
    handoffRules: a.handoffRules ?? "",
    fallbackMessage: a.fallbackMessage ?? "",
    knowledgeAll: a.knowledgeAll,
    documentIds: docs.map((d) => d.id),
    useCatalog: a.useCatalog,
    usePromos: a.usePromos,
    businessInfo: businessFromEngine(a.businessInfo),
  });
  return { ...config, id: a.id, name: a.name, isActive: a.isActive, isDefault: a.isDefault };
}

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

export type FaqRow = { id: string; question: string; answer: string; isActive: boolean; updatedAt: string };
export type UnansweredRow = { id: string; question: string; askCount: number; lastAskedAt: string; conversationId: string | null };

// Automation → Pengetahuan: everything the AI knows, plus what it could not answer.
export async function loadKnowledgeOverview(tenantId: string) {
  const [faqs, unanswered, docs, productCount] = await Promise.all([
    db.query.knowledgeFaqs.findMany({
      where: eq(knowledgeFaqs.tenantId, tenantId),
      orderBy: [desc(knowledgeFaqs.updatedAt)],
      columns: { id: true, question: true, answer: true, isActive: true, updatedAt: true },
      limit: 500,
    }),
    db.query.aiUnanswered.findMany({
      where: and(eq(aiUnanswered.tenantId, tenantId), eq(aiUnanswered.status, "open")),
      orderBy: [desc(aiUnanswered.askCount), desc(aiUnanswered.lastAskedAt)],
      columns: { id: true, question: true, askCount: true, lastAskedAt: true, conversationId: true },
      limit: 50,
    }),
    loadDocs(tenantId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.active, true))),
  ]);
  return {
    faqs: faqs as FaqRow[],
    unanswered: unanswered as UnansweredRow[],
    docs,
    productCount: Number(productCount[0]?.n ?? 0),
  };
}
