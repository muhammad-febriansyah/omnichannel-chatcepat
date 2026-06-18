import { and, desc, eq } from "drizzle-orm";
import { Plus, Zap, FileText, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { deleteTemplate } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DeleteButton } from "@/components/app/delete-button";
import { ActionLink } from "@/components/app/action-link";
import { EditButton } from "@/components/app/action-button";
import { StatusPill, type PillTone } from "@/components/app/status-pill";

const KIND_META: Record<string, { label: string; icon: typeof Zap }> = {
  quick_reply: { label: "Balasan Cepat", icon: Zap },
  hsm: { label: "WhatsApp HSM", icon: FileText },
};

const STATUS_TONE: Record<string, PillTone> = {
  approved: "emerald",
  draft: "amber",
  rejected: "red",
};
const STATUS_LABEL: Record<string, string> = {
  approved: "Aktif",
  draft: "Menunggu approval",
  rejected: "Ditolak",
};

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.templates.findMany({
      where: and(eq(templates.tenantId, tenantId)),
      orderBy: [desc(templates.createdAt)],
      limit: 200,
    });
  } catch {
    return [];
  }
}

export default async function TemplatesPage() {
  const session = await requirePageAbility("broadcast.manage");
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        icon={FileText}
        title="Template Pesan"
        description={`${rows.length} template · WhatsApp (HSM) & balasan cepat`}
        actions={
          <ActionLink href="/templates/new">
            <Plus className="size-4" /> Template Baru
          </ActionLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Belum ada template"
          description="Buat balasan cepat atau template WhatsApp (HSM) untuk mempercepat respons."
          action={
            <ActionLink href="/templates/new">
              <Plus className="size-4" /> Buat template pertama
            </ActionLink>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((t, i) => {
            const meta = KIND_META[t.kind] ?? KIND_META.quick_reply;
            const Icon = meta.icon;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue dark:bg-blue-500/10 dark:text-blue-300">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                    <StatusPill tone="slate" className="shrink-0">
                      {meta.label}
                    </StatusPill>
                    {t.kind === "hsm" && (
                      <StatusPill tone={STATUS_TONE[t.status] ?? "slate"} className="shrink-0">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </StatusPill>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
