import Link from "next/link";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

// Layar terkunci untuk fitur di luar paket tenant (lock sesuai pricing). Admin
// platform tak pernah melihat ini (hasFeature bypass). Arahkan upgrade ke /billing.
export function PlanLock({
  title,
  feature,
  requiredPlan = "Pro",
  description,
}: {
  title: string;
  feature: string;
  requiredPlan?: string;
  description?: string;
}) {
  return (
    <div className="p-6">
      <PageHeader
        title={title}
        description={description ?? `Fitur ${feature} tersedia di paket lebih tinggi.`}
      />
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-blue/10 text-brand-blue">
          <Lock className="size-7" />
        </span>
        <h2 className="text-lg font-bold text-foreground">Fitur {feature} terkunci</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature} tersedia mulai paket <span className="font-semibold text-foreground">{requiredPlan}</span>.
          Upgrade paket untuk membukanya.
        </p>
        <Link
          href="/billing"
          className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Sparkles className="size-4" /> Lihat Paket <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
