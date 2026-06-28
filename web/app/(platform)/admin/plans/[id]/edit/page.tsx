import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PlanForm } from "@/components/app/plan-form";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  const { id } = await params;
  const plan = await db.query.plans.findFirst({ where: eq(plans.id, id) });
  if (!plan) notFound();

  return (
    <div className="w-full p-6 sm:p-8">
      <Link
        href="/admin/plans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Paket
      </Link>
      <PlanForm
        mode="edit"
        planId={plan.id}
        initial={{
          tier: plan.tier as "pro" | "business" | "enterprise",
          name: plan.name,
          slug: plan.slug,
          priceIdr: plan.priceIdr,
          period: plan.period === "year" ? "year" : "month",
          quota: plan.quota,
          description: plan.description ?? "",
          features: plan.features ?? [],
          isActive: plan.isActive,
          highlight: plan.highlight,
          sortOrder: plan.sortOrder,
        }}
      />
    </div>
  );
}
