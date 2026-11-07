import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { flows } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { FlowBuilder } from "@/components/app/flow-builder/flow-builder";

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageAbility("flow.manage");
  if (!session.tenantId) notFound();
  const flow = await db.query.flows.findFirst({
    where: and(eq(flows.id, id), eq(flows.tenantId, session.tenantId)),
  });
  if (!flow) notFound();

  return (
    <FlowBuilder
      id={flow.id}
      name={flow.name}
      status={flow.status as "draft" | "active"}
      definition={flow.definition ?? { nodes: [] }}
    />
  );
}
