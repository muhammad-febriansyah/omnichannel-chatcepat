"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { cleanIDR } from "@/lib/format";
import { PLAN_LABEL, type TenantPlan } from "@/lib/plan";

export interface TenantTableRow {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: "active" | "suspended";
  channels: number;
  users: number;
  createdAt: string;
}

const PLAN_CLS: Record<string, string> = {
  basic: "bg-slate-50 text-slate-700",
  pro: "bg-blue-50 text-blue-700",
  business: "bg-violet-50 text-violet-700",
  enterprise: "bg-amber-50 text-amber-700",
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const columns: ColumnDef<TenantTableRow>[] = [
  {
    accessorKey: "name",
    header: "Tenant",
    cell: ({ row }) => (
      <Link href={`/admin/tenants/${row.original.id}`} className="flex items-center gap-2.5 hover:opacity-80">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-bold text-white">
          {row.original.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-blue">{row.original.name}</div>
          <div className="truncate text-xs text-muted-foreground">/{row.original.slug}</div>
        </div>
      </Link>
    ),
  },
  {
    accessorKey: "plan",
    header: "Paket",
    cell: ({ row }) => (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLAN_CLS[row.original.plan] ?? "bg-slate-100"}`}>
        {PLAN_LABEL[row.original.plan]}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${row.original.status === "active" ? "text-success" : "text-danger"}`}>
        <span className={`size-1.5 rounded-full ${row.original.status === "active" ? "bg-success" : "bg-danger"}`} />
        {row.original.status === "active" ? "Aktif" : "Disuspend"}
      </span>
    ),
  },
  {
    accessorKey: "channels",
    header: "Channel",
    cell: ({ row }) => <span className="text-muted-foreground">{cleanIDR(row.original.channels)}</span>,
  },
  {
    accessorKey: "users",
    header: "User",
    cell: ({ row }) => <span className="text-muted-foreground">{cleanIDR(row.original.users)}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Dibuat",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
];

export function TenantsTable({ rows }: { rows: TenantTableRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari tenant…" pageSize={12} emptyMessage="Belum ada tenant." />;
}
