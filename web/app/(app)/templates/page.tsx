import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Pencil, Zap, FileText, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { deleteTemplate } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DeleteButton } from "@/components/app/delete-button";

const KIND_META: Record<string, { label: string; icon: typeof Zap }> = {
  quick_reply: { label: "Balasan Cepat", icon: Zap },
  hsm: { label: "WhatsApp HSM", icon: FileText },
};

const STATUS_CLS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
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
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        title="Template Pesan"
        description={`${rows.length} template · WhatsApp (HSM) & balasan cepat`}
        actions={
          <Link
            href="/templates/new"
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" /> Template Baru
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Belum ada template"
          description="Buat balasan cepat atau template WhatsApp (HSM) untuk mempercepat respons."
          action={
            <Link href="/templates/new" className="text-xs font-medium text-brand-blue">
              Buat template pertama
            </Link>
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
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {meta.label}
                    </span>
                    {t.kind === "hsm" && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[t.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/templates/${t.id}/edit`}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <DeleteButton
                    onConfirm={deleteTemplate.bind(null, t.id)}
                    title="Hapus template?"
                    description={
                      <>
                        Template <span className="font-semibold text-foreground">{t.name}</span> akan dihapus permanen.
                      </>
                    }
                    successMessage="Template dihapus"
                    triggerLabel="Hapus template"
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
