"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { cleanIDR } from "@/lib/format";

export interface BroadcastRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  total: number;
  skipped: number;
}

const STATUS_TONE: Record<string, "blue" | "amber" | "emerald" | "red" | "slate"> = {
  draft: "slate",
  scheduled: "blue",
  running: "amber",
  done: "emerald",
  failed: "red",
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
      <StatusPill tone={STATUS_TONE[row.original.status] ?? "slate"}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </StatusPill>
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
