import Link from "next/link";
import { ArrowRight, Bot, ChevronRight, Lock, Megaphone, MessageCircleReply, MessagesSquare, ShoppingCart, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NODE_META } from "@/components/app/flow-builder/meta";
import { nodeAllowed } from "@/lib/plan-config";
import { cn } from "@/lib/utils";
import { createFlowFromTemplate } from "@/lib/actions";
import { FLOW_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/flow-templates";
import { SubmitButton } from "@/components/app/submit-button";

const CATEGORY_STYLE: Record<TemplateCategory, { icon: React.ElementType; tint: string }> = {
  chat: { icon: MessagesSquare, tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
  broadcast: { icon: Megaphone, tint: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  komentar: { icon: MessageCircleReply, tint: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300" },
  ai: { icon: Bot, tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  penjualan: { icon: ShoppingCart, tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

export function FlowTemplatesGallery({ category, allowedNodes = null }: { category?: TemplateCategory; allowedNodes?: string[] | null }) {
  const list = category ? FLOW_TEMPLATES.filter((t) => t.category === category) : FLOW_TEMPLATES;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-blue-50 to-violet-50 p-5 sm:flex-row sm:items-center dark:from-blue-500/10 dark:to-violet-500/10">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-blue shadow-sm dark:bg-card">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Mulai cepat dari template</p>
          <p className="text-sm text-muted-foreground">
            Template dibuat sebagai <b>draft</b> — ubah teks, keyword, dan akunnya di kanvas, lalu aktifkan.
          </p>
        </div>
        <Link href="/flows?tab=panduan" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
          Baca panduan <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ value: undefined, label: "Semua" }, ...TEMPLATE_CATEGORIES].map((c) => {
          const active = c.value === category;
          return (
            <Link
              key={c.label}
              href={c.value ? `/flows?tab=template&kat=${c.value}` : "/flows?tab=template"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                active ? "border-brand-blue bg-brand-blue text-white" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => {
          const style = CATEGORY_STYLE[t.category];
          const missing = [...new Set(t.build().nodes.map((n) => n.type).filter((k) => !nodeAllowed(allowedNodes, k)))];
          const Icon = style.icon;
          return (
            <div key={t.id} className="flex flex-col gap-3 rounded-[20px] bg-card p-4 transition hover:border-brand-blue/40 hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", style.tint)}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.channels}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              <ol className="flex flex-wrap items-center gap-1 text-[11px]">
                {t.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="size-3 text-muted-foreground/60" />}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/80">{s}</span>
                  </li>
                ))}
              </ol>
              {missing.length ? (
                <div className="mt-auto space-y-2 pt-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> Butuh {missing.map((k) => NODE_META[k].label).join(", ")}
                  </p>
                  <Link href="/billing" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    Upgrade paket
                  </Link>
                </div>
              ) : (
                <form action={createFlowFromTemplate.bind(null, t.id)} className="mt-auto pt-1">
                  <SubmitButton className="w-full" pendingText="Membuat flow…">
                    <Sparkles className="size-4" /> Pakai template
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
