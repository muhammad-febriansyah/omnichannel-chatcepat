import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, tags as tagsTable } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { BroadcastWizard } from "@/components/app/broadcast-wizard";

export default async function NewBroadcastPage() {
  const session = await requireSession();
  let chans: { id: string; name: string; type: string }[] = [];
  let tagNames: string[] = [];
  if (session.tenantId) {
    try {
      chans = await db.query.channels.findMany({
        where: eq(channels.tenantId, session.tenantId),
        columns: { id: true, name: true, type: true },
      });
      const t = await db.query.tags.findMany({
        where: eq(tagsTable.tenantId, session.tenantId),
        columns: { name: true },
      });
      tagNames = t.map((x) => x.name);
    } catch {
      /* kosong */
    }
  }
  return <BroadcastWizard channels={chans} tags={tagNames} />;
}
