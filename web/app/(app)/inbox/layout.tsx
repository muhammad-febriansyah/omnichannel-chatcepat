import { ConversationList, ConvItem } from "@/components/app/conversation-list";
import { InboxPanes } from "@/components/app/inbox-panes";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { getConversations } from "@/lib/queries";
import { requireSession } from "@/lib/session";
import { realtimeToken } from "@/lib/realtime-token";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [rows, accounts] = await Promise.all([
    getConversations(session),
    session.tenantId
      ? db.query.channels.findMany({
          where: eq(channels.tenantId, session.tenantId),
          columns: { id: true, name: true, type: true },
          orderBy: [asc(channels.type), asc(channels.name)],
        })
      : Promise.resolve([]),
  ]);
  const items: ConvItem[] = rows.map((c) => ({
    id: c.id,
    name: c.contact?.name ?? c.contact?.phone ?? "Tanpa Nama",
    channelType: c.channel?.type ?? "wa_official",
    channelId: c.channel?.id ?? null,
    channelName: c.channel?.name ?? null,
    preview: c.lastMessagePreview,
    lastAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    unread: c.unreadCount ?? 0,
    status: c.status,
  }));

  return (
    <>
      {session.tenantId && <RealtimeRefresher tenantId={session.tenantId} token={realtimeToken(session.tenantId)} />}
      <InboxPanes list={<ConversationList items={items} accounts={accounts} />}>{children}</InboxPanes>
    </>
  );
}
