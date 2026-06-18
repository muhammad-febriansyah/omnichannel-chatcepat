"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { DeleteButton } from "@/components/app/delete-button";
import { EditButton } from "@/components/app/action-button";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { deleteContact } from "@/lib/actions";
import { initials } from "@/lib/format";

export interface ContactRow {
  id: string;
  name: string | null;
  phone: string | null;
  optInStatus: "opted_in" | "opted_out" | "unknown";
  optInSource: string | null;
  tags: string[];
}

const OPTIN: Record<string, { label: string; tone: PillTone }> = {
  opted_in: { label: "Opted-in", tone: "emerald" },
  opted_out: { label: "Opted-out", tone: "red" },
  unknown: { label: "Unknown", tone: "slate" },
};

const columns: ColumnDef<ContactRow>[] = [
  {
    accessorFn: (r) => r.name ?? "",
    id: "name",
    header: "Nama",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-semibold text-white">
          {initials(row.original.name)}
        </div>
        <span className="font-medium">{row.original.name ?? "—"}</span>
      </div>
    ),
  },
  {
    accessorFn: (r) => r.phone ?? "",
    id: "phone",
    header: "Telepon",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.phone ?? "—"}</span>,
  },
  {
    accessorKey: "optInStatus",
    header: "Opt-in",
    cell: ({ row }) => {
      const o = OPTIN[row.original.optInStatus] ?? OPTIN.unknown;
      return <StatusPill tone={o.tone}>{o.label}</StatusPill>;
    },
  },
  {
    accessorFn: (r) => r.optInSource ?? "",
    id: "optInSource",
    header: "Sumber",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.optInSource ?? "—"}</span>,
  },
  {
    id: "tags",
    header: "Tag",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1.5">
        <EditButton href={`/contacts/${row.original.id}/edit`} />
        <DeleteButton
          onConfirm={() => deleteContact(row.original.id)}
          title="Hapus kontak?"
          description={
            <>
              Kontak <span className="font-semibold text-foreground">{row.original.name ?? row.original.phone ?? "ini"}</span> akan
              dihapus permanen beserta riwayatnya.
            </>
          }
          successMessage="Kontak dihapus"
        />
      </div>
    ),
  },
];

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari nama atau telepon…" emptyMessage="Belum ada kontak. Tambah atau import dulu." />;
}
