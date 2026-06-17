"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { cleanIDR } from "@/lib/format";

export interface BroadcastRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  total: number;
  skipped: number;
}

const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-50 text-blue-700",
  running: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  scheduled: "Terjadwal",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
};

const columns: ColumnDef<BroadcastRow>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <Link href={`/broadcasts/${row.original.id}`} className="font-medium text-brand-blue hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[row.original.status] ?? "bg-slate-100"}`}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </span>
    ),
  },
  {
    id: "sent",
    accessorFn: (r) => r.sent,
    header: "Terkirim",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {cleanIDR(row.original.sent)} / {cleanIDR(row.original.total)}
      </span>
    ),
  },
  {
    accessorKey: "skipped",
    header: "Skip Opt-out",
    cell: ({ row }) => <span className="text-muted-foreground">{cleanIDR(row.original.skipped)}</span>,
  },
];

export function BroadcastsTable({ rows }: { rows: BroadcastRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari broadcast…" emptyMessage="Belum ada broadcast." />;
}
