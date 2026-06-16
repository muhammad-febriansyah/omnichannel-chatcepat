"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CHANNEL_META, ChannelType, initials, timeAgo } from "@/lib/format";

export type ConvItem = {
  id: string;
  name: string;
  channelType: string;
  preview: string | null;
  lastAt: string | null;
  unread: number;
  status: string;
};

export function ConversationList({ items }: { items: ConvItem[] }) {
  const params = useParams<{ conversationId?: string }>();
  const active = params?.conversationId;

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-border bg-card lg:w-80">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-base font-semibold">Inbox</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Belum ada percakapan
          </div>
        ) : (
          items.map((c) => {
            const meta = CHANNEL_META[c.channelType as ChannelType];
            const isActive = active === c.id;
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className={cn(
                  "flex gap-3 border-b border-border px-4 py-3 transition-colors",
                  isActive ? "bg-blue-50" : "hover:bg-slate-50",
                )}
              >
                <div className="relative">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-gradient-to-br from-brand-navy to-brand-blue text-xs font-semibold text-white">
                      {initials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card"
                    style={{ background: meta?.color ?? "#94a3b8" }}
                    title={meta?.label}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(c.lastAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.preview ?? "—"}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-blue px-1.5 text-[10px] font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
