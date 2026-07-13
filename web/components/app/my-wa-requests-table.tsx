"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { WaRequestStatusBadge } from "@/components/app/wa-request-status-badge";
import type { WaRequestRow } from "@/lib/wa-requests";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const columns: ColumnDef<WaRequestRow>[] = [
  {
    accessorKey: "businessName",
    header: "Bisnis",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.businessName}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.phoneNumber}</div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="space-y-1">
        <WaRequestStatusBadge status={row.original.status} />
        {row.original.status === "rejected" && row.original.rejectionReason && (
          <div className="max-w-[220px] truncate text-xs text-danger" title={row.original.rejectionReason}>
            {row.original.rejectionReason}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Diajukan",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
];

export function MyWaRequestsTable({ rows }: { rows: WaRequestRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari pengajuan…"
      pageSize={8}
      emptyMessage="Belum ada pengajuan."
    />
  );
}
