"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { timeAgo } from "@/lib/format";
import type { AuditRow } from "@/lib/platform-stats";

// Label Indonesia + warna per action (client-safe; ikon dilepas biar rapih di tabel).
const ACTION_META: Record<string, { label: string; tone: string }> = {
  "tenant.suspend": { label: "Suspend tenant", tone: "#ef4444" },
  "tenant.activate": { label: "Aktifkan tenant", tone: "#10b981" },
  "impersonate.start": { label: "Masuk sebagai tenant", tone: "#3b82f6" },
  "plan.create": { label: "Buat paket", tone: "#8b5cf6" },
  "plan.update": { label: "Ubah paket", tone: "#f59e0b" },
  "plan.delete": { label: "Hapus paket", tone: "#ef4444" },
  "platform.settings_update": { label: "Ubah pengaturan platform", tone: "#6366f1" },
  "wa_request.create": { label: "Ajukan WhatsApp Official", tone: "#0ea5e9" },
  "wa_request.approve": { label: "Assign nomor WA Official", tone: "#10b981" },
  "wa_request.reject": { label: "Tolak pengajuan WA", tone: "#ef4444" },
  "wa_request.review": { label: "Tinjau pengajuan WA", tone: "#f59e0b" },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { label: action, tone: "#64748b" };
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

const columns: ColumnDef<AuditRow>[] = [
  {
    id: "action",
    accessorFn: (r) => metaFor(r.action).label,
    header: "Aksi",
    cell: ({ row }) => {
      const m = metaFor(row.original.action);
      return (
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="size-2 shrink-0 rounded-full" style={{ background: m.tone }} />
          {m.label}
        </span>
      );
    },
  },
  {
    id: "target",
    accessorFn: (r) => r.targetLabel ?? r.tenantName ?? r.targetType ?? "",
    header: "Target",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
  },
  {
    id: "actor",
    accessorFn: (r) => r.actorEmail ?? "sistem",
    header: "Aktor",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
  },
  {
    id: "ip",
    accessorFn: (r) => r.ip ?? "",
    header: "IP",
    cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{(getValue() as string) || "—"}</span>,
  },
  {
    id: "time",
    accessorFn: (r) => r.createdAt,
    header: "Waktu",
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <div className="text-sm">{fmtTime(row.original.createdAt)}</div>
        <div className="text-xs text-muted-foreground">{timeAgo(row.original.createdAt)}</div>
      </div>
    ),
  },
];

export function ActivityTable({ rows }: { rows: AuditRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari aksi / target / aktor…"
      pageSize={15}
      emptyMessage="Belum ada aktivitas tercatat."
    />
  );
}
