import { notFound } from "next/navigation";
import { requirePageAbility } from "@/lib/session";
import { loadAgent, loadDocs, loadPromos } from "@/lib/automation-data";
import { AgentForm } from "@/components/app/ai-agent/agent-form";

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageAbility("knowledge.manage");
  if (!session.tenantId) notFound();
  const [agent, docs, promos] = await Promise.all([
    loadAgent(session.tenantId, id),
    loadDocs(session.tenantId),
    loadPromos(session.tenantId),
  ]);
  if (!agent) notFound();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, isDefault: _d, ...initial } = agent;
  return <AgentForm key={agent.id} agentId={agent.id} initial={initial} docs={docs} promos={promos} />;
}
