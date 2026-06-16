import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Send } from "lucide-react";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { cleanIDR } from "@/lib/format";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-50 text-blue-700",
  running: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.broadcasts.findMany({
      where: eq(broadcasts.tenantId, tenantId),
      orderBy: [desc(broadcasts.createdAt)],
      limit: 50,
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

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
            <Send className="size-6" />
          </div>
          <p className="mt-3 text-sm font-medium">Belum ada broadcast</p>
          <Link href="/broadcasts/new" className="mt-1 text-xs font-medium text-brand-blue">
            Buat broadcast pertama
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Terkirim</th>
                <th className="px-4 py-3 font-medium">Skip Opt-out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const stats = (b.stats ?? {}) as Record<string, number>;
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[b.status] ?? "bg-slate-100"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cleanIDR(stats.sent ?? 0)} / {cleanIDR(stats.total ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cleanIDR(stats.skipped_optout ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
