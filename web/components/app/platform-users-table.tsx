"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { roleLabel } from "@/lib/format";
import type { PlatformUserRow } from "@/lib/platform-stats";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  invited: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  disabled: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  invited: "Diundang",
  disabled: "Nonaktif",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const columns: ColumnDef<PlatformUserRow>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.name}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorFn: (r) => r.tenantName ?? "— Platform",
    id: "tenant",
    header: "Tenant",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <span>{roleLabel(row.original.role)}</span>,
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
    accessorKey: "lastActiveAt",
    header: "Aktif Terakhir",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.lastActiveAt)}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Terdaftar",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
];

export function PlatformUsersTable({ rows }: { rows: PlatformUserRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari nama / email / tenant…"
      pageSize={15}
      emptyMessage="Belum ada pengguna."
    />
  );
}
