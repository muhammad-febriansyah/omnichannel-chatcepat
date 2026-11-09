import { desc, eq } from "drizzle-orm";
import { Plus, Plug, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { CHANNEL_META, ChannelType, statusLabel, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActionLink } from "@/components/app/action-link";
import { ChannelIcon } from "@/components/app/channel-icon";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/app/delete-button";
import { ChannelAutomationSettings } from "@/components/app/channel-automation-settings";
import { disconnectChannel, type FallbackAction } from "@/lib/actions";
import { loadAgents } from "@/lib/automation-data";
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
  const agents = session.tenantId ? await loadAgents(session.tenantId) : [];

  const connected = rows.filter((c) => c.status === "connected").length;

  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>
      <PageHeader
        icon={Plug}
        title="Channel"
        description={
          rows.length
            ? `${rows.length} channel · ${connected} terhubung`
            : "WhatsApp, Telegram, Facebook, atau Instagram"
        }
        actions={
          <ActionLink href="/channels/connect">
            <Plus className="size-4" /> Hubungkan Channel
          </ActionLink>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Plug}
              title="Belum ada channel"
              description="Hubungkan WhatsApp, Telegram, Facebook, atau Instagram untuk mulai menerima pesan."
              action={
                <ActionLink href="/channels/connect">
                  <Plus className="size-4" /> Hubungkan channel pertama
                </ActionLink>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => {
            const meta = CHANNEL_META[c.type as ChannelType];
            const tone = STATUS_TONE[c.status] ?? "slate";
            const dot = DOT_CLS[c.status] ?? "bg-slate-400";
            const needsPairing = c.type === "wa_unofficial" && c.status !== "connected";
            return (
              <div
                key={c.id}
                className="flex flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Identity */}
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                    style={{ background: meta?.color ?? "#94a3b8" }}
                  >
                    <ChannelIcon type={c.type as ChannelType} className="size-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-foreground">{c.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {meta?.label} · ditambahkan {timeAgo(c.createdAt)}
                      {timeAgo(c.createdAt) === "baru saja" ? "" : " lalu"}
                    </div>
                  </div>
                  <StatusPill tone={tone} className="shrink-0 gap-1.5">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {statusLabel(c.status)}
                  </StatusPill>
                </div>

                {/* Automation */}
                <div className="border-t border-border px-4 py-3.5">
                  <ChannelAutomationSettings
                    channelId={c.id}
                    type={c.type}
                    enabled={c.autoReplyEnabled}
                    agentId={c.aiAgentId}
                    agents={agents}
                    fallbackAction={c.fallbackAction as FallbackAction}
                    fallbackMessage={c.fallbackMessage}
                  />
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
                  {needsPairing ? (
                    <ActionLink
                      href={`/channels/${c.id}/pair`}
                      variant="outline"
                      size="sm"
                      aria-label="Scan QR untuk pairing"
                      title="Scan QR untuk pairing"
                    >
                      <QrCode className="size-4" /> Scan QR
                    </ActionLink>
                  ) : (
                    <span className="text-[11.5px] text-muted-foreground">
                      {c.status === "connected" ? "Siap menerima & mengirim pesan" : "Perlu dihubungkan ulang"}
                    </span>
                  )}
                  <DeleteButton
                    onConfirm={async () => {
                      "use server";
                      await disconnectChannel(c.id);
                    }}
                    title="Putuskan channel?"
                    description={
                      <>
                        Channel <span className="font-semibold">{c.name}</span> akan diputus. Pesan masuk berhenti dan
                        kredensial dihapus. Hubungkan ulang untuk mengaktifkan lagi.
                      </>
                    }
                    successMessage="Channel diputus"
                    triggerLabel="Putuskan"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
