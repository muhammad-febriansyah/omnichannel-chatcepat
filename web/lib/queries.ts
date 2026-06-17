import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { canViewAllConversations } from "./rbac";
import type { Session } from "./session";

// Inbox list — eager contact + channel (zero N+1). Scope agent → assigned saja (03).
export async function getConversations(session: Session) {
  if (!session.tenantId) return [];
  const filters = [eq(conversations.tenantId, session.tenantId)];
  if (!canViewAllConversations(session)) {
    filters.push(eq(conversations.assignedAgentId, session.id));
  }
  try {
    return await db.query.conversations.findMany({
      where: and(...filters),
      with: {
        contact: { columns: { id: true, name: true, phone: true } },
        channel: { columns: { id: true, type: true, name: true } },
      },
      orderBy: [desc(conversations.lastMessageAt)],
      limit: 50,
    });
  } catch {
    return [];
  }
}

export async function getConversation(session: Session, conversationId: string) {
  if (!session.tenantId) return null;
  try {
    return await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, session.tenantId),
      ),
      with: {
        contact: true,
        channel: { columns: { id: true, type: true, name: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function getThread(session: Session, conversationId: string) {
  if (!session.tenantId) return [];
  try {
    return await db.query.messages.findMany({
      where: and(
        eq(messages.conversationId, conversationId),
        eq(messages.tenantId, session.tenantId),
      ),
      orderBy: [asc(messages.createdAt)],
      limit: 200,
    });
  } catch {
    return [];
  }
}
