import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { RenameChannelForm } from "./rename-form";

export default async function EditChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageAbility("channel.connect");
  const { id } = await params;
  if (!session.tenantId || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)),
    columns: { id: true, name: true, type: true },
  });
  if (!channel) notFound();
  return <RenameChannelForm id={channel.id} name={channel.name} type={channel.type} />;
}
