import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { deleteContact } from "@/lib/actions";

export default async function DeleteContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId) notFound();

  const c = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), eq(contacts.tenantId, session.tenantId)),
  });
  if (!c) notFound();

  const del = deleteContact.bind(null, c.id);
  const label = c.name || c.phone || "kontak ini";

  return (
    <div className="mx-auto max-w-lg p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Hapus kontak?</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kontak <span className="font-semibold text-foreground">{label}</span> akan dihapus permanen beserta
          riwayat keterkaitannya. Tindakan ini tidak bisa dibatalkan.
        </p>

        <form action={del} className="mt-6 flex gap-2">
          <button
            type="submit"
            className="flex h-11 items-center gap-2 rounded-xl bg-danger px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Trash2 className="size-4" /> Ya, hapus
          </button>
          <Link
            href="/contacts"
            className="flex h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50"
          >
            Batal
          </Link>
        </form>
      </div>
    </div>
  );
}
