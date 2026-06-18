import { redirect } from "next/navigation";
import { Check, Sparkles, Crown, CreditCard } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listActivePlans, startCheckout } from "@/lib/billing-actions";
import { PLAN_LABEL } from "@/lib/plan";
import { rupiah } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function BillingPage() {
  const session = await requirePageAbility("billing.tenant");
  // super_admin tidak berlangganan — kelola paket di konsol platform.
  if (session.isSuperAdmin) redirect("/admin/plans");
  const plans = await listActivePlans();
  const canBuy = can(session, "billing.tenant");

  return (
    <div className="p-6">
      <PageHeader
        icon={CreditCard}
        title="Tagihan & Paket"
        description="Pilih paket yang sesuai. Pembayaran aman lewat Duitku."
      />

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Belum ada paket tersedia. Hubungi admin.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 transition",
                p.highlight ? "border-brand-blue ring-2 ring-brand-blue/15 shadow-lg" : "border-border",
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-blue px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Sparkles className="size-3" /> Populer
                </span>
              )}
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                <StatusPill tone="slate">{PLAN_LABEL[p.tier as keyof typeof PLAN_LABEL] ?? p.tier}</StatusPill>
              </div>
              {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}

              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-bold tracking-tight text-brand-navy dark:text-foreground">
                  {p.priceIdr === 0 ? "Gratis" : rupiah(p.priceIdr)}
                </span>
                {p.priceIdr > 0 && (
                  <span className="mb-1 text-sm text-muted-foreground">/{p.period === "year" ? "tahun" : "bulan"}</span>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {(p.features ?? []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
                {p.quota != null && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-foreground">{p.quota.toLocaleString("id-ID")} pesan/bulan</span>
                  </li>
                )}
              </ul>

              <form action={startCheckout.bind(null, p.id)} className="mt-6">
                <Button type="submit" size="lg" disabled={!canBuy} variant={p.highlight ? "default" : "outline"} className="w-full">
                  <Crown className="size-4" /> {p.priceIdr === 0 ? "Pilih paket" : "Beli paket"}
                </Button>
              </form>
              {!canBuy && <p className="mt-2 text-center text-xs text-muted-foreground">Hanya admin yang bisa membeli paket.</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
