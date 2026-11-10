"use client";

import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Copy, Loader2 } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { errorMessage } from "@/lib/action-error";
import { rupiah } from "@/lib/format";
import { requestPayout } from "@/lib/referral-actions";

export const fmtDate = (v: string | null) =>
  v ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(v)) : "—";

export function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          gooeyToast.success("Disalin");
        } catch {
          gooeyToast.error("Gagal menyalin");
        }
      }}
    >
      <Copy className="size-3.5" /> {label}
    </Button>
  );
}

export function RequestPayoutButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          try {
            await requestPayout();
            gooeyToast.success("Penarikan diajukan. Admin akan memproses transfer.");
          } catch (e) {
            gooeyToast.error(errorMessage(e) ?? "Gagal mengajukan penarikan");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />} Tarik saldo
    </Button>
  );
}

// --- Tables ---

export interface ReferredRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  convertedAt: string | null;
}

const REFERRAL_STATUS: Record<string, { label: string; tone: PillTone }> = {
  pending: { label: "Belum bayar", tone: "amber" },
  converted: { label: "Sudah bayar", tone: "emerald" },
  void: { label: "Batal", tone: "red" },
};

const referredColumns: ColumnDef<ReferredRow>[] = [
  { accessorKey: "name", header: "Bisnis", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: "createdAt", header: "Daftar", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = REFERRAL_STATUS[row.original.status] ?? { label: row.original.status, tone: "slate" as PillTone };
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  },
];

export function ReferredTable({ rows }: { rows: ReferredRow[] }) {
  return <DataTable columns={referredColumns} data={rows} pageSize={10} searchPlaceholder="Cari bisnis…" emptyMessage="Belum ada yang daftar pakai kode Anda." />;
}

export interface CommissionRow {
  id: string;
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

export function commissionState(r: Pick<CommissionRow, "status" | "inPayout" | "availableAt">): { label: string; tone: PillTone } {
  if (r.status === "paid") return { label: "Dibayar", tone: "emerald" };
  if (r.status === "void") return { label: "Dibatalkan", tone: "red" };
  if (r.inPayout) return { label: "Diproses", tone: "violet" };
  if (new Date(r.availableAt).getTime() > Date.now()) return { label: `Tertahan s/d ${fmtDate(r.availableAt)}`, tone: "amber" };
  return { label: "Bisa ditarik", tone: "blue" };
}

const commissionColumns: ColumnDef<CommissionRow>[] = [
  { accessorKey: "createdAt", header: "Tanggal", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  {
    accessorKey: "referredName",
    header: "Dari",
    cell: ({ row }) => (
      <span>
        <span className="font-medium">{row.original.referredName}</span>
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
];

export function CommissionsTable({ rows }: { rows: CommissionRow[] }) {
  return <DataTable columns={commissionColumns} data={rows} pageSize={10} searchable={false} emptyMessage="Belum ada komisi." />;
}

export interface PayoutRow {
  id: string;
  amountIdr: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export const PAYOUT_STATUS: Record<string, { label: string; tone: PillTone }> = {
  requested: { label: "Diproses", tone: "amber" },
  paid: { label: "Ditransfer", tone: "emerald" },
  rejected: { label: "Ditolak", tone: "red" },
};

const payoutColumns: ColumnDef<PayoutRow>[] = [
  { accessorKey: "createdAt", header: "Diajukan", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  { accessorKey: "amountIdr", header: "Jumlah", cell: ({ row }) => <span className="whitespace-nowrap font-semibold tabular-nums">{rupiah(row.original.amountIdr)}</span> },
  {
    accessorKey: "bankName",
    header: "Rekening",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.bankName} · {row.original.accountNumber}
        <span className="block text-xs text-muted-foreground">a.n. {row.original.accountName}</span>
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
];

export function PayoutsTable({ rows }: { rows: PayoutRow[] }) {
  return <DataTable columns={payoutColumns} data={rows} pageSize={10} searchable={false} emptyMessage="Belum ada penarikan." />;
}
