"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/app/status-pill";
import type { PlatformDashboard } from "@/lib/platform-dashboard";

type OrderRow = PlatformDashboard["recentOrders"][number];

const STATUS: Record<string, { label: string; tone: "emerald" | "amber" | "red" | "slate" }> = {
  paid: { label: "Berhasil", tone: "emerald" },
  pending: { label: "Menunggu", tone: "amber" },
  failed: { label: "Gagal", tone: "red" },
  expired: { label: "Kedaluwarsa", tone: "slate" },
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));

const columns: ColumnDef<OrderRow>[] = [
  { accessorKey: "createdAt", header: "Tanggal", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.createdAt)}</span> },
  { accessorKey: "tenant", header: "Tenant", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.tenant}</span> },
  {
    accessorKey: "kind",
    header: "Jenis",
    cell: ({ row }) =>
      row.original.kind === "ai_topup" ? <StatusPill tone="violet">Top-up AI</StatusPill> : <StatusPill tone="blue">Paket</StatusPill>,
  },
  { accessorKey: "item", header: "Item" },
  {
    accessorKey: "amount",
    header: "Nominal",
    cell: ({ row }) => <span className="font-semibold tabular-nums">Rp {row.original.amount.toLocaleString("id-ID")}</span>,
  },
  { accessorKey: "method", header: "Metode", cell: ({ row }) => <span className="text-muted-foreground">{row.original.method ?? "—"}</span> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = STATUS[row.original.status] ?? { label: row.original.status, tone: "slate" as const };
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  },
];

export function AdminRecentOrders({ rows }: { rows: OrderRow[] }) {
  return <DataTable columns={columns} data={rows} pageSize={10} searchPlaceholder="Cari tenant atau item…" emptyMessage="Belum ada transaksi." />;
}
