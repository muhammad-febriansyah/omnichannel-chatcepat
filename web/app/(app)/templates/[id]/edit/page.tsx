import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { TemplateForm } from "@/components/app/template-form";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();
  const t = await db.query.templates.findFirst({
    where: and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)),
  });
  if (!t) notFound();
  return (
    <TemplateForm
      mode="edit"
      templateId={t.id}
      initial={{
        name: t.name,
        kind: t.kind as "hsm" | "quick_reply",
        category: t.category ?? "",
        language: t.language ?? "",
        body: t.body,
      }}
    />
  );
}
