import { ConversationList, ConvItem } from "@/components/app/conversation-list";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { getConversations } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const rows = await getConversations(session);
  const items: ConvItem[] = rows.map((c) => ({
    id: c.id,
    name: c.contact?.name ?? c.contact?.phone ?? "Tanpa Nama",
    channelType: c.channel?.type ?? "wa_official",
    preview: c.lastMessagePreview,
    lastAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    unread: c.unreadCount ?? 0,
    status: c.status,
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {session.tenantId && <RealtimeRefresher tenantId={session.tenantId} token="dev" />}
      <ConversationList items={items} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
