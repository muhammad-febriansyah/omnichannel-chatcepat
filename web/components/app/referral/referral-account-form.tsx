"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building2, CreditCard, Gift, Save, User } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionLink } from "@/components/app/action-link";
import { errorMessage } from "@/lib/action-error";
import { saveReferralAccount, type ReferralAccountInput } from "@/lib/referral-actions";

const schema = z
  .object({
    code: z
      .string()
      .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
      .pipe(z.string().min(4, "Kode minimal 4 karakter").max(20, "Kode maksimal 20 karakter")),
    bankName: z.string().trim().max(60, "Nama bank terlalu panjang"),
    accountNumber: z
      .string()
      .transform((s) => s.replace(/[^0-9]/g, ""))
      .pipe(z.string().refine((s) => s === "" || (s.length >= 5 && s.length <= 30), "Nomor rekening tidak valid")),
    accountName: z.string().trim().max(100, "Nama terlalu panjang"),
  })
  .refine((v) => !(v.bankName || v.accountNumber || v.accountName) || (v.bankName && v.accountNumber && v.accountName), {
    message: "Lengkapi nama bank, nomor rekening, dan nama pemilik rekening",
    path: ["accountName"],
  });

type Values = z.input<typeof schema>;

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs font-medium text-danger">{msg}</p> : null;
}

export function ReferralAccountForm({ initial }: { initial: ReferralAccountInput }) {
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: initial });

  function onSubmit(v: z.output<typeof schema>) {
    start(async () => {
      try {
        await saveReferralAccount(v);
      } catch (err) {
        const msg = errorMessage(err) ?? "Gagal menyimpan";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  const iconCls = "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground";

  return (
    <div className="w-full p-6">
      <Link href="/referral" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Referral
      </Link>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Kode & Rekening Referral</CardTitle>
            <CardDescription>Kode dipakai calon pelanggan saat daftar. Rekening dipakai admin untuk transfer komisi.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-foreground">
                Kode referral
              </label>
              <div className="relative">
                <Gift className={iconCls} />
                <Input id="code" {...register("code")} className="h-11 pl-10 font-mono uppercase tracking-wider" aria-invalid={!!errors.code} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">4–20 huruf atau angka. Kalau diganti, link lama tidak berlaku lagi.</p>
              <FieldError msg={errors.code?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bankName" className="mb-1.5 block text-sm font-medium text-foreground">
                  Nama bank / e-wallet
                </label>
                <div className="relative">
                  <Building2 className={iconCls} />
                  <Input id="bankName" {...register("bankName")} placeholder="BCA" className="h-11 pl-10" aria-invalid={!!errors.bankName} />
                </div>
                <FieldError msg={errors.bankName?.message} />
              </div>
              <div>
                <label htmlFor="accountNumber" className="mb-1.5 block text-sm font-medium text-foreground">
                  Nomor rekening
                </label>
                <div className="relative">
                  <CreditCard className={iconCls} />
                  <Input id="accountNumber" inputMode="numeric" {...register("accountNumber")} placeholder="1234567890" className="h-11 pl-10 tabular-nums" aria-invalid={!!errors.accountNumber} />
                </div>
                <FieldError msg={errors.accountNumber?.message} />
              </div>
            </div>

            <div>
              <label htmlFor="accountName" className="mb-1.5 block text-sm font-medium text-foreground">
                Nama pemilik rekening
              </label>
              <div className="relative">
                <User className={iconCls} />
                <Input id="accountName" {...register("accountName")} placeholder="Sesuai buku tabungan" className="h-11 pl-10" aria-invalid={!!errors.accountName} />
              </div>
              <FieldError msg={errors.accountName?.message} />
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <ActionLink href="/referral" variant="outline" className="px-5">
              Batal
            </ActionLink>
            <Button type="submit" size="lg" disabled={pending} className="px-5">
              <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
