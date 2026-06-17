import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { AcquireTools } from "@/components/app/acquire-tools";

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
    <div className="p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Akuisisi Kontak</h1>
        <p className="text-sm text-muted-foreground">Kumpulkan kontak baru dengan consent (opt-in) sesuai aturan.</p>
      </div>
      <AcquireTools slug={slug} />
    </div>
  );
}
