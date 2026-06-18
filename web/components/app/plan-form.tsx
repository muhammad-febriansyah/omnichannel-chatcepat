"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Package } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { createPlan, updatePlan, type PlanInput } from "@/lib/billing-actions";

const schema = z.object({
  name: z.string().trim().min(1, "Nama paket wajib diisi").max(120, "Nama maksimal 120 karakter"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug wajib diisi")
    .max(80, "Slug maksimal 80 karakter")
    .regex(/^[a-z0-9-]+$/i, "Slug hanya boleh huruf, angka, dan tanda hubung"),
  tier: z.enum(["pro", "business", "enterprise"]),
  priceIdr: z.coerce.number().int("Harga harus bilangan bulat").min(0, "Harga tidak boleh negatif"),
  period: z.enum(["month", "year"]),
  quota: z
    .union([z.coerce.number().int("Kuota harus bilangan bulat").min(0, "Kuota tidak boleh negatif"), z.literal("")])
    .optional(),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().or(z.literal("")),
  features: z.string().optional(),
  isActive: z.boolean(),
  highlight: z.boolean(),
  sortOrder: z.coerce.number().int("Urutan harus bilangan bulat"),
});

type Values = z.input<typeof schema>;

export interface PlanInitial {
  tier: "pro" | "business" | "enterprise";
  name: string;
  slug: string;
  priceIdr: number;
  period: "month" | "year";
  quota: number | null;
  description: string;
  features: string[];
  isActive: boolean;
  highlight: boolean;
  sortOrder: number;
}

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

export function PlanForm({
  mode,
  planId,
  initial,
}: {
  mode: "create" | "edit";
  planId?: string;
  initial?: PlanInitial;
}) {
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      tier: initial?.tier ?? "pro",
      priceIdr: initial?.priceIdr ?? 0,
      period: initial?.period ?? "month",
      quota: initial?.quota == null ? "" : initial.quota,
      description: initial?.description ?? "",
      features: (initial?.features ?? []).join("\n"),
      isActive: initial?.isActive ?? true,
      highlight: initial?.highlight ?? false,
      sortOrder: initial?.sortOrder ?? 0,
    },
  });

  function onSubmit(v: Values) {
    const quotaRaw = v.quota;
    const payload: PlanInput = {
      tier: v.tier as PlanInput["tier"],
      name: String(v.name).trim(),
      slug: String(v.slug).trim(),
      priceIdr: Number(v.priceIdr) || 0,
      period: v.period,
      quota: quotaRaw === "" || quotaRaw == null ? null : Number(quotaRaw),
      description: (v.description ?? "").toString(),
      features: (v.features ?? "")
        .toString()
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      isActive: !!v.isActive,
      highlight: !!v.highlight,
      sortOrder: Number(v.sortOrder) || 0,
    };
    start(async () => {
      try {
        if (mode === "edit" && planId) await updatePlan(planId, payload);
        else await createPlan(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan paket";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="size-5 text-brand-blue" />
            {mode === "edit" ? "Edit Paket" : "Paket Baru"}
          </CardTitle>
          <CardDescription>Paket harga global SaaS untuk seluruh tenant ChatCepat.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Identitas */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identitas</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                  Nama Paket
                </label>
                <input id="name" {...register("name")} placeholder="Business" className={inputCls} />
                {errors.name && <p className="mt-1.5 text-xs font-medium text-danger">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="slug" className="mb-1.5 block text-sm font-medium text-foreground">
                  Slug
                </label>
                <input id="slug" {...register("slug")} placeholder="business" className={inputCls} />
                {errors.slug && <p className="mt-1.5 text-xs font-medium text-danger">{errors.slug.message}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">Dipakai di URL & pemilihan paket.</p>
              </div>
              <div>
                <label htmlFor="tier" className="mb-1.5 block text-sm font-medium text-foreground">
                  Tier
                </label>
                <select id="tier" {...register("tier")} className={inputCls}>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label htmlFor="sortOrder" className="mb-1.5 block text-sm font-medium text-foreground">
                  Urutan Tampil
                </label>
                <input id="sortOrder" type="number" {...register("sortOrder")} className={inputCls} />
                {errors.sortOrder && (
                  <p className="mt-1.5 text-xs font-medium text-danger">{errors.sortOrder.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Harga & kuota */}
          <div className="border-t border-border pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Harga &amp; Kuota</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="priceIdr" className="mb-1.5 block text-sm font-medium text-foreground">
                  Harga (Rupiah)
                </label>
                <input id="priceIdr" type="number" inputMode="numeric" {...register("priceIdr")} className={inputCls} />
                {errors.priceIdr && (
                  <p className="mt-1.5 text-xs font-medium text-danger">{errors.priceIdr.message}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">0 = harga custom (&ldquo;Hubungi kami&rdquo;).</p>
              </div>
              <div>
                <label htmlFor="period" className="mb-1.5 block text-sm font-medium text-foreground">
                  Periode
                </label>
                <select id="period" {...register("period")} className={inputCls}>
                  <option value="month">Bulanan</option>
                  <option value="year">Tahunan</option>
                </select>
              </div>
              <div>
                <label htmlFor="quota" className="mb-1.5 block text-sm font-medium text-foreground">
                  Kuota Pesan
                </label>
                <input id="quota" type="number" inputMode="numeric" {...register("quota")} placeholder="Unlimited" className={inputCls} />
                {errors.quota && <p className="mt-1.5 text-xs font-medium text-danger">{errors.quota.message}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">Kosongkan = unlimited.</p>
              </div>
            </div>
          </div>

          {/* Detail */}
          <div className="border-t border-border pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
                  Deskripsi
                </label>
                <textarea
                  id="description"
                  {...register("description")}
                  rows={2}
                  placeholder="Cocok untuk bisnis yang sedang bertumbuh."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
                />
                {errors.description && (
                  <p className="mt-1.5 text-xs font-medium text-danger">{errors.description.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="features" className="mb-1.5 block text-sm font-medium text-foreground">
                  Fitur
                </label>
                <textarea
                  id="features"
                  {...register("features")}
                  rows={5}
                  placeholder={"Unlimited agen\nAuto-reply AI\nBroadcast WhatsApp\nLaporan lengkap"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Satu fitur per baris.</p>
              </div>
            </div>
          </div>

          {/* Opsi */}
          <div className="border-t border-border pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opsi</h3>
            <div className="flex flex-wrap gap-6">
              <label htmlFor="isActive" className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                <input
                  id="isActive"
                  type="checkbox"
                  {...register("isActive")}
                  className="size-4 rounded border-border text-brand-blue focus:ring-brand-blue/30"
                />
                Aktif (tampil di halaman harga)
              </label>
              <label htmlFor="highlight" className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                <input
                  id="highlight"
                  type="checkbox"
                  {...register("highlight")}
                  className="size-4 rounded border-border text-brand-blue focus:ring-brand-blue/30"
                />
                Sorot sebagai paket populer
              </label>
            </div>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t border-border">
          <ActionLink href="/admin/plans" variant="outline" className="px-5">
            Batal
          </ActionLink>
          <Button type="submit" size="lg" disabled={pending} className="px-5">
            <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Paket"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
