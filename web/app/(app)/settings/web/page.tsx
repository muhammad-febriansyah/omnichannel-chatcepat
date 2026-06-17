import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { normalizeWebSettings } from "@/lib/web-settings";
import { WebSettingsForm } from "@/components/app/web-settings-form";

export default async function WebSettingsPage() {
  const session = await requireSession();
  let raw: unknown = undefined;
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      raw = (t?.settings as Record<string, unknown> | undefined)?.web_settings;
    } catch {
      /* pakai default dummy */
    }
  }
  const initial = normalizeWebSettings(raw);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Pengaturan
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Website</h1>
        <p className="text-sm text-muted-foreground">Logo, SEO, sosial media, dan info kontak publik.</p>
      </div>
      <WebSettingsForm initial={initial} />
    </div>
  );
}
