import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { listApiCoTemplates } from "@/lib/apico-server";
import { ComposeForm, type ComposeChannel, type ComposeTemplate } from "@/components/app/compose-form";

export default async function NewMessagePage() {
  const session = await requirePageAbility("conversation.takeover");
  let chans: ComposeChannel[] = [];
  let tmpls: ComposeTemplate[] = [];
  if (session.tenantId) {
    try {
      const rows = await db.query.channels.findMany({
        where: and(eq(channels.tenantId, session.tenantId), eq(channels.status, "connected")),
        columns: { id: true, name: true, type: true, status: true },
      });
      chans = rows.map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status }));
      // Template HSM APPROVED (live api.co.id) untuk pesan pertama WA official.
      const wa = await listApiCoTemplates({ status: "APPROVED" });
      tmpls = wa.map((t) => ({ name: t.name, body: t.body, language: t.language }));
    } catch {
      /* kosong */
    }
  }
  return <ComposeForm channels={chans} templates={tmpls} />;
}
