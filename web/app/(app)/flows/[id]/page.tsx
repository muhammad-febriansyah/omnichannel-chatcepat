import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { flows } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { FlowEditor } from "@/components/app/flow-editor";

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();
  const flow = await db.query.flows.findFirst({
    where: and(eq(flows.id, id), eq(flows.tenantId, session.tenantId)),
  });
  if (!flow) notFound();

  return (
    <FlowEditor
      id={flow.id}
      name={flow.name}
      status={flow.status as "draft" | "active"}
      definition={(flow.definition as { nodes?: unknown[] }) ?? { nodes: [] }}
    />
  );
}
