"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
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
      <Link href={`/admin/wa-requests/${row.original.id}`} className="flex min-w-0 flex-col hover:opacity-80">
        <span className="truncate font-medium text-brand-blue">{row.original.businessName}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.phoneNumber}</span>
      </Link>
    ),
  },
  {
    accessorKey: "tenantName",
    header: "Tenant",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.tenantName}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <WaRequestStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Diajukan",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
  {
    id: "action",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/admin/wa-requests/${row.original.id}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
      >
        Tinjau <ChevronRight className="size-3.5" />
      </Link>
    ),
  },
];

export function WaRequestsTable({ rows }: { rows: WaRequestRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari bisnis / tenant…"
      pageSize={12}
      emptyMessage="Belum ada pengajuan."
    />
  );
}
