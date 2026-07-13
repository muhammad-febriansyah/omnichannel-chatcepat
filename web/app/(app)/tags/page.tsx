import { and, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { TagsTable, type TagRow } from "@/components/app/tags-table";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";
import { Card, CardContent } from "@/components/ui/card";

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
  const session = await requirePageAbility("contact.manage");
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        title="Tag & Label"
        description={`${rows.length} tag · segmentasi kontak untuk broadcast & filter inbox`}
        actions={
          <ActionLink href="/tags/new">
            <Plus className="size-4" /> Tag Baru
          </ActionLink>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <TagsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
