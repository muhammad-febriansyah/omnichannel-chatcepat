import { errorMessage } from "@/lib/action-error";
import { and, desc, eq } from "drizzle-orm";
import { Plus, FileText, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { listWaTemplates, type WaTemplatesResult } from "@/lib/wa-templates";
import { PageHeader } from "@/components/app/page-header";
import { WaTemplatesTable, QuickRepliesTable } from "@/components/app/templates-tables";
import { EmptyState } from "@/components/app/empty-state";
import { ActionLink } from "@/components/app/action-link";
import { Card, CardContent } from "@/components/ui/card";

async function loadQuickReplies(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.templates.findMany({
      where: and(eq(templates.tenantId, tenantId), eq(templates.kind, "quick_reply")),
      orderBy: [desc(templates.createdAt)],
      limit: 200,
    });
  } catch {
    return [];
  }
}

async function loadWaTemplates(tenantId: string | null): Promise<WaTemplatesResult> {
  if (!tenantId) return { templates: [], errors: [] };
  try {
    return await listWaTemplates(tenantId);
  } catch (e) {
    return { templates: [], errors: [errorMessage(e) ?? "Gagal memuat template WhatsApp"] };
  }
}

export default async function TemplatesPage() {
  const session = await requirePageAbility("broadcast.manage");
  const [{ templates: waTemplates, errors: waErrors }, quickReplies] = await Promise.all([
    loadWaTemplates(session.tenantId),
    loadQuickReplies(session.tenantId),
  ]);

  const total = waTemplates.length + quickReplies.length;

  return (
    <div className="p-6">
      <PageHeader
        icon={FileText}
        title="Template Pesan"
        description={`${waTemplates.length} template WhatsApp · ${quickReplies.length} balasan cepat`}
        actions={
          <ActionLink href="/templates/new">
            <Plus className="size-4" /> Template Baru
          </ActionLink>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {total === 0 && waErrors.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title="Belum ada template"
              description="Buat balasan cepat untuk membantu agen menjawab pelanggan."
              action={
                <ActionLink href="/templates/new">
                  <Plus className="size-4" /> Buat template pertama
                </ActionLink>
              }
            />
          ) : (
            <div className="space-y-6">
              {/* WhatsApp HSM — dibaca langsung dari WABA tiap channel WA Official (status Meta) */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Template WhatsApp (Meta)</h2>
                {waErrors.length > 0 && (
                  <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Sebagian template gagal dimuat dari Meta: {waErrors.join("; ")}
                  </p>
                )}
                <WaTemplatesTable
                  rows={waTemplates.map((t) => ({
                    key: `${t.channelId}:${t.id || t.name}:${t.language}`,
                    name: t.name,
                    language: t.language,
                    category: t.category,
                    status: t.status,
                    body: t.body,
                    channelName: t.channelName,
                    buttons: t.buttons.length,
                  }))}
                />
              </section>

              {/* Balasan cepat — lokal */}
              {quickReplies.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">Balasan Cepat</h2>
                  <QuickRepliesTable rows={quickReplies.map((t) => ({ id: t.id, name: t.name, body: t.body }))} />
                </section>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
