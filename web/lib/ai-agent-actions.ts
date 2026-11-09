"use server";

import { userError } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { aiAgentKnowledge, aiAgents, knowledgeDocuments, promos } from "./db/schema";
import { requireAbility } from "./rbac";
import { requireSession } from "./session";
import { businessToEngine, type AgentInput } from "./ai-agent-options";

const text = (max: number, label: string) => z.string().trim().max(max, `${label} maksimal ${max} karakter`);

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

const agentSchema = z.object({
  name: z.string().trim().min(1, "Nama agent wajib diisi").max(60, "Nama maksimal 60 karakter"),
  role: z.enum(["cs", "sales", "reservasi", "promosi", "sosial"]),
  tone: z.enum(["ramah", "profesional", "promosi", "santai", "singkat", "empatik"]),
  emoji: z.enum(["tanpa", "sedikit", "banyak"]),
  length: z.enum(["pendek", "sedang"]),
  greeting: z.enum(["kak", "bapak_ibu", "nama"]),
  language: z.enum(["auto", "id", "en"]),
  goal: z.string().trim().max(200, "Tujuan maksimal 200 karakter"),
  instructions: z.string().trim().max(3000, "Instruksi maksimal 3000 karakter"),
  examples: z
    .array(z.object({ q: z.string().trim().max(300), a: z.string().trim().max(600) }))
    .max(5, "Maksimal 5 contoh jawaban"),
  handoffRules: z.string().trim().max(1000, "Aturan pengalihan maksimal 1000 karakter"),
  fallbackMessage: z.string().trim().max(300, "Pesan cadangan maksimal 300 karakter"),
  knowledgeAll: z.boolean(),
  documentIds: z.array(z.string().uuid()).max(100),
  useCatalog: z.boolean(),
  usePromos: z.boolean(),
  isActive: z.boolean(),
  businessInfo: z.object({
    assistantName: text(40, "Nama asisten"),
    businessName: text(80, "Nama bisnis"),
    hours: text(200, "Jam operasional"),
    address: text(300, "Alamat"),
    shipping: text(300, "Info pengiriman"),
    payment: text(300, "Info pembayaran"),
    returns: text(300, "Info retur"),
    other: text(1000, "Info lain"),
  }),
});

function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Data tidak valid";
}

async function tenantSession() {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  return { session, tenantId: session.tenantId };
}

export type SimulateResult = {
  enabled: boolean;
  quotaExceeded?: boolean;
  answers: { tone: string; answer: string }[];
  kbUsed: boolean;
};

