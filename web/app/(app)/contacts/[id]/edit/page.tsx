import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { ContactForm } from "@/components/app/contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();

  const c = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), eq(contacts.tenantId, session.tenantId)),
  });
  if (!c) notFound();

  return (
    <ContactForm
      mode="edit"
      contactId={c.id}
      initial={{
        name: c.name ?? "",
        phone: c.phone ?? "",
        optInStatus: c.optInStatus,
        tags: (Array.isArray(c.tags) ? c.tags : []).filter(Boolean),
      }}
    />
  );
}
