"use client";

import { useState, useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Package, Plus, X, Check } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { createPlan, updatePlan, type PlanInput } from "@/lib/billing-actions";
import { cn } from "@/lib/utils";

// Format angka ke ribuan id-ID ("12.500"); "" kalau kosong/0 opsional.
function groupID(n: number): string {
  return n.toLocaleString("id-ID");
}
function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

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
    control,
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
                  Harga
                </label>
                <Controller
                  control={control}
                  name="priceIdr"
                  render={({ field }) => {
                    const num = Number(field.value) || 0;
                    return (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                          Rp
                        </span>
                        <input
                          id="priceIdr"
                          inputMode="numeric"
                          autoComplete="off"
                          value={num === 0 ? "" : groupID(num)}
                          onChange={(e) => {
                            const d = onlyDigits(e.target.value);
                            field.onChange(d === "" ? 0 : Number(d));
                          }}
                          placeholder="0"
                          className={cn(inputCls, "pl-9 font-medium tabular-nums")}
                        />
                      </div>
                    );
                  }}
                />
                {errors.priceIdr && (
                  <p className="mt-1.5 text-xs font-medium text-danger">{errors.priceIdr.message}</p>
                )}
                <PricePreview control={control} />
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
                <Controller
                  control={control}
                  name="quota"
                  render={({ field }) => {
                    const raw = field.value;
                    const num = raw === "" || raw == null ? null : Number(raw);
                    return (
                      <input
                        id="quota"
                        inputMode="numeric"
                        autoComplete="off"
                        value={num == null ? "" : groupID(num)}
                        onChange={(e) => {
                          const d = onlyDigits(e.target.value);
                          field.onChange(d === "" ? "" : Number(d));
                        }}
                        placeholder="Unlimited"
                        className={cn(inputCls, "tabular-nums")}
                      />
                    );
                  }}
                />
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
                <label className="mb-1.5 block text-sm font-medium text-foreground">Fitur</label>
                <Controller
                  control={control}
                  name="features"
                  render={({ field }) => {
                    const arr = (field.value ?? "")
                      .toString()
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return (
                      <FeatureInput value={arr} onChange={(v) => field.onChange(v.join("\n"))} />
                    );
                  }}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Ketik fitur lalu tekan Enter. Klik ✕ untuk menghapus.
                </p>
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

// Input fitur berbasis chip: ketik + Enter tambah, ✕ hapus. Lebih mudah dari textarea.
function FeatureInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-lg border border-border bg-background p-2.5 transition-shadow focus-within:border-brand-blue focus-within:bg-card focus-within:ring-4 focus-within:ring-brand-blue/10">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((f, i) => (
            <li
              key={f}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-navy dark:bg-blue-500/15 dark:text-blue-300"
            >
              <Check className="size-3.5 shrink-0 text-brand-blue" />
              {f}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Hapus ${f}`}
                className="grid size-4 place-items-center rounded-full text-brand-navy/60 transition hover:bg-brand-navy/10 hover:text-brand-navy"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value.length - 1);
            }
          }}
          placeholder={value.length === 0 ? "mis. Unlimited agen" : "Tambah fitur…"}
          className="h-8 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-blue px-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      </div>
    </div>
  );
}

// Preview harga reaktif tanpa watch() (hindari React Compiler skip).
function PricePreview({ control }: { control: ReturnType<typeof useForm<Values>>["control"] }) {
  const price = Number(useWatch({ control, name: "priceIdr" })) || 0;
  const period = useWatch({ control, name: "period" });
  return (
    <p className="mt-1.5 text-xs text-muted-foreground">
      {price > 0
        ? `Rp ${groupID(price)} / ${period === "year" ? "tahun" : "bulan"}`
        : "0 = harga custom (“Hubungi kami”)."}
    </p>
  );
}
