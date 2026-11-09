"use server";

// Automation → Pengetahuan: FAQ (Tanya-Jawab) the AI answers from first, and the
// questions it could not answer. Tenant id always comes from the session.

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { userError } from "@/lib/action-error";
import { db } from "./db";
import { aiUnanswered, knowledgeFaqs } from "./db/schema";
import { requireAbility } from "./rbac";
import { requireSession } from "./session";
import { assertCanAddKb } from "./entitlements";
import { enginePost } from "./engine-call";
import { MAX_IMPORT_ROWS } from "./table-import";

const MAX_FAQS = 500;

const faqSchema = z.object({
  question: z.string().trim().min(3, "Pertanyaan minimal 3 karakter").max(300, "Pertanyaan maksimal 300 karakter"),
  answer: z.string().trim().min(1, "Jawaban wajib diisi").max(2000, "Jawaban maksimal 2000 karakter"),
  isActive: z.boolean(),
});

export type FaqInput = z.infer<typeof faqSchema>;

async function tenantSession() {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  return session.tenantId;
}

const isUuid = (v: string | null | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Create (id null) or update a FAQ. fromUnanswered: mark that question answered. */
export async function saveFaq(id: string | null, input: FaqInput, fromUnanswered?: string | null): Promise<{ id: string }> {
  const tenantId = await tenantSession();
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) throw userError(parsed.error.issues[0]?.message ?? "Data tidak valid");
  const v = parsed.data;

  const faqId = await db.transaction(async (tx) => {
    let savedId: string;
    if (id) {
      const updated = await tx
        .update(knowledgeFaqs)
        .set({ question: v.question, answer: v.answer, isActive: v.isActive, updatedAt: sql`now()` })
        .where(and(eq(knowledgeFaqs.id, id), eq(knowledgeFaqs.tenantId, tenantId)))
        .returning({ id: knowledgeFaqs.id });
      if (!updated.length) throw userError("Tanya-jawab tidak ditemukan");
      savedId = updated[0].id;
    } else {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(knowledgeFaqs)
        .where(eq(knowledgeFaqs.tenantId, tenantId));
      if (Number(n) >= MAX_FAQS) throw userError(`Maksimal ${MAX_FAQS} tanya-jawab per workspace`);
      const [row] = await tx
        .insert(knowledgeFaqs)
        .values({ tenantId, question: v.question, answer: v.answer, isActive: v.isActive })
        .returning({ id: knowledgeFaqs.id });
      savedId = row.id;
    }
    if (isUuid(fromUnanswered)) {
      await tx
        .update(aiUnanswered)
        .set({ status: "answered", faqId: savedId })
        .where(and(eq(aiUnanswered.id, fromUnanswered), eq(aiUnanswered.tenantId, tenantId)));
    }
    return savedId;
  });
  revalidatePath("/flows");
  return { id: faqId };
}

export async function deleteFaq(id: string): Promise<void> {
  const tenantId = await tenantSession();
  await db.delete(knowledgeFaqs).where(and(eq(knowledgeFaqs.id, id), eq(knowledgeFaqs.tenantId, tenantId)));
  revalidatePath("/flows");
}

/** "Abaikan": a question that is not worth an answer (spam, off-topic). */
export async function setUnansweredStatus(id: string, status: "open" | "ignored"): Promise<void> {
  const tenantId = await tenantSession();
  if (status !== "open" && status !== "ignored") throw userError("Status tidak valid");
  await db
    .update(aiUnanswered)
    .set({ status })
    .where(and(eq(aiUnanswered.id, id), eq(aiUnanswered.tenantId, tenantId)));
  revalidatePath("/flows");
}

/** One public page of the business's own website → knowledge document. */
export async function importKnowledgeUrl(url: string, title: string): Promise<{ chars: number }> {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const clean = url.trim();
  if (!/^https?:\/\/\S+$/i.test(clean) || clean.length > 500) throw userError("Masukkan alamat lengkap, mis. https://tokoanda.com/faq");
  await assertCanAddKb(session);
  try {
    const data = await enginePost<{ chars: number }>("/knowledge/url", session.role, {
      tenant_id: session.tenantId,
      url: clean,
      title: title.trim().slice(0, 120) || null,
    });
    revalidatePath("/flows");
    return { chars: data.chars };
  } catch (e) {
    throw userError(e instanceof Error ? e.message : "Gagal mengambil halaman");
  }
}

const faqImportSchema = z
  .array(
    z.object({
      question: z.string().trim().min(3).max(300),
      answer: z.string().trim().min(1).max(2000),
    }),
  )
  .min(1, "Tidak ada baris untuk diimpor")
  .max(MAX_IMPORT_ROWS, `Maksimal ${MAX_IMPORT_ROWS} baris sekali impor`);

/** Excel/CSV rows → Tanya-jawab. A question that already exists (same text) is skipped. */
export async function importFaqs(items: { question: string; answer: string }[]): Promise<{ added: number; skipped: number }> {
  const tenantId = await tenantSession();
  const parsed = faqImportSchema.safeParse(items);
  if (!parsed.success) throw userError(parsed.error.issues[0]?.message ?? "Data tidak valid");
  const key = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const result = await db.transaction(async (tx) => {
    const existing = await tx.select({ q: knowledgeFaqs.question }).from(knowledgeFaqs).where(eq(knowledgeFaqs.tenantId, tenantId));
    const seen = new Set(existing.map((r) => key(r.q)));
    const fresh = parsed.data.filter((r) => {
      const k = key(r.question);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (existing.length + fresh.length > MAX_FAQS) {
      throw userError(`Maksimal ${MAX_FAQS} tanya-jawab per workspace (sekarang ${existing.length})`);
    }
    if (fresh.length) await tx.insert(knowledgeFaqs).values(fresh.map((r) => ({ tenantId, question: r.question, answer: r.answer })));
    return { added: fresh.length, skipped: parsed.data.length - fresh.length };
  });
  revalidatePath("/flows");
  return result;
}
