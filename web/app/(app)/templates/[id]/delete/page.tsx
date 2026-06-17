import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { deleteTemplate } from "@/lib/actions";

export default async function DeleteTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();
  const t = await db.query.templates.findFirst({
    where: and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)),
  });
  if (!t) notFound();
  const del = deleteTemplate.bind(null, t.id);

  return (
    <div className="mx-auto max-w-lg p-6">
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Template
      </Link>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Hapus template?</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Template <span className="font-semibold text-foreground">{t.name}</span> akan dihapus permanen. Aksi ini
          tidak bisa dibatalkan.
        </p>
        <form action={del} className="mt-6 flex gap-2">
          <button type="submit" className="flex h-11 items-center gap-2 rounded-xl bg-danger px-5 text-sm font-semibold text-white transition hover:opacity-90">
            <Trash2 className="size-4" /> Ya, hapus
          </button>
          <Link href="/templates" className="flex h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50">
            Batal
          </Link>
        </form>
      </div>
    </div>
  );
}
