"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, Inbox as InboxIcon, ChevronDown } from "lucide-react";
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

// Label + warna status percakapan supaya agen langsung paham keadaannya.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Aktif", cls: "bg-blue-50 text-brand-blue dark:bg-blue-500/10 dark:text-blue-300" },
  pending: { label: "Menunggu", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  resolved: { label: "Selesai", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  snoozed: { label: "Snooze", cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
};

type Filter = "all" | "unread" | "read" | "active" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
  { key: "read", label: "Dibaca" },
  { key: "active", label: "Aktif" },
  { key: "done", label: "Selesai" },
];

// Filter channel: kelompokkan wa_official + wa_unofficial jadi satu "whatsapp".
type ChannelFilter = "all" | "whatsapp" | "instagram" | "facebook" | "telegram";
const CHANNEL_GROUP: Record<string, ChannelFilter> = {
  wa_official: "whatsapp",
  wa_unofficial: "whatsapp",
  instagram: "instagram",
  facebook: "facebook",
  telegram: "telegram",
};
const CHANNEL_FILTERS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "Semua Channel" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Messenger" },
  { key: "telegram", label: "Telegram" },
];

export function ConversationList({ items }: { items: ConvItem[] }) {
  const params = useParams<{ conversationId?: string }>();
  const active = params?.conversationId;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (channel !== "all" && CHANNEL_GROUP[c.channelType] !== channel) return false;
      if (filter === "unread" && c.unread <= 0) return false;
      if (filter === "read" && c.unread > 0) return false;
      if (filter === "active" && !(c.status === "open" || c.status === "pending")) return false;
      if (filter === "done" && c.status !== "resolved") return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.preview ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, filter, channel]);

  const unreadTotal = items.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="text-base font-semibold">Inbox</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {unreadTotal > 0 ? `${unreadTotal} belum dibaca` : `${items.length} percakapan`}
        </span>
      </div>

      {/* Filter channel */}
      <div className="px-3 pb-2">
        <div className="relative">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            aria-label="Filter channel"
            className="h-9 w-full appearance-none rounded-lg border border-border bg-background pl-2.5 pr-8 text-sm font-medium text-foreground outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          >
            {CHANNEL_FILTERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-muted-foreground transition focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau pesan…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            aria-label="Cari percakapan"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border-t border-border">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <InboxIcon className="size-7 text-muted-foreground/40" />
            {items.length === 0 ? "Belum ada percakapan masuk." : "Tidak ada percakapan yang cocok."}
          </div>
        ) : (
          filtered.map((c) => {
            const meta = CHANNEL_META[c.channelType as ChannelType];
            const isActive = active === c.id;
            const st = STATUS_META[c.status];
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className={cn(
                  "relative flex gap-3 border-b border-border px-4 py-3 transition-colors",
                  isActive
                    ? "bg-blue-50 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-brand-blue dark:bg-blue-500/10"
                    : "hover:bg-muted/50",
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
                    <span className={cn("truncate text-sm", c.unread > 0 ? "font-bold text-foreground" : "font-semibold")}>
                      {c.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cn("truncate text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {c.preview ?? "—"}
                    </span>
                    {c.unread > 0 && (
                      <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-brand-blue text-[10px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  {st && (
                    <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", st.cls)}>
                      {st.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
