import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import type { listActivePlans } from "@/lib/billing-actions";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type PlanRow = Awaited<ReturnType<typeof listActivePlans>>[number];

function PlanCard({ plan, index }: { plan: PlanRow; index: number }) {
  const isContact = plan.priceIdr === 0;
  const periodLabel = plan.period === "year" ? "/tahun" : "/bulan";
  const hi = plan.highlight;

  return (
    <Reveal
      delay={index * 0.08}
      className={cn(
        "relative flex flex-col rounded-3xl border p-7 transition duration-300 hover:-translate-y-1",
        hi
          ? "border-transparent bg-gradient-to-b from-brand-navy to-[#0f1956] text-white shadow-2xl shadow-brand-navy/30"
          : "border-border bg-card shadow-sm hover:shadow-lg",
      )}
    >
      {hi && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-blue px-3 py-1 text-xs font-semibold text-white shadow-lg ring-4 ring-brand-blue/20">
          <Sparkles className="size-3" /> Populer
        </span>
      )}
      <h3 className={cn("text-lg font-bold", hi ? "text-white" : "text-foreground")}>{plan.name}</h3>
      {plan.description && (
        <p className={cn("mt-1.5 text-sm", hi ? "text-white/70" : "text-muted-foreground")}>{plan.description}</p>
      )}

      <div className="mt-6 flex items-end gap-1">
        {isContact ? (
          <span className={cn("text-4xl font-bold tracking-tight", hi ? "text-white" : "text-foreground")}>Custom</span>
        ) : (
          <>
            <span className={cn("text-4xl font-bold tracking-tight", hi ? "text-white" : "text-brand-navy dark:text-foreground")}>
              {rupiah(plan.priceIdr)}
            </span>
            <span className={cn("pb-1.5 text-sm", hi ? "text-white/60" : "text-muted-foreground")}>{periodLabel}</span>
          </>
        )}
      </div>

      {plan.quota != null && !isContact && (
        <p className={cn("mt-1.5 text-xs", hi ? "text-white/60" : "text-muted-foreground")}>
          Termasuk {new Intl.NumberFormat("id-ID").format(plan.quota)} percakapan / bulan
        </p>
      )}

      <ul className="mt-7 flex-1 space-y-3.5">
        {plan.features.map((f) => (
          <li key={f} className={cn("flex items-start gap-2.5 text-sm", hi ? "text-white/90" : "text-foreground")}>
            <span
              className={cn(
                "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                hi ? "bg-brand-blue/30 text-white" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/billing"
        className={cn(
          "mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition",
          hi
            ? "bg-white text-brand-navy hover:bg-white/90"
            : "bg-brand-navy text-white hover:bg-brand-navy/90",
        )}
      >
        {isContact ? "Hubungi Kami" : "Pilih Paket"}
      </Link>
    </Reveal>
  );
}

export function Pricing({ plans }: { plans: PlanRow[] }) {
  return (
    <section id="harga" className="scroll-mt-24 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Harga"
          title="Harga transparan, tanpa biaya tersembunyi"
          description="Mulai dari paket kecil dan naik kapan saja. Semua paket termasuk inbox omnichannel dan AI Agent."
        />

        {plans.length === 0 ? (
          <Reveal className="mx-auto mt-12 max-w-md rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Paket sedang kami siapkan. Hubungi tim kami untuk penawaran yang sesuai dengan kebutuhan bisnis Anda.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy/90"
            >
              Hubungi Kami
            </Link>
          </Reveal>
        ) : (
          <div
            className={cn(
              "mx-auto mt-16 grid items-stretch gap-6",
              plans.length === 1 && "max-w-sm grid-cols-1",
              plans.length === 2 && "max-w-3xl grid-cols-1 sm:grid-cols-2",
              plans.length >= 3 && "max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {plans.map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
