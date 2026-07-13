"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestWaOfficial } from "@/lib/wa-request-actions";

const schema = z.object({
  businessName: z.string().trim().min(1, "Nama bisnis wajib diisi").max(120, "Maksimal 120 karakter"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Nomor WhatsApp wajib diisi")
    .regex(/^[\d+][\d\s-]{7,}$/, "Nomor tidak valid (contoh: 628123456789)"),
  contactName: z.string().trim().max(120, "Maksimal 120 karakter").optional().or(z.literal("")),
  notes: z.string().trim().max(500, "Maksimal 500 karakter").optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

export function WaRequestForm() {
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { businessName: "", phoneNumber: "", contactName: "", notes: "" },
  });

  function onSubmit(v: Values) {
    start(async () => {
      try {
        await requestWaOfficial({
          businessName: v.businessName,
          phoneNumber: v.phoneNumber,
          contactName: v.contactName || undefined,
          notes: v.notes || undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal mengirim pengajuan";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Ajukan WhatsApp Official</CardTitle>
          <CardDescription>
            Nomor WhatsApp Official di-onboard oleh tim kami. Isi data di bawah, tim akan menyiapkan &amp;
            menghubungkan nomormu. Statusnya bisa kamu pantau di daftar bawah.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="businessName" className="mb-1.5 block text-sm font-medium text-foreground">
                Nama Bisnis
              </label>
              <input id="businessName" {...register("businessName")} placeholder="Toko Maju Jaya" className={inputCls} />
              {errors.businessName && (
                <p className="mt-1.5 text-xs font-medium text-danger">{errors.businessName.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="phoneNumber" className="mb-1.5 block text-sm font-medium text-foreground">
                Nomor WhatsApp
              </label>
              <input id="phoneNumber" {...register("phoneNumber")} placeholder="628123456789" className={inputCls} />
              {errors.phoneNumber && (
                <p className="mt-1.5 text-xs font-medium text-danger">{errors.phoneNumber.message}</p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Nomor akan lepas dari aplikasi WhatsApp biasa saat jadi Official. Pakai nomor khusus.
              </p>
            </div>
            <div>
              <label htmlFor="contactName" className="mb-1.5 block text-sm font-medium text-foreground">
                Nama PIC <span className="font-normal text-muted-foreground">(opsional)</span>
              </label>
              <input id="contactName" {...register("contactName")} placeholder="Budi" className={inputCls} />
              {errors.contactName && (
                <p className="mt-1.5 text-xs font-medium text-danger">{errors.contactName.message}</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">
              Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              id="notes"
              {...register("notes")}
              rows={2}
              placeholder="Info tambahan untuk tim onboarding."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
            />
            {errors.notes && <p className="mt-1.5 text-xs font-medium text-danger">{errors.notes.message}</p>}
          </div>
        </CardContent>

        <CardFooter className="justify-end border-t border-border">
          <Button type="submit" size="lg" disabled={pending} className="px-5">
            <Send className="size-4" /> {pending ? "Mengirim…" : "Kirim Pengajuan"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
