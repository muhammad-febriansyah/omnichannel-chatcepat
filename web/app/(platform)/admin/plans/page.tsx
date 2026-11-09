import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { Plus, Package } from "lucide-react";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";
import { Card, CardContent } from "@/components/ui/card";
import { PlansTable } from "@/components/app/plans-table";

export default async function PlansPage() {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  const rows = await db.query.plans.findMany({ orderBy: [asc(plans.sortOrder)] });

  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        title="Paket Harga"
        description={`${rows.length} paket · pricing global SaaS untuk seluruh tenant`}
        actions={
          <ActionLink href="/admin/plans/new">
            <Plus className="size-4" /> Paket Baru
          </ActionLink>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Package className="size-6" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">Belum ada paket</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Buat paket harga pertama untuk ditampilkan di halaman pricing.
              </p>
              <ActionLink href="/admin/plans/new" className="mt-5">
                <Plus className="size-4" /> Paket Baru
              </ActionLink>
            </div>
          ) : (
            <PlansTable
              rows={rows.map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                tier: p.tier,
                priceIdr: Number(p.priceIdr),
                period: p.period,
                quota: p.quota,
                isActive: p.isActive,
                highlight: p.highlight,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
