import { ConversationList, ConvItem } from "@/components/app/conversation-list";
import { InboxPanes } from "@/components/app/inbox-panes";
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
    <>
      {session.tenantId && <RealtimeRefresher tenantId={session.tenantId} token="dev" />}
      <InboxPanes list={<ConversationList items={items} />}>{children}</InboxPanes>
    </>
  );
}
