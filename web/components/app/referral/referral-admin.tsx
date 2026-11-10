"use client";

import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { RupiahInput } from "@/components/app/rupiah-input";
import { CopyButton, PAYOUT_STATUS, commissionState, fmtDate } from "@/components/app/referral/referral-client";
import { errorMessage } from "@/lib/action-error";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markPayoutPaid,
  rejectPayout,
  saveReferralSettings,
  voidCommission,
  type ReferralSettingsInput,
} from "@/lib/referral-actions";

// Confirmation dialog for an admin action; optionally asks for a reason first.
function ConfirmAction({
  trigger,
  tone,
  title,
  description,
  confirmLabel,
  reasonLabel,
  successMessage,
  onConfirm,
}: {
  trigger: React.ReactNode;
  tone: "success" | "danger";
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  successMessage: string;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function confirm() {
    if (reasonLabel && !reason.trim()) return gooeyToast.error(`${reasonLabel} wajib diisi`);
    start(async () => {
      try {
        await onConfirm(reason);
        gooeyToast.success(successMessage);
        setOpen(false);
        setReason("");
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal memproses");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium transition-colors",
          tone === "success" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300" : "bg-destructive/10 text-destructive hover:bg-destructive/20",
        )}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reasonLabel && (
          <div>
            <label htmlFor="reason" className="mb-1.5 block text-sm font-medium">
              {reasonLabel}
            </label>
            <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 text-sm" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={cn(buttonVariants({ variant: tone === "danger" ? "destructive" : "default" }), "gap-2")}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Payouts ---

export interface AdminPayoutRow {
  id: string;
  tenantName: string;
  amountIdr: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

const payoutColumns: ColumnDef<AdminPayoutRow>[] = [
  { accessorKey: "createdAt", header: "Diajukan", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  { accessorKey: "tenantName", header: "Tenant", cell: ({ row }) => <span className="font-medium">{row.original.tenantName}</span> },
  { accessorKey: "amountIdr", header: "Jumlah", cell: ({ row }) => <span className="whitespace-nowrap font-semibold tabular-nums">{rupiah(row.original.amountIdr)}</span> },
  {
    accessorKey: "accountNumber",
    header: "Rekening",
    cell: ({ row }) => (
      <span className="flex items-center gap-2 text-sm">
        <span>
          {row.original.bankName} · <span className="tabular-nums">{row.original.accountNumber}</span>
          <span className="block text-xs text-muted-foreground">a.n. {row.original.accountName}</span>
        </span>
        {row.original.status === "requested" && <CopyButton value={row.original.accountNumber} label="Salin" />}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = PAYOUT_STATUS[row.original.status] ?? { label: row.original.status, tone: "slate" as PillTone };
      return (
        <span>
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          {row.original.processedAt && <span className="mt-0.5 block text-xs text-muted-foreground">{fmtDate(row.original.processedAt)}</span>}
          {row.original.note && <span className="mt-0.5 block text-xs text-muted-foreground">{row.original.note}</span>}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const p = row.original;
      if (p.status !== "requested") return null;
      return (
        <div className="flex justify-end gap-1.5">
          <ConfirmAction
            tone="success"
            trigger={
              <>
                <CheckCircle2 className="size-3.5" /> Sudah transfer
              </>
            }
            title="Tandai sudah ditransfer?"
            description={`Pastikan ${rupiah(p.amountIdr)} sudah masuk ke ${p.bankName} ${p.accountNumber} a.n. ${p.accountName}. Status tidak bisa dikembalikan.`}
            confirmLabel="Ya, sudah transfer"
            successMessage="Penarikan ditandai lunas"
            onConfirm={() => markPayoutPaid(p.id)}
          />
          <ConfirmAction
            tone="danger"
            trigger={
              <>
                <XCircle className="size-3.5" /> Tolak
              </>
            }
            title="Tolak penarikan?"
            description="Komisi kembali ke saldo tenant dan bisa diajukan ulang. Alasan terlihat oleh tenant."
            reasonLabel="Alasan penolakan"
            confirmLabel="Tolak"
            successMessage="Penarikan ditolak"
            onConfirm={(reason) => rejectPayout(p.id, reason)}
          />
        </div>
      );
    },
  },
];

export function AdminPayoutsTable({ rows }: { rows: AdminPayoutRow[] }) {
  return <DataTable columns={payoutColumns} data={rows} pageSize={20} searchPlaceholder="Cari tenant…" emptyMessage="Belum ada penarikan." />;
}

// --- Commissions ---

export interface AdminCommissionRow {
  id: string;
  referrerName: string;
  referredName: string;
  planName: string;
  orderAmountIdr: number;
  commissionPercent: number;
  commissionIdr: number;
  status: string;
  inPayout: boolean;
  availableAt: string;
  createdAt: string;
  voidReason: string | null;
}

const commissionColumns: ColumnDef<AdminCommissionRow>[] = [
  { accessorKey: "createdAt", header: "Tanggal", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  { accessorKey: "referrerName", header: "Perujuk", cell: ({ row }) => <span className="font-medium">{row.original.referrerName}</span> },
  {
    accessorKey: "referredName",
    header: "Pelanggan baru",
    cell: ({ row }) => (
      <span>
        {row.original.referredName}
        <span className="block text-xs text-muted-foreground">{row.original.planName}</span>
      </span>
    ),
  },
  {
    accessorKey: "commissionIdr",
    header: "Komisi",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        <span className="font-semibold">{rupiah(row.original.commissionIdr)}</span>
        <span className="block text-xs text-muted-foreground">
          {row.original.commissionPercent}% × {rupiah(row.original.orderAmountIdr)}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = commissionState(row.original);
      return (
        <span>
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          {row.original.voidReason && <span className="mt-0.5 block text-xs text-muted-foreground">{row.original.voidReason}</span>}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const c = row.original;
      if (c.status !== "earned" || c.inPayout) return null;
      return (
        <div className="flex justify-end">
          <ConfirmAction
            tone="danger"
            trigger={
              <>
                <Ban className="size-3.5" /> Batalkan
              </>
            }
            title="Batalkan komisi?"
            description={`Komisi ${rupiah(c.commissionIdr)} untuk ${c.referrerName} tidak akan bisa ditarik. Pakai ini bila pembayaran direfund atau curang.`}
            reasonLabel="Alasan pembatalan"
            confirmLabel="Batalkan komisi"
            successMessage="Komisi dibatalkan"
            onConfirm={(reason) => voidCommission(c.id, reason)}
          />
        </div>
      );
    },
  },
];

export function AdminCommissionsTable({ rows }: { rows: AdminCommissionRow[] }) {
  return <DataTable columns={commissionColumns} data={rows} pageSize={20} searchPlaceholder="Cari tenant…" emptyMessage="Belum ada komisi." />;
}

// --- Settings ---

const settingsSchema = z.object({
  isEnabled: z.boolean(),
  commissionPercent: z.coerce.number({ message: "Isi angka" }).int("Harus bilangan bulat").min(0, "Minimal 0").max(100, "Maksimal 100"),
  holdDays: z.coerce.number({ message: "Isi angka" }).int("Harus bilangan bulat").min(0, "Minimal 0").max(365, "Maksimal 365"),
  minPayoutIdr: z.number({ message: "Isi nominal" }).int().min(0, "Tidak boleh negatif"),
});

type SettingsValues = z.input<typeof settingsSchema>;

export function ReferralSettingsForm({ initial }: { initial: ReferralSettingsInput }) {
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsValues, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues: initial });

  function onSubmit(v: z.output<typeof settingsSchema>) {
    start(async () => {
      try {
        await saveReferralSettings(v);
        gooeyToast.success("Pengaturan referral disimpan");
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menyimpan");
      }
    });
  }

  const err = (m?: string) => (m ? <p className="mt-1.5 text-xs font-medium text-danger">{m}</p> : null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pengaturan program</CardTitle>
          <CardDescription>Perubahan hanya berlaku untuk komisi baru. Komisi yang sudah tercatat tidak berubah.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <label htmlFor="isEnabled" className="cursor-pointer">
              <span className="block text-sm font-medium">Program aktif</span>
              <span className="block text-xs text-muted-foreground">Kalau mati, kode referral tidak dicatat saat daftar dan tenant tidak bisa membuat kode baru.</span>
            </label>
            <Controller control={control} name="isEnabled" render={({ field }) => <Switch id="isEnabled" checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="commissionPercent" className="mb-1.5 block text-sm font-medium">
                Komisi (%)
              </label>
              <Input id="commissionPercent" inputMode="numeric" {...register("commissionPercent")} className="h-10 tabular-nums" />
              <p className="mt-1.5 text-xs text-muted-foreground">Dari pembayaran paket pertama.</p>
              {err(errors.commissionPercent?.message)}
            </div>
            <div>
              <label htmlFor="holdDays" className="mb-1.5 block text-sm font-medium">
                Masa tahan (hari)
              </label>
              <Input id="holdDays" inputMode="numeric" {...register("holdDays")} className="h-10 tabular-nums" />
              <p className="mt-1.5 text-xs text-muted-foreground">Jeda sebelum komisi bisa ditarik.</p>
              {err(errors.holdDays?.message)}
            </div>
            <div>
              <label htmlFor="minPayoutIdr" className="mb-1.5 block text-sm font-medium">
                Minimal penarikan
              </label>
              <Controller
                control={control}
                name="minPayoutIdr"
                render={({ field }) => <RupiahInput id="minPayoutIdr" value={field.value ?? null} onChange={(v) => field.onChange(v ?? 0)} className="h-10" />}
              />
              {err(errors.minPayoutIdr?.message)}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
