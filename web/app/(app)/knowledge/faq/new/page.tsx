import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUnanswered } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { FaqForm } from "@/components/app/knowledge/faq-form";

// ?from=<unanswered id> prefills the customer's question (the id must be this tenant's).
export default async function NewFaqPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string }> }) {
  const session = await requirePageAbility("knowledge.manage");
  const { from } = await searchParams;
  let question = "";
  let fromId: string | null = null;
  if (session.tenantId && from && /^[0-9a-f-]{36}$/i.test(from)) {
    const row = await db.query.aiUnanswered.findFirst({
      where: and(eq(aiUnanswered.id, from), eq(aiUnanswered.tenantId, session.tenantId)),
      columns: { id: true, question: true },
    });
    if (row) {
      question = row.question;
      fromId = row.id;
    }
  }
  return <FaqForm faqId={null} initial={{ question, answer: "", isActive: true }} fromUnanswered={fromId} />;
}
