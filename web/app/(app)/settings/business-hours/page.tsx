import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { normalizeBusinessHours } from "@/lib/business-hours";
import { BusinessHoursForm } from "@/components/app/business-hours-form";

export default async function BusinessHoursPage() {
  const session = await requirePageAbility("flow.manage");
  let raw: unknown = undefined;
  if (session.tenantId) {
    try {
      const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
      raw = (t?.settings as Record<string, unknown> | undefined)?.business_hours;
    } catch {
      /* pakai default */
    }
  }
  const initial = normalizeBusinessHours(raw);

  return (
    <div>
      <div className="px-6 pt-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Kembali ke Pengaturan
        </Link>
      </div>
      <BusinessHoursForm initial={initial} />
    </div>
  );
}
