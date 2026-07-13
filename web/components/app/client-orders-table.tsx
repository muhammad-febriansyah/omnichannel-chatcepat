"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { rupiah } from "@/lib/format";
import { StatusPill, type PillTone } from "@/components/app/status-pill";

export interface ClientOrderRow {
  id: string;
  createdAt: string | Date;
  planName: string;
  amountIdr: number;
  status: string;
  merchantOrderId: string;
}

const ORDER_STATUS: Record<string, { label: string; tone: PillTone }> = {
  paid: { label: "Lunas", tone: "emerald" },
  pending: { label: "Menunggu", tone: "amber" },
  failed: { label: "Gagal", tone: "red" },
  expired: { label: "Kadaluarsa", tone: "red" },
};

function tglWaktu(v: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v));
}

const columns: ColumnDef<ClientOrderRow>[] = [
  {
    accessorKey: "createdAt",
    header: "Tanggal",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{tglWaktu(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "planName",
    header: "Paket",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.planName}</span>,
  },
  {
    accessorKey: "amountIdr",
    header: "Jumlah",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{rupiah(row.original.amountIdr)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const st = ORDER_STATUS[row.original.status] ?? { label: row.original.status, tone: "slate" as PillTone };
      return <StatusPill tone={st.tone}>{st.label}</StatusPill>;
    },
  },
  {
    accessorKey: "merchantOrderId",
    header: "Order ID",
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.merchantOrderId}</span>,
  },
];

export function ClientOrdersTable({ rows }: { rows: ClientOrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari paket / order id…"
      pageSize={10}
      emptyMessage="Belum ada transaksi."
    />
  );
}
