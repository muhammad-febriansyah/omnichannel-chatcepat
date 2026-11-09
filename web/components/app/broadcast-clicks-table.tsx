"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { timeAgo } from "@/lib/format";

export interface ClickRow {
  name: string | null;
  phone: string | null;
  button: string;
  at: string;
}

const columns: ColumnDef<ClickRow>[] = [
  {
    id: "contact",
    accessorFn: (r) => `${r.name ?? ""} ${r.phone ?? ""}`,
    header: "Kontak",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-foreground">{row.original.name || "Tanpa nama"}</div>
        <div className="text-xs text-muted-foreground">{row.original.phone ?? ""}</div>
      </div>
    ),
  },
  {
    accessorKey: "button",
    header: "Tombol",
    cell: ({ row }) => (
      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
        {row.original.button}
      </span>
    ),
  },
  {
    accessorKey: "at",
    header: "Waktu",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{timeAgo(row.original.at)}</span>,
  },
];

export function BroadcastClicksTable({ rows }: { rows: ClickRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari kontak atau tombol…" emptyMessage="Belum ada yang klik." />;
}
