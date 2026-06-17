import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Pencil, Trash2, Zap, FileText, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";

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
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Template Pesan</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} template · WhatsApp (HSM) &amp; balasan cepat
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="size-4" /> Template Baru
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
            <FileStack className="size-6" />
          </div>
          <p className="mt-3 text-sm font-medium">Belum ada template</p>
          <Link href="/templates/new" className="mt-1 text-xs font-medium text-brand-blue">
            Buat template pertama
          </Link>
        </div>
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
                  <Link
                    href={`/templates/${t.id}/delete`}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-danger"
                    aria-label="Hapus"
                  >
                    <Trash2 className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
