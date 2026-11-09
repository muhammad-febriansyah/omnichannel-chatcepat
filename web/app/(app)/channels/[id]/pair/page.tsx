import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { Pairing } from "./pairing";
import { requirePageAbility } from "@/lib/session";

export default async function PairChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageAbility("channel.connect");
  const { id } = await params;
  // Only this tenant's channels (the pair API checks too; this avoids an empty page).
  const own = session.tenantId
    ? await db.query.channels.findFirst({ where: and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)), columns: { id: true } })
    : null;
  if (!own) notFound();
  return <Pairing channelId={id} />;
}
