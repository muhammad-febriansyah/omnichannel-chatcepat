import { and, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  Tag,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Bot,
  MessageSquare,
  Check,
  CheckCheck,
  CircleAlert,
  PanelRight,
} from "lucide-react";
import { Message, MessageContent, MessageGroup } from "@/components/ui/message";
import { ChatScroll } from "@/components/app/chat-scroll";
import { MessageMedia } from "@/components/app/message-media";
import { ChannelBadge } from "@/components/app/channel-icon";
import { Composer } from "@/components/app/composer";
import { ConversationActions } from "@/components/app/conversation-actions";
import { getConversation, getThread } from "@/lib/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { CHANNEL_META, ChannelType, clock, dayKey, dayLabel, initials, statusLabel } from "@/lib/format";
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

// Indikator status kirim pesan keluar (queued→sent→delivered→read, atau failed).
function MessageStatus({ status }: { status: string }) {
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-0.5 text-danger">
        <CircleAlert className="size-3" /> Gagal
      </span>
    );
  if (status === "read") return <CheckCheck className="size-3.5 text-[#53bdeb]" />;
  if (status === "delivered") return <CheckCheck className="size-3.5 text-[#667781]" />;
  if (status === "sent") return <Check className="size-3.5 text-[#667781]" />;
  return <Clock className="size-3 text-[#667781]" />; // queued
}

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ profil?: string }>;
}) {
  const { conversationId } = await params;
  const showProfile = (await searchParams).profil === "1";
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
        where: and(eq(users.tenantId, session.tenantId), eq(users.status, "active"), ne(users.role, "admin")),
        columns: { id: true, name: true },
        limit: 100,
      });
      agents = rows.map((u) => ({ id: u.id, name: u.name }));
    } catch {
      /* abaikan */
    }
  }

  const sw = channelType === "wa_official" ? serviceWindow(conv.serviceWindowExpiresAt) : null;

  // Kelompokkan pesan per hari (WIB) untuk pemisah tanggal.
  type Msg = (typeof thread)[number];
  const groups: { day: string; label: string; items: Msg[] }[] = [];
  for (const m of thread) {
    const k = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === k) last.items.push(m);
    else groups.push({ day: k, label: dayLabel(m.createdAt), items: [m] });
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header: identitas kontak */}
        <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-5">
          <Link
            href="/inbox"
            aria-label="Kembali ke daftar"
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="relative shrink-0">
            <div
              className="flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: meta?.color ?? "#94a3b8" }}
            >
              {initials(name)}
            </div>
            <ChannelBadge type={channelType} size="sm" className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
          </div>
          <div className="min-w-0 flex-1">
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
              {conv.channel?.name ? `${conv.channel.name} · ` : ""}
              {meta?.label} · {statusLabel(conv.status)}
              {conv.handler === "agent" && " · ditangani agen"}
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <ConversationActions
              conversationId={conversationId}
              status={conv.status}
              handler={conv.handler}
              canAssign={canAssign}
              agents={agents}
            />
          </div>
          <Link
            href={showProfile ? `/inbox/${conversationId}` : `/inbox/${conversationId}?profil=1`}
            scroll={false}
            aria-pressed={showProfile}
            title={showProfile ? "Sembunyikan profil kontak" : "Lihat profil kontak"}
            className={cn(
              "hidden size-9 place-items-center rounded-lg transition-colors lg:grid",
              showProfile ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <PanelRight className="size-[18px]" />
          </Link>
        </div>

        {/* messages — WhatsApp-style wallpaper + shadcn Message components */}
        <ChatScroll count={thread.length} className="wa-wallpaper px-4 py-4 sm:px-[6%]">
          {thread.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-[#667781]">
              <MessageSquare className="size-8 opacity-40" />
              Belum ada pesan
            </div>
          ) : (
            groups.map((g) => (
              <MessageGroup key={g.day} className="gap-1">
                <div className="pointer-events-none sticky top-0 z-10 flex justify-center py-2">
                  <span className="rounded-lg bg-white px-3 py-1 text-[11.5px] font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                    {g.label}
                  </span>
                </div>
                {g.items.map((m, i) => {
                  const out = m.direction === "outbound";
                  const prev = g.items[i - 1];
                  const firstOfRun = !prev || prev.direction !== m.direction;
                  return (
                    <Message key={m.id} align={out ? "end" : "start"} className={cn(firstOfRun && i > 0 && "mt-2")}>
                      <MessageContent className="max-w-[85%] sm:max-w-[70%] lg:max-w-[62%]">
                        <div
                          className={cn(
                            "relative w-fit rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:text-[#e9edef]",
                            out ? "bg-[#d9fdd3] dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]",
                            firstOfRun && (out ? "rounded-tr-none" : "rounded-tl-none"),
                          )}
                        >
                          {m.sender === "bot" && (
                            <div className="mb-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#027eb5] dark:text-[#53bdeb]">
                              <Bot className="size-3.5" /> AI Agent
                            </div>
                          )}
                          {m.sender === "agent" && out && (
                            <div className="mb-0.5 text-[11.5px] font-semibold text-[#06cf9c]">Agen</div>
                          )}
                          <MessageMedia media={m.media as Record<string, unknown> | null} outbound={out} />
                          {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                          {/* spacer keeps the last line clear of the time stamp */}
                          <span className="inline-block w-[64px]" aria-hidden />
                          <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] tabular-nums text-[#667781] dark:text-[#8696a0]">
                            {clock(m.createdAt)}
                            {out && <MessageStatus status={m.status} />}
                          </span>
                        </div>
                      </MessageContent>
                    </Message>
                  );
                })}
              </MessageGroup>
            ))
          )}
        </ChatScroll>

        <Composer
          conversationId={conversationId}
          blockedReason={
            channelType === "wa_official" && sw?.expired
              ? "WhatsApp resmi: window 24 jam habis, balasan teks bebas akan ditolak."
              : undefined
          }
        />
      </div>

      {/* contact panel */}
      {showProfile && (
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
      )}
    </div>
  );
}
