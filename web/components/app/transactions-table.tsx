"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/lib/platform-stats";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  expired: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Dibayar",
  pending: "Menunggu",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "paid", label: "Dibayar" },
  { key: "pending", label: "Menunggu" },
  { key: "failed", label: "Gagal" },
  { key: "expired", label: "Kedaluwarsa" },
];

const columns: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "tenantName",
    header: "Tenant",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.tenantName}</div>
        {row.original.customerName && (
          <div className="truncate text-xs text-muted-foreground">{row.original.customerName}</div>
        )}
      </div>
    ),
  },
  { accessorKey: "planName", header: "Paket", cell: ({ row }) => <span>{row.original.planName}</span> },
  {
    accessorKey: "amountIdr",
    header: "Jumlah",
    cell: ({ row }) => <span className="font-medium tabular-nums">{rupiah(row.original.amountIdr)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[row.original.status] ?? "bg-slate-100 text-slate-600"}`}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </span>
    ),
  },
  {
    accessorKey: "paymentMethod",
    header: "Metode",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.paymentMethod ?? "—"}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Tanggal",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
];

export function TransactionsTable({ rows }: { rows: OrderRow[] }) {
  const [status, setStatus] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (status === "all" ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
              status === f.key
                ? "border-brand-blue bg-blue-50 text-brand-navy dark:bg-blue-500/10 dark:text-blue-300"
                : "border-border text-muted-foreground hover:border-brand-blue/40 hover:text-foreground",
            )}
          >
            {f.label}
            <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Cari tenant / paket…"
        pageSize={12}
        emptyMessage="Belum ada transaksi."
      />
    </div>
  );
}
