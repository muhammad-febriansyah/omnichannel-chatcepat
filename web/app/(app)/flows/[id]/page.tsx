import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { channels, flows, tags as tagsTable } from "@/lib/db/schema";
import { triggerInfo } from "@/lib/flow-conflicts";
import { listWaTemplates } from "@/lib/wa-templates";
import type { BroadcastTemplateOpt } from "@/lib/broadcast-flow";
import { loadAgents, loadDocs, loadPromos } from "@/lib/automation-data";
import { allowedFlowNodes } from "@/lib/entitlements";
import { requirePageAbility } from "@/lib/session";
import { FlowBuilder } from "@/components/app/flow-builder/flow-builder";

// Approved WA Official templates for the "Pesan Broadcast" step (live from Meta).
async function loadTemplates(tenantId: string): Promise<BroadcastTemplateOpt[]> {
  try {
    const { templates } = await listWaTemplates(tenantId, { status: "APPROVED" });
    return templates.map((r) => ({
      name: r.name,
      body: r.body,
      language: r.language,
      channelId: r.channelId,
      variableCount: r.variableCount,
      headerFormat: r.headerFormat,
      headerText: r.headerText,
      footer: r.footer,
      buttons: r.buttons.map((b) => ({ type: b.type, text: b.text })),
    }));
  } catch {
    return [];
  }
}

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageAbility("flow.manage");
  if (!session.tenantId) notFound();
  const flow = await db.query.flows.findFirst({
    where: and(eq(flows.id, id), eq(flows.tenantId, session.tenantId)),
  });
  if (!flow) notFound();
  const tenantId = session.tenantId;
  const [docs, promos, accounts, allowedNodes, tagRows, templates, agents, activeFlows] = await Promise.all([
    loadDocs(session.tenantId),
    loadPromos(session.tenantId),
    db.query.channels.findMany({
      where: eq(channels.tenantId, session.tenantId),
      columns: { id: true, name: true, type: true, autoReplyEnabled: true },
    }),
    allowedFlowNodes(session),
    db.query.tags.findMany({ where: eq(tagsTable.tenantId, tenantId), columns: { name: true } }),
    loadTemplates(tenantId),
    loadAgents(tenantId),
    db.query.flows.findMany({
      where: and(eq(flows.tenantId, tenantId), eq(flows.status, "active")),
      columns: { id: true, name: true, trigger: true, definition: true },
    }),
  ]);
  const otherFlows = activeFlows.filter((f) => f.id !== flow.id).map(triggerInfo);

  return (
    <FlowBuilder
      id={flow.id}
      name={flow.name}
      status={flow.status as "draft" | "active"}
      definition={flow.definition ?? { nodes: [] }}
      docs={docs}
      promos={promos}
      allowedNodes={allowedNodes}
      channels={accounts.map((c) => ({ id: c.id, name: c.name, type: c.type, autoReply: c.autoReplyEnabled }))}
      agents={agents.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive, isDefault: a.isDefault }))}
      otherFlows={otherFlows}
      tags={tagRows.map((t) => t.name)}
      templates={templates}
    />
  );
}
