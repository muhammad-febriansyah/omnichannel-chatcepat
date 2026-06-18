import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeDocuments, tenants } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { AiAgentPanel } from "@/components/app/ai-agent-panel";

export default async function AiAgentPage() {
  const session = await requirePageAbility("knowledge.manage");
  let persona = "";
  let docs: { id: string; title: string; status: string; sourceType: string }[] = [];
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      persona = ((t?.settings as Record<string, string>)?.ai_persona as string) ?? "";
      docs = await db.query.knowledgeDocuments.findMany({
        where: eq(knowledgeDocuments.tenantId, session.tenantId),
        orderBy: [desc(knowledgeDocuments.createdAt)],
        columns: { id: true, title: true, status: true, sourceType: true },
      });
    } catch {
      /* kosong */
    }
  }
  return <AiAgentPanel persona={persona} docs={docs} />;
}
