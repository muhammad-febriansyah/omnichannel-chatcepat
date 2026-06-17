import { and, desc, eq } from "drizzle-orm";
import { Plus, Upload, Link2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { ContactsTable, type ContactRow } from "@/components/app/contacts-table";
import { PageHeader } from "@/components/app/page-header";

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
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        title="Kontak"
        description={`${rows.length} kontak`}
        actions={
          <>
            <Link
              href="/contacts/acquire"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Link2 className="size-4" /> Akuisisi
            </Link>
            <Link
              href="/contacts/import"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Upload className="size-4" /> Import
            </Link>
            <Link
              href="/contacts/new"
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="size-4" /> Kontak Baru
            </Link>
          </>
        }
      />

      <ContactsTable rows={rows} />
    </div>
  );
}
