import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { TemplateForm } from "@/components/app/template-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewTemplatePage() {
  const session = await requirePageAbility("broadcast.manage");
  let waChannels: { id: string; name: string }[] = [];
  if (session.tenantId) {
    try {
      waChannels = await db.query.channels.findMany({
        where: and(
          eq(channels.tenantId, session.tenantId),
          eq(channels.type, "wa_official"),
          eq(channels.status, "connected"),
        ),
        columns: { id: true, name: true },
      });
    } catch {
      /* kosong */
    }
  }
  return <TemplateForm mode="create" waChannels={waChannels} />;
}
