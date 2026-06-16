import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Plug } from "lucide-react";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { CHANNEL_META, ChannelType, statusLabel } from "@/lib/format";

const STATUS_CLS: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  disconnected: "bg-red-50 text-red-700",
  banned: "bg-red-50 text-red-700",
};

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.channels.findMany({
      where: eq(channels.tenantId, tenantId),
      orderBy: [desc(channels.createdAt)],
    });
  } catch {
    return [];
  }
}

export default async function ChannelsPage() {
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channel</h1>
          <p className="text-sm text-muted-foreground">{rows.length} channel terhubung</p>
        </div>
        <Link
          href="/channels/connect"
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="size-4" /> Hubungkan Channel
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
            <Plug className="size-6" />
          </div>
          <p className="mt-3 text-sm font-medium">Belum ada channel</p>
          <Link href="/channels/connect" className="mt-1 text-xs font-medium text-brand-blue">
            Hubungkan channel pertama
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const meta = CHANNEL_META[c.type as ChannelType];
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ background: meta?.color ?? "#94a3b8" }}
                  >
                    {meta?.short}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{meta?.label}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[c.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {statusLabel(c.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