// Try unsaved agent settings; tones = compare the same question in several styles.
export async function simulateAgent(message: string, agent: AgentInput, tones?: string[]): Promise<SimulateResult> {
  const { session, tenantId } = await tenantSession();
  // A name isn't needed just to try the agent out.
  const parsed = agentSchema.safeParse({ ...agent, name: agent.name.trim() || "Simulasi" });
  if (!parsed.success) throw userError(firstError(parsed.error));
  if (!message.trim()) throw userError("Tulis pertanyaan untuk dicoba");
  const v = parsed.data;
  const res = await fetch(`${ENGINE}/ai-agent/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      message: message.slice(0, 1000),
      tones: tones?.slice(0, 4),
      agent: {
        name: v.name,
        role: v.role,
        tone: v.tone,
        emoji: v.emoji,
        length: v.length,
        greeting: v.greeting,
        language: v.language,
        goal: v.goal || null,
        instructions: v.instructions || null,
        examples: v.examples,
        handoff_rules: v.handoffRules || null,
        fallback_message: v.fallbackMessage || null,
        knowledge_all: v.knowledgeAll,
        document_ids: v.documentIds,
        use_catalog: v.useCatalog,
        use_promos: v.usePromos,
        business_info: businessToEngine(v.businessInfo),
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw userError("Gagal menjalankan simulasi");
  const j = (await res.json()) as {
    data: { enabled: boolean; quota_exceeded?: boolean; answers?: { tone: string; answer: string }[]; kb_used?: boolean };
  };
  return { enabled: j.data.enabled, quotaExceeded: Boolean(j.data.quota_exceeded), answers: j.data.answers ?? [], kbUsed: Boolean(j.data.kb_used) };
}

// --- Asisten AI (menu Asisten AI): reusable agents for channels and flow AI nodes ---

// Only this tenant's documents may be linked (ids come from the client).
async function ownDocIds(tenantId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.tenantId, tenantId), inArray(knowledgeDocuments.id, ids)));
  return rows.map((r) => r.id);
}

export async function saveAgent(id: string | null, input: AgentInput): Promise<{ id: string }> {
  const { tenantId } = await tenantSession();
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) throw userError(firstError(parsed.error));
  const v = parsed.data;
  const docIds = v.knowledgeAll ? [] : await ownDocIds(tenantId, v.documentIds);
  const values = {
    name: v.name,
    role: v.role,
    tone: v.tone,
    emoji: v.emoji,
    length: v.length,
    greeting: v.greeting,
    language: v.language,
    goal: v.goal || null,
    instructions: v.instructions || null,
    examples: v.examples.filter((x) => x.q && x.a),
    handoffRules: v.handoffRules || null,
    fallbackMessage: v.fallbackMessage || null,
    businessInfo: businessToEngine(v.businessInfo),
    knowledgeAll: v.knowledgeAll,
    useCatalog: v.useCatalog,
    usePromos: v.usePromos,
    isActive: v.isActive,
  };

  const savedId = await db.transaction(async (tx) => {
    let agentId: string;
    if (id) {
      const updated = await tx
        .update(aiAgents)
        .set({ ...values, updatedAt: sql`now()` })
        .where(and(eq(aiAgents.id, id), eq(aiAgents.tenantId, tenantId)))
        .returning({ id: aiAgents.id });
      if (!updated.length) throw userError("Asisten tidak ditemukan");
      agentId = updated[0].id;
      await tx.delete(aiAgentKnowledge).where(and(eq(aiAgentKnowledge.tenantId, tenantId), eq(aiAgentKnowledge.agentId, agentId)));
    } else {
      // The first assistant becomes the workspace default (used when nothing else is chosen).
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aiAgents)
        .where(eq(aiAgents.tenantId, tenantId));
      if (Number(n) >= 20) throw userError("Maksimal 20 asisten per workspace");
      const [row] = await tx
        .insert(aiAgents)
        .values({ ...values, tenantId, isDefault: Number(n) === 0 })
        .returning({ id: aiAgents.id });
      agentId = row.id;
    }
    if (docIds.length) {
      await tx.insert(aiAgentKnowledge).values(docIds.map((documentId) => ({ tenantId, agentId, documentId })));
    }
    return agentId;
  });
  revalidatePath("/ai-agent");
  return { id: savedId };
}

export async function deleteAgent(id: string): Promise<void> {
  const { tenantId } = await tenantSession();
  const [gone] = await db
    .delete(aiAgents)
    .where(and(eq(aiAgents.id, id), eq(aiAgents.tenantId, tenantId)))
    .returning({ isDefault: aiAgents.isDefault });
  // Keep a default when others remain (channels with no assistant use it).
  if (gone?.isDefault) {
    const next = await db.query.aiAgents.findFirst({
      where: eq(aiAgents.tenantId, tenantId),
      orderBy: (a, { asc }) => [asc(a.createdAt)],
      columns: { id: true },
    });
    if (next) await db.update(aiAgents).set({ isDefault: true }).where(and(eq(aiAgents.id, next.id), eq(aiAgents.tenantId, tenantId)));
  }
  revalidatePath("/ai-agent");
  revalidatePath("/channels");
}

export async function setDefaultAgent(id: string): Promise<void> {
  const { tenantId } = await tenantSession();
  // One default per tenant (unique index): clear the old one first, then set.
  await db.transaction(async (tx) => {
    await tx
      .update(aiAgents)
      .set({ isDefault: false })
      .where(and(eq(aiAgents.tenantId, tenantId), ne(aiAgents.id, id)));
    const hit = await tx
      .update(aiAgents)
      .set({ isDefault: true, isActive: true, updatedAt: sql`now()` })
      .where(and(eq(aiAgents.id, id), eq(aiAgents.tenantId, tenantId)))
      .returning({ id: aiAgents.id });
    if (!hit.length) throw userError("Asisten tidak ditemukan");
  });
  revalidatePath("/ai-agent");
}

// --- Promos ---

const promoSchema = z
  .object({
    title: z.string().trim().min(1, "Judul promo wajib diisi").max(120),
    description: z.string().trim().max(500, "Detail promo maksimal 500 karakter"),
    code: z.string().trim().max(40),
    startsAt: z.string().trim(),
    endsAt: z.string().trim(),
    isActive: z.boolean(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt <= v.endsAt, {
    message: "Tanggal selesai harus setelah tanggal mulai",
  });

export type PromoInput = z.infer<typeof promoSchema>;

// Dates come from <input type="date"> (YYYY-MM-DD, WIB): start of day / end of day.
function wibDate(value: string, endOfDay: boolean): string | null {
  if (!value) return null;
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`).toISOString();
}

export async function savePromo(id: string | null, input: PromoInput): Promise<void> {
  const { tenantId } = await tenantSession();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) throw userError(firstError(parsed.error));
  const v = parsed.data;
  const values = {
    title: v.title,
    description: v.description || null,
    code: v.code || null,
    startsAt: wibDate(v.startsAt, false),
    endsAt: wibDate(v.endsAt, true),
    isActive: v.isActive,
  };
  if (id) {
    const updated = await db
      .update(promos)
      .set({ ...values, updatedAt: sql`now()` })
      .where(and(eq(promos.id, id), eq(promos.tenantId, tenantId)))
      .returning({ id: promos.id });
    if (!updated.length) throw userError("Promo tidak ditemukan");
  } else {
    await db.insert(promos).values({ ...values, tenantId });
  }
  revalidatePath("/flows");
}

export async function deletePromo(id: string): Promise<void> {
  const { tenantId } = await tenantSession();
  await db.delete(promos).where(and(eq(promos.id, id), eq(promos.tenantId, tenantId)));
  revalidatePath("/flows");
}
