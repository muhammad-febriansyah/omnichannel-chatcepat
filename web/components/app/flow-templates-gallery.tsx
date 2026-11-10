"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  ListChecks,
  Lock,
  Megaphone,
  MessageCircleReply,
  MessagesSquare,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NODE_META } from "@/components/app/flow-builder/meta";
import { nodeAllowed } from "@/lib/plan-config";
import { cn } from "@/lib/utils";
import { createFlowFromTemplate } from "@/lib/actions";
import {
  FLOW_TEMPLATES,
  PLATFORMS,
  TEMPLATE_CATEGORIES,
  platformLabel,
  type FlowTemplate,
  type Platform,
  type TemplateCategory,
} from "@/lib/flow-templates";
import { SubmitButton } from "@/components/app/submit-button";

const CATEGORY_STYLE: Record<TemplateCategory, { icon: React.ElementType; tint: string }> = {
  chat: { icon: MessagesSquare, tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
  broadcast: { icon: Megaphone, tint: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  komentar: { icon: MessageCircleReply, tint: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300" },
  ai: { icon: Bot, tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  penjualan: { icon: ShoppingCart, tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

const chip = (active: boolean) =>
  cn(
    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
    active ? "bg-brand-blue text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-secondary hover:text-brand-blue",
  );

function matches(t: FlowTemplate, q: string): boolean {
  if (!q) return true;
  const hay = [t.title, t.desc, platformLabel(t.platforms), ...t.steps, ...t.setup].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export function FlowTemplatesGallery({ category: initialCategory, allowedNodes = null }: { category?: TemplateCategory; allowedNodes?: string[] | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | undefined>(initialCategory);
  const [platform, setPlatform] = useState<Platform | undefined>();

  const list = useMemo(
    () =>
      FLOW_TEMPLATES.filter(
        (t) => (!category || t.category === category) && (!platform || t.platforms.includes(platform)) && matches(t, query.trim()),
      ),
    [category, platform, query],
  );
  // Without a category filter, show templates grouped by category so the page stays scannable.
  const sections = category
    ? [{ value: category, label: TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label ?? "", items: list }]
    : TEMPLATE_CATEGORIES.map((c) => ({ ...c, items: list.filter((t) => t.category === c.value) })).filter((s) => s.items.length);
  const filtered = !!(query.trim() || category || platform);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-blue-50 to-violet-50 p-5 sm:flex-row sm:items-center dark:from-blue-500/10 dark:to-violet-500/10">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-blue shadow-sm dark:bg-card">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Mulai cepat dari template</p>
          <p className="text-sm text-muted-foreground">
            Pilih sesuai kebutuhan &amp; platform. Template dibuat sebagai <b>draft</b>. Ikuti bagian <b>&ldquo;Setelah dipakai&rdquo;</b> di tiap kartu, lalu aktifkan.
          </p>
        </div>
        <Link href="/flows?tab=panduan" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
          Baca panduan <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Search + filters on one white card. */}
      <div className="space-y-3 rounded-[20px] border border-border bg-card p-4 shadow-sm">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari template… mis. komentar, ongkir, booking"
            aria-label="Cari template"
            className="h-10 pl-9 pr-9"
          />
          {query && (
            <button type="button" aria-label="Hapus pencarian" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted">
              <X className="size-3.5" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Kebutuhan</span>
          <button type="button" className={chip(!category)} onClick={() => setCategory(undefined)}>
            Semua
          </button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button key={c.value} type="button" className={chip(category === c.value)} onClick={() => setCategory(category === c.value ? undefined : c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Platform</span>
          <button type="button" className={chip(!platform)} onClick={() => setPlatform(undefined)}>
            Semua
          </button>
          {PLATFORMS.map((p) => (
            <button key={p.value} type="button" className={chip(platform === p.value)} onClick={() => setPlatform(platform === p.value ? undefined : p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {filtered && (
          <p className="text-xs text-muted-foreground">
            {list.length} template cocok.{" "}
            <button
              type="button"
              className="font-medium text-brand-blue hover:underline"
              onClick={() => {
                setQuery("");
                setCategory(undefined);
                setPlatform(undefined);
              }}
            >
              Reset filter
            </button>
          </p>
        )}
      </div>

      {list.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada template yang cocok. Coba kata lain, atau buat flow kosong lewat <b>Flow Baru</b> di tab Flow.
        </p>
      )}

      {sections.map((sec) => (
        <section key={sec.value} className="space-y-3">
          {!category && <h3 className="text-sm font-semibold text-muted-foreground">{sec.label}</h3>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sec.items.map((t) => (
              <TemplateCard key={t.id} t={t} allowedNodes={allowedNodes} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TemplateCard({ t, allowedNodes }: { t: FlowTemplate; allowedNodes: string[] | null }) {
  const style = CATEGORY_STYLE[t.category];
  const missing = [...new Set(t.build().nodes.map((n) => n.type).filter((k) => !nodeAllowed(allowedNodes, k)))];
  const Icon = style.icon;
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-transparent bg-card p-4 transition hover:border-brand-blue/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", style.tint)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{t.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{platformLabel(t.platforms)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            t.level === "Mudah" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          )}
        >
          {t.level}
        </span>
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
      <div className="rounded-xl bg-muted/50 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <ListChecks className="size-3.5 text-brand-blue" /> Setelah dipakai
        </p>
        <ul className="space-y-1 text-xs leading-snug text-muted-foreground">
          {t.setup.map((s, i) => (
            <li key={s} className="flex gap-1.5">
              <span className="font-semibold text-foreground/70">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
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
}
