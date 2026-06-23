import { and, desc, eq } from "drizzle-orm";
import { Plus, Upload, Link2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { ContactsTable, type ContactRow } from "@/components/app/contacts-table";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";

async function load(tenantId: string | null): Promise<ContactRow[]> {
  if (!tenantId) return [];
  try {
    const rows = await db.query.contacts.findMany({
      where: and(eq(contacts.tenantId, tenantId)),
      orderBy: [desc(contacts.createdAt)],
      limit: 200,
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      optInStatus: c.optInStatus,
      optInSource: c.optInSource,
      tags: (Array.isArray(c.tags) ? c.tags : []).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

export default async function ContactsPage() {
  const session = await requirePageAbility("contact.view");
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        icon={Users}
        title="Kontak"
        description={`${rows.length} kontak`}
        actions={
          <>
            <ActionLink href="/contacts/acquire" variant="outline">
              <Link2 className="size-4" /> Akuisisi
            </ActionLink>
            <ActionLink href="/contacts/import" variant="outline">
              <Upload className="size-4" /> Import
            </ActionLink>
            <ActionLink href="/contacts/new">
              <Plus className="size-4" /> Kontak Baru
            </ActionLink>
          </>
        }
      />

      <ContactsTable rows={rows} />
    </div>
  );
}
