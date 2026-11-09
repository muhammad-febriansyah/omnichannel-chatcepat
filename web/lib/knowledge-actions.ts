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
