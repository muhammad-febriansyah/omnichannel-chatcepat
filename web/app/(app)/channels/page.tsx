import { desc, eq } from "drizzle-orm";
import { Plus, Plug, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { CHANNEL_META, ChannelType, statusLabel } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActionLink } from "@/components/app/action-link";
import { ChannelIcon } from "@/components/app/channel-icon";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { Suspense } from "react";
import { ConnectToast } from "./connect-toast";

const STATUS_TONE: Record<string, PillTone> = {
  connected: "emerald",
  pending: "amber",
  disconnected: "red",
  banned: "red",
};

const DOT_CLS: Record<string, string> = {
  connected: "bg-emerald-500",
  pending: "bg-amber-500",
  disconnected: "bg-red-500",
  banned: "bg-red-500",
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
  const session = await requirePageAbility("channel.view");
  const rows = await load(session.tenantId);

  const connected = rows.filter((c) => c.status === "connected").length;

  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>
      <PageHeader
        icon={Plug}
        title="Channel"
        description={rows.length ? `${rows.length} channel · ${connected} terhubung` : "WhatsApp, Telegram, IG, FB"}
        actions={
          <ActionLink href="/channels/connect">
            <Plus className="size-4" /> Hubungkan Channel
          </ActionLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="Belum ada channel"
          description="Hubungkan WhatsApp, Telegram, atau channel lain untuk mulai menerima pesan."
          action={
            <ActionLink href="/channels/connect">
              <Plus className="size-4" /> Hubungkan channel pertama
            </ActionLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const meta = CHANNEL_META[c.type as ChannelType];
            const tone = STATUS_TONE[c.status] ?? "slate";
            const dot = DOT_CLS[c.status] ?? "bg-slate-400";
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ background: meta?.color ?? "#94a3b8" }}
                  >
                    <ChannelIcon type={c.type as ChannelType} className="size-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{meta?.label}</div>
                  </div>
                  <StatusPill tone={tone} className="shrink-0 gap-1.5">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {statusLabel(c.status)}
                  </StatusPill>
                </div>
                {c.type === "wa_unofficial" && c.status !== "connected" && (
                  <div className="flex justify-end">
                    <ActionLink
                      href={`/channels/${c.id}/pair`}
                      variant="outline"
                      size="icon-lg"
                      aria-label="Scan QR untuk pairing"
                      title="Scan QR untuk pairing"
                    >
                      <QrCode className="size-4" />
                    </ActionLink>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
