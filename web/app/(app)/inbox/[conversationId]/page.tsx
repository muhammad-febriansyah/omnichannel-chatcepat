import { and, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Tag, ShieldCheck, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import { Composer } from "@/components/app/composer";
import { ConversationActions } from "@/components/app/conversation-actions";
import { getConversation, getThread } from "@/lib/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { CHANNEL_META, ChannelType, initials, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Sisa service window (24 jam WA official sejak pesan masuk terakhir).
function serviceWindow(expiresAt: string | null): { expired: boolean; text: string } {
  if (!expiresAt) return { expired: true, text: "Lewat 24 jam · perlu template" };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { expired: true, text: "Lewat 24 jam · perlu template" };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { expired: false, text: `Window ${h}j ${m}m` };
}

export default async function ThreadPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const conv = await getConversation(session, conversationId);
  if (!conv) notFound();
  const thread = await getThread(session, conversationId);
  const channelType = (conv.channel?.type ?? "wa_official") as ChannelType;
  const meta = CHANNEL_META[channelType];
  const name = conv.contact?.name ?? conv.contact?.phone ?? "Tanpa Nama";

  const canAssign = can(session, "conversation.assign");
  let agents: { id: string; name: string }[] = [];
  if (canAssign && session.tenantId) {
    try {
      const rows = await db.query.users.findMany({
        where: and(eq(users.tenantId, session.tenantId), eq(users.status, "active"), ne(users.role, "super_admin")),
        columns: { id: true, name: true },
        limit: 100,
      });
      agents = rows.map((u) => ({ id: u.id, name: u.name }));
    } catch {
      /* abaikan */
    }
  }

  const sw = channelType === "wa_official" ? serviceWindow(conv.serviceWindowExpiresAt) : null;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-5">
          <Link
            href="/inbox"
            aria-label="Kembali ke daftar"
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div
            className="flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: meta?.color ?? "#94a3b8" }}
          >
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{name}</span>
              {sw && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    sw.expired ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
                  )}
                  title="Service window WhatsApp 24 jam"
                >
                  {sw.expired ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
                  {sw.text}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {meta?.label} · {statusLabel(conv.status)}
              {conv.handler === "agent" && " · ditangani agen"}
            </div>
          </div>

          <div className="ml-auto">
            <ConversationActions
              conversationId={conversationId}
              status={conv.status}
              handler={conv.handler}
              canAssign={canAssign}
              agents={agents}
            />
          </div>
        </div>

        {/* messages */}
        <div className="flex-1 space-y-2 overflow-y-auto bg-background p-5">
          {thread.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">Belum ada pesan</div>
          )}
          {thread.map((m) => {
            const out = m.direction === "outbound";
            return (
              <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    out
                      ? "bg-gradient-to-br from-brand-blue to-brand-light text-white"
                      : "border border-border bg-card",
                  )}
                >
                  {m.sender === "bot" && (
                    <div className={cn("mb-0.5 text-[10px] font-semibold", out ? "text-white/80" : "text-brand-blue")}>
                      AI Agent
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <Composer conversationId={conversationId} />
      </div>

      {/* contact panel */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card p-5 lg:flex">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex size-16 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ background: meta?.color ?? "#94a3b8" }}
          >
            {initials(name)}
          </div>
          <div className="mt-2 text-sm font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground">{meta?.label}</div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          {conv.contact?.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" /> {conv.contact.phone}
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4" /> Opt-in: {conv.contact?.optInStatus ?? "unknown"}
          </div>
          {Array.isArray(conv.contact?.tags) && conv.contact.tags.length > 0 && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Tag className="size-4" />
              <div className="flex flex-wrap gap-1">
                {conv.contact.tags.map((t: string) => (
                  <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
