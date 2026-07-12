import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, knowledgeDocuments, tenants } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { aiAgentStatus } from "@/lib/actions";
import { AiAgentPanel } from "@/components/app/ai-agent-panel";

export default async function AiAgentPage() {
  const session = await requirePageAbility("knowledge.manage");
  let persona = "";
  let docs: { id: string; title: string; status: string; sourceType: string }[] = [];
  let chans: { id: string; name: string; type: string; status: string; autoReplyEnabled: boolean }[] = [];
  let aiEnabled = false;
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      persona = ((t?.settings as Record<string, string>)?.ai_persona as string) ?? "";
      docs = await db.query.knowledgeDocuments.findMany({
        where: eq(knowledgeDocuments.tenantId, session.tenantId),
        orderBy: [desc(knowledgeDocuments.createdAt)],
        columns: { id: true, title: true, status: true, sourceType: true },
      });
      chans = await db.query.channels.findMany({
        where: eq(channels.tenantId, session.tenantId),
        orderBy: [desc(channels.createdAt)],
        columns: { id: true, name: true, type: true, status: true, autoReplyEnabled: true },
      });
      aiEnabled = await aiAgentStatus();
    } catch {
      /* kosong */
    }
  }
  return <AiAgentPanel persona={persona} docs={docs} channels={chans} aiEnabled={aiEnabled} />;
}
