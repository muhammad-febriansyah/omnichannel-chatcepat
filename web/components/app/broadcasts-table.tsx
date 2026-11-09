"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MousePointerClick, Workflow } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { ChannelBadge } from "@/components/app/channel-icon";
import { cleanIDR, type ChannelType } from "@/lib/format";

export interface BroadcastRow {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelType: string;
  flowId: string | null;
  flowName: string | null;
  when: string; // scheduled time, else created time
  sent: number;
  total: number;
  skipped: number;
  clicks: number;
  error: string | null;
}

const BROADCAST_STATUS: Record<string, { label: string; tone: "blue" | "amber" | "emerald" | "red" | "slate" }> = {
  draft: { label: "Draf", tone: "slate" },
  scheduled: { label: "Terjadwal", tone: "blue" },
  running: { label: "Mengirim", tone: "amber" },
  done: { label: "Selesai", tone: "emerald" },
  failed: { label: "Gagal", tone: "red" },
  cancelled: { label: "Dibatalkan", tone: "slate" },
};

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

const columns: ColumnDef<BroadcastRow>[] = [
  {
    accessorKey: "name",
    header: "Broadcast",
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="min-w-0">
          <Link href={`/broadcasts/${r.id}`} className="font-medium text-brand-blue hover:underline">
            {r.name}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {r.channelType && <ChannelBadge type={r.channelType as ChannelType} size="sm" />}
            <span className="truncate">{r.channel}</span>
            {r.flowId && (
              <Link href={`/flows/${r.flowId}`} className="inline-flex items-center gap-1 hover:text-brand-blue">
                · <Workflow className="size-3" /> {r.flowName}
              </Link>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = BROADCAST_STATUS[row.original.status];
      return (
        <div>
          <StatusPill tone={s?.tone ?? "slate"}>{s?.label ?? row.original.status}</StatusPill>
          {row.original.error && <p className="mt-1 max-w-[220px] truncate text-[11px] text-red-600" title={row.original.error}>{row.original.error}</p>}
        </div>
      );
    },
  },
  {
    accessorKey: "when",
    header: "Waktu kirim",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtWhen(row.original.when)} WIB</span>,
  },
  {
    id: "sent",
    accessorFn: (r) => r.sent,
    header: "Terkirim",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        <b className="text-foreground">{cleanIDR(row.original.sent)}</b> / {cleanIDR(row.original.total)}
        {row.original.skipped > 0 && <span className="block text-[11px]">{cleanIDR(row.original.skipped)} opt-out dilewati</span>}
      </span>
    ),
  },
  {
    accessorKey: "clicks",
    header: "Klik tombol",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
        <MousePointerClick className="size-3.5 text-indigo-500" /> {cleanIDR(row.original.clicks)}
      </span>
    ),
  },
];

export function BroadcastsTable({ rows }: { rows: BroadcastRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari broadcast…" emptyMessage="Belum ada broadcast." />;
}
