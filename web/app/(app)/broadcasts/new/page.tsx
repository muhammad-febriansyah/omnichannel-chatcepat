import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, tags as tagsTable } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { listApiCoTemplates } from "@/lib/apico-server";
import { BroadcastWizard, type TemplateOpt } from "@/components/app/broadcast-wizard";

export default async function NewBroadcastPage() {
  const session = await requirePageAbility("broadcast.manage");
  let chans: { id: string; name: string; type: string }[] = [];
  let tagNames: string[] = [];
  let tmpls: TemplateOpt[] = [];
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
      // Hanya HSM APPROVED (live api.co.id) yang boleh dipakai broadcast WA official.
      const rows = await listApiCoTemplates({ status: "APPROVED" });
      tmpls = rows.map((r) => ({ name: r.name, body: r.body, language: r.language }));
    } catch {
      /* kosong */
    }
  }
  return <BroadcastWizard channels={chans} tags={tagNames} templates={tmpls} />;
}
