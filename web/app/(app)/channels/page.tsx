import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Plug, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { CHANNEL_META, ChannelType, statusLabel } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

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
      <PageHeader
        title="Channel"
        description={`${rows.length} channel terhubung`}
        actions={
          <>
            <Link
              href="/channels/connect"
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="size-4" /> Hubungkan Channel
            </Link>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="Belum ada channel"
          description="Hubungkan WhatsApp, Telegram, atau channel lain untuk mulai menerima pesan."
          action={
            <Link href="/channels/connect" className="text-xs font-medium text-brand-blue">
              Hubungkan channel pertama
            </Link>
          }
        />
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
                {c.type === "wa_unofficial" && c.status !== "connected" && (
                  <Link
                    href={`/channels/${c.id}/pair`}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-brand-blue hover:bg-slate-50"
                  >
                    <QrCode className="size-3.5" /> Scan QR untuk pairing
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
