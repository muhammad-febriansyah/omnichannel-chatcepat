import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PlanForm } from "@/components/app/plan-form";

export default async function NewPlanPage() {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  return (
    <div className="w-full p-6 sm:p-8">
      <Link
        href="/admin/plans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Paket
      </Link>
      <PlanForm mode="create" />
    </div>
  );
}
