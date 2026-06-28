import { and, desc, eq } from "drizzle-orm";
import { Plus, Zap, FileText, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { deleteTemplate } from "@/lib/actions";
import { listApiCoTemplates, type ApiCoTemplate } from "@/lib/apico-server";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DeleteButton } from "@/components/app/delete-button";
import { ActionLink } from "@/components/app/action-link";
import { EditButton } from "@/components/app/action-button";
import { StatusPill, type PillTone } from "@/components/app/status-pill";

// Status Meta (api.co.id) → tampilan.
const WA_STATUS_TONE: Record<string, PillTone> = {
  APPROVED: "emerald",
  PENDING: "amber",
  REJECTED: "red",
  PAUSED: "amber",
  DISABLED: "slate",
};
const WA_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING: "Menunggu Meta",
  REJECTED: "Ditolak",
  PAUSED: "Dijeda",
  DISABLED: "Nonaktif",
};

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

export default async function TemplatesPage() {
  const session = await requirePageAbility("broadcast.manage");
  const [waTemplates, quickReplies] = await Promise.all([
    listApiCoTemplates(),
    loadQuickReplies(session.tenantId),
  ]);

  const total = waTemplates.length + quickReplies.length;

  return (
    <div className="p-6">
      <PageHeader
        icon={FileText}
        title="Template Pesan"
        description={`${waTemplates.length} template WhatsApp (Meta) · ${quickReplies.length} balasan cepat`}
        actions={
          <ActionLink href="/templates/new">
            <Plus className="size-4" /> Template Baru
          </ActionLink>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Belum ada template"
          description="Buat template WhatsApp (HSM) untuk pesan pertama/broadcast, atau balasan cepat untuk agen."
          action={
            <ActionLink href="/templates/new">
              <Plus className="size-4" /> Buat template pertama
            </ActionLink>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* WhatsApp HSM — sumber api.co.id (status Meta) */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Template WhatsApp (Meta)</h2>
            {waTemplates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada template WhatsApp. Buat lewat “Template Baru” → jenis WhatsApp (HSM).
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {waTemplates.map((t: ApiCoTemplate, i) => (
                  <div
                    key={t.id || t.name}
                    className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue dark:bg-blue-500/10 dark:text-blue-300">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{t.name}</span>
                        <StatusPill tone="slate" className="shrink-0">
                          {t.language}
                        </StatusPill>
                        {t.category && (
                          <StatusPill tone="slate" className="shrink-0">
                            {t.category}
                          </StatusPill>
                        )}
                        <StatusPill tone={WA_STATUS_TONE[t.status] ?? "slate"} className="shrink-0">
                          {WA_STATUS_LABEL[t.status] ?? t.status}
                        </StatusPill>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Balasan cepat — lokal */}
          {quickReplies.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-foreground">Balasan Cepat</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {quickReplies.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue dark:bg-blue-500/10 dark:text-blue-300">
                      <Zap className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-semibold">{t.name}</span>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.body}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <EditButton href={`/templates/${t.id}/edit`} />
                      <DeleteButton
                        onConfirm={deleteTemplate.bind(null, t.id)}
                        title="Hapus template?"
                        description={
                          <>
                            Template <span className="font-semibold text-foreground">{t.name}</span> akan dihapus permanen.
                          </>
                        }
                        successMessage="Template dihapus"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
