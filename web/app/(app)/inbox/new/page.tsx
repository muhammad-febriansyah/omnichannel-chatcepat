import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { listWaTemplates } from "@/lib/wa-templates";
import { ComposeForm, type ComposeChannel, type ComposeTemplate } from "@/components/app/compose-form";

export default async function NewMessagePage() {
  const session = await requirePageAbility("conversation.takeover");
  let chans: ComposeChannel[] = [];
  let tmpls: ComposeTemplate[] = [];
  if (session.tenantId) {
    try {
      const rows = await db.query.channels.findMany({
        where: and(eq(channels.tenantId, session.tenantId), eq(channels.status, "connected"), inArray(channels.type, ["wa_official", "wa_unofficial"])),
        columns: { id: true, name: true, type: true, status: true },
      });
      chans = rows.map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status }));
      // Template HSM APPROVED (live dari Meta, per WABA) untuk pesan pertama WA official.
      // Template ber-variabel belum bisa dikirim (parameter belum didukung) → disembunyikan.
      const { templates: wa } = await listWaTemplates(session.tenantId, { status: "APPROVED" });
      tmpls = wa
        .filter((t) => t.variableCount === 0)
        .map((t) => ({ name: t.name, body: t.body, language: t.language, channelId: t.channelId }));
    } catch {
      /* kosong */
    }
  }
  return <ComposeForm channels={chans} templates={tmpls} />;
}
