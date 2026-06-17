"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, ArrowLeft, User, Phone, ShieldCheck, Tags } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createContact, updateContact } from "@/lib/actions";

const schema = z
  .object({
    name: z.string().trim().max(120, "Nama maksimal 120 karakter").optional().or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(32, "Nomor maksimal 32 karakter")
      .regex(/^[0-9+\-\s]*$/, "Nomor hanya boleh angka, +, -, spasi")
      .optional()
      .or(z.literal("")),
    optInStatus: z.enum(["opted_in", "opted_out", "unknown"]),
    tags: z.string().optional(),
  })
  .refine((d) => (d.name && d.name.trim()) || (d.phone && d.phone.trim()), {
    message: "Nama atau nomor telepon wajib diisi",
    path: ["name"],
  });

type Values = z.infer<typeof schema>;

export interface ContactInitial {
  name: string;
  phone: string;
  optInStatus: "opted_in" | "opted_out" | "unknown";
  tags: string[];
}

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

export function ContactForm({
  mode,
  contactId,
  initial,
}: {
  mode: "create" | "edit";
  contactId?: string;
  initial?: ContactInitial;
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
      phone: initial?.phone ?? "",
      optInStatus: initial?.optInStatus ?? "unknown",
      tags: (initial?.tags ?? []).join(", "),
    },
  });

  function onSubmit(v: Values) {
    const payload = {
      name: v.name ?? "",
      phone: v.phone ?? "",
      optInStatus: v.optInStatus,
      tags: (v.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    };
    start(async () => {
      try {
        if (mode === "edit" && contactId) await updateContact(contactId, payload);
        else await createContact(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan kontak";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </Link>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{mode === "edit" ? "Edit Kontak" : "Kontak Baru"}</CardTitle>
            <CardDescription>
              {mode === "edit" ? "Perbarui data kontak di workspace kamu." : "Tambahkan kontak baru ke workspace kamu."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Identitas */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identitas</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                    Nama
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="name" {...register("name")} placeholder="Budi Santoso" className={inputCls} />
                  </div>
                  {errors.name && <p className="mt-1.5 text-xs font-medium text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
                    Nomor Telepon
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="phone" {...register("phone")} inputMode="tel" placeholder="628123456789" className={inputCls} />
                  </div>
                  {errors.phone && <p className="mt-1.5 text-xs font-medium text-danger">{errors.phone.message}</p>}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Isi minimal salah satu: nama atau nomor telepon.</p>
            </div>

            {/* Consent & segmentasi */}
            <div className="border-t border-border pt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Consent &amp; Segmentasi
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="optInStatus" className="mb-1.5 block text-sm font-medium text-foreground">
                    Status Opt-in
                  </label>
                  <div className="relative">
                    <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select id="optInStatus" {...register("optInStatus")} className={`${inputCls} pr-8`}>
                      <option value="unknown">Belum diketahui</option>
                      <option value="opted_in">Opted-in (boleh broadcast)</option>
                      <option value="opted_out">Opted-out (jangan broadcast)</option>
                    </select>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Set <b>Opted-in</b> hanya jika kontak benar-benar setuju dihubungi.
                  </p>
                </div>
                <div>
                  <label htmlFor="tags" className="mb-1.5 block text-sm font-medium text-foreground">
                    Tag
                  </label>
                  <div className="relative">
                    <Tags className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="tags" {...register("tags")} placeholder="vip, jakarta, reseller" className={inputCls} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Pisahkan dengan koma.</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <Link
              href="/contacts"
              className="flex h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Kontak"}
            </button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
