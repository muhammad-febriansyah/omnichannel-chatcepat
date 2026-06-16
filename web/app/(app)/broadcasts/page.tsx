import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { BroadcastsTable, type BroadcastRow } from "@/components/app/broadcasts-table";

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
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broadcast</h1>
          <p className="text-sm text-muted-foreground">{rows.length} broadcast</p>
        </div>
        <Link
          href="/broadcasts/new"
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="size-4" /> Broadcast Baru
        </Link>
      </div>

      <BroadcastsTable rows={rows} />
    </div>
  );
}
