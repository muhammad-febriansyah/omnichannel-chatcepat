"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { DeleteButton } from "@/components/app/delete-button";
import { EditButton } from "@/components/app/action-button";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { deletePlan } from "@/lib/billing-actions";
import { rupiah } from "@/lib/format";

export interface PlanRow {
  id: string;
  name: string;
  slug: string;
  tier: string;
  priceIdr: number;
  period: string;
  quota: number | null;
  isActive: boolean;
  highlight: boolean;
}

const TIER_LABEL: Record<string, string> = { basic: "Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };
const TIER_TONE: Record<string, PillTone> = { basic: "slate", pro: "blue", business: "amber", enterprise: "emerald" };

const columns: ColumnDef<PlanRow>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-foreground">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.slug}</div>
      </div>
    ),
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => (
      <StatusPill tone={TIER_TONE[row.original.tier] ?? "slate"}>{TIER_LABEL[row.original.tier] ?? row.original.tier}</StatusPill>
    ),
  },
  {
    accessorKey: "priceIdr",
    header: "Harga",
    cell: ({ row }) =>
      row.original.priceIdr > 0 ? (
        <span className="font-medium text-foreground">{rupiah(row.original.priceIdr)}</span>
      ) : (
        <span className="text-muted-foreground">Hubungi kami</span>
      ),
  },
  {
    accessorKey: "period",
    header: "Periode",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.period === "year" ? "Tahunan" : "Bulanan"}</span>,
  },
  {
    accessorKey: "quota",
    header: "Kuota",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.quota == null ? "Unlimited" : row.original.quota.toLocaleString("id-ID")}
      </span>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <StatusPill tone={row.original.isActive ? "emerald" : "slate"}>{row.original.isActive ? "Aktif" : "Nonaktif"}</StatusPill>
    ),
  },
  {
    accessorKey: "highlight",
    header: "Highlight",
    cell: ({ row }) =>
      row.original.highlight ? <StatusPill tone="amber">Populer</StatusPill> : <span className="text-muted-foreground">—</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1.5">
        <EditButton href={`/admin/plans/${row.original.id}/edit`} />
        <DeleteButton
          onConfirm={() => deletePlan(row.original.id)}
          title="Hapus paket?"
          description={
            <>
              Paket <b>{row.original.name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </>
          }
          successMessage="Paket dihapus"
        />
      </div>
    ),
  },
];

export function PlansTable({ rows }: { rows: PlanRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari paket…" emptyMessage="Belum ada paket." />;
}
