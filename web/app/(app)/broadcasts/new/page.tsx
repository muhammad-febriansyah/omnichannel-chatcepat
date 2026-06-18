import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, tags as tagsTable, templates } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
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
      // Hanya HSM approved yang boleh dipakai broadcast WA official.
      const rows = await db.query.templates.findMany({
        where: and(
          eq(templates.tenantId, session.tenantId),
          eq(templates.kind, "hsm"),
          eq(templates.status, "approved"),
        ),
        columns: { name: true, body: true, language: true },
      });
      tmpls = rows.map((r) => ({ name: r.name, body: r.body, language: r.language ?? "id" }));
    } catch {
      /* kosong */
    }
  }
  return <BroadcastWizard channels={chans} tags={tagNames} templates={tmpls} />;
}
