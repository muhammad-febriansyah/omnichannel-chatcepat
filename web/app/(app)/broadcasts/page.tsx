import { desc, eq } from "drizzle-orm";
import { Plus, Send } from "lucide-react";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { BroadcastsTable, type BroadcastRow } from "@/components/app/broadcasts-table";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";
import { Card, CardContent } from "@/components/ui/card";

async function load(tenantId: string | null): Promise<BroadcastRow[]> {
  if (!tenantId) return [];
  try {
    const rows = await db.query.broadcasts.findMany({
      where: eq(broadcasts.tenantId, tenantId),
      orderBy: [desc(broadcasts.createdAt)],
      limit: 200,
    });
    return rows.map((b) => {
      const stats = (b.stats ?? {}) as Record<string, number>;
      return {
        id: b.id,
        name: b.name,
        status: b.status,
        sent: stats.sent ?? 0,
        total: stats.total ?? 0,
        skipped: stats.skipped_optout ?? 0,
      };
    });
  } catch {
    return [];
  }
}

export default async function BroadcastsPage() {
  const session = await requirePageAbility("broadcast.manage");
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        icon={Send}
        title="Broadcast"
        description={`${rows.length} broadcast`}
        actions={
          <ActionLink href="/broadcasts/new">
            <Plus className="size-4" /> Broadcast Baru
          </ActionLink>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <BroadcastsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
