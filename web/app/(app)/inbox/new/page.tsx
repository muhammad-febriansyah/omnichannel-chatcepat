import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, templates } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
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
      // Template HSM approved untuk pesan pertama WA official.
      const t = await db.query.templates.findMany({
        where: and(
          eq(templates.tenantId, session.tenantId),
          eq(templates.kind, "hsm"),
          eq(templates.status, "approved"),
        ),
        columns: { name: true, body: true, language: true },
      });
      tmpls = t.map((r) => ({ name: r.name, body: r.body, language: r.language ?? "id" }));
    } catch {
      /* kosong */
    }
  }
  return <ComposeForm channels={chans} templates={tmpls} />;
}
