import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { TagsTable, type TagRow } from "@/components/app/tags-table";
import { PageHeader } from "@/components/app/page-header";

async function load(tenantId: string | null): Promise<TagRow[]> {
  if (!tenantId) return [];
  try {
    const rows = await db.query.tags.findMany({
      where: and(eq(tags.tenantId, tenantId)),
      orderBy: [desc(tags.createdAt)],
      limit: 200,
    });
    return rows.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  } catch {
    return [];
  }
}

export default async function TagsPage() {
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        title="Tag & Label"
        description={`${rows.length} tag · segmentasi kontak untuk broadcast & filter inbox`}
        actions={
          <Link
            href="/tags/new"
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" /> Tag Baru
          </Link>
        }
      />
      <TagsTable rows={rows} />
    </div>
  );
}
