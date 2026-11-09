import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeFaqs } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { FaqForm } from "@/components/app/knowledge/faq-form";

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageAbility("knowledge.manage");
  const { id } = await params;
  if (!session.tenantId || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const faq = await db.query.knowledgeFaqs.findFirst({
    where: and(eq(knowledgeFaqs.id, id), eq(knowledgeFaqs.tenantId, session.tenantId)),
    columns: { id: true, question: true, answer: true, isActive: true },
  });
  if (!faq) notFound();
  return <FaqForm faqId={faq.id} initial={{ question: faq.question, answer: faq.answer, isActive: faq.isActive }} />;
}
