import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, tags as tagsTable } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { listWaTemplates } from "@/lib/wa-templates";
import { BroadcastWizard, type TemplateOpt } from "@/components/app/broadcast-wizard";

export default async function NewBroadcastPage() {
  const session = await requirePageAbility("broadcast.manage");
  let chans: { id: string; name: string; type: string }[] = [];
  let tagNames: string[] = [];
  let tmpls: TemplateOpt[] = [];
  if (session.tenantId) {
    try {
      // Blast HANYA WhatsApp. Messenger/Instagram tak bisa broadcast (kebijakan Meta:
      // free-form cuma dalam window 24 jam, no cold blast) → jangan tampilkan di picker.
      chans = await db.query.channels.findMany({
        where: and(
          eq(channels.tenantId, session.tenantId),
          eq(channels.status, "connected"),
          inArray(channels.type, ["wa_official", "wa_unofficial"]),
        ),
        columns: { id: true, name: true, type: true },
      });
      const t = await db.query.tags.findMany({
        where: eq(tagsTable.tenantId, session.tenantId),
        columns: { name: true },
      });
      tagNames = t.map((x) => x.name);
      // Hanya HSM APPROVED (live dari Meta, per WABA) yang boleh dipakai broadcast WA official.
      const { templates: rows } = await listWaTemplates(session.tenantId, { status: "APPROVED" });
      tmpls = rows.map((r) => ({
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
      /* kosong */
    }
  }
  return <BroadcastWizard channels={chans} tags={tagNames} templates={tmpls} />;
}
