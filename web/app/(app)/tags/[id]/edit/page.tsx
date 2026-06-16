import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { TagForm } from "@/components/app/tag-form";

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();
  const t = await db.query.tags.findFirst({ where: and(eq(tags.id, id), eq(tags.tenantId, session.tenantId)) });
  if (!t) notFound();
  return <TagForm mode="edit" tagId={t.id} initial={{ name: t.name, color: t.color ?? "" }} />;
}
