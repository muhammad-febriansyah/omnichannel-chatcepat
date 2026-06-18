import { eq } from "drizzle-orm";
import { ArrowLeft, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { AcquireTools } from "@/components/app/acquire-tools";
import { ActionLink } from "@/components/app/action-link";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";

export default async function AcquirePage() {
  const session = await requireSession();
  let slug = "";
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      slug = t?.slug ?? "";
    } catch {
      /* abaikan */
    }
  }

  return (
    <div className="space-y-5 p-6">
      <ActionLink href="/contacts" variant="ghost" size="default" className="-ml-2 w-fit gap-1.5">
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </ActionLink>

      <PageHeader
        icon={UserPlus}
        title="Akuisisi Kontak"
        description="Kumpulkan kontak baru dengan consent (opt-in) sesuai aturan."
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <StatusPill tone="amber">Wajib consent</StatusPill>
        <span>
          Hanya kumpulkan kontak yang <b>memberi consent</b> lewat opt-in. Dilarang scraping nomor/kontak pihak ketiga
          tanpa persetujuan.
        </span>
      </div>

      <AcquireTools slug={slug} />
    </div>
  );
}
