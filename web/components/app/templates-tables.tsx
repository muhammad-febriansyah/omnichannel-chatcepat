"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { DeleteButton } from "@/components/app/delete-button";
import { EditButton } from "@/components/app/action-button";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { deleteTemplate } from "@/lib/actions";

export interface WaTemplateRow {
  key: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
  channelName: string;
  buttons: number;
}

export interface QuickReplyRow {
  id: string;
  name: string;
  body: string;
}

// Meta review status → display.
const WA_STATUS_TONE: Record<string, PillTone> = {
  APPROVED: "emerald",
  PENDING: "amber",
  REJECTED: "red",
  PAUSED: "amber",
  DISABLED: "slate",
};
const WA_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING: "Menunggu Meta",
  REJECTED: "Ditolak",
  PAUSED: "Dijeda",
  DISABLED: "Nonaktif",
};

const waColumns: ColumnDef<WaTemplateRow>[] = [
  {
    accessorKey: "name",
    header: "Template",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[420px]">
        <div className="truncate font-medium text-foreground">{row.original.name}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.body}</div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Kategori",
    cell: ({ row }) => <StatusPill tone="slate">{row.original.category || "—"}</StatusPill>,
  },
  { accessorKey: "language", header: "Bahasa", cell: ({ row }) => <span className="text-muted-foreground">{row.original.language}</span> },
  {
    accessorKey: "buttons",
    header: "Tombol",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.buttons || "—"}</span>,
  },
  { accessorKey: "channelName", header: "Channel", cell: ({ row }) => <span className="text-muted-foreground">{row.original.channelName}</span> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusPill tone={WA_STATUS_TONE[row.original.status] ?? "slate"}>
        {WA_STATUS_LABEL[row.original.status] ?? row.original.status}
      </StatusPill>
    ),
  },
];

const quickColumns: ColumnDef<QuickReplyRow>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: "body",
    header: "Isi",
    cell: ({ row }) => <span className="line-clamp-1 max-w-[520px] text-muted-foreground">{row.original.body}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1.5">
        <EditButton href={`/templates/${row.original.id}/edit`} />
        <DeleteButton
          onConfirm={() => deleteTemplate(row.original.id)}
          title="Hapus template?"
          description={
            <>
              Template <span className="font-semibold text-foreground">{row.original.name}</span> akan dihapus permanen.
            </>
          }
          successMessage="Template dihapus"
        />
      </div>
    ),
  },
];

export function WaTemplatesTable({ rows }: { rows: WaTemplateRow[] }) {
  return (
    <DataTable
      columns={waColumns}
      data={rows}
      searchPlaceholder="Cari template WhatsApp…"
      emptyMessage="Belum ada template WhatsApp. Buat lewat “Template Baru” → Template WhatsApp."
    />
  );
}

export function QuickRepliesTable({ rows }: { rows: QuickReplyRow[] }) {
  return <DataTable columns={quickColumns} data={rows} searchPlaceholder="Cari balasan cepat…" emptyMessage="Belum ada balasan cepat." />;
}
