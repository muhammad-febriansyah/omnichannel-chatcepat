"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { initials } from "@/lib/format";

export interface ContactRow {
  id: string;
  name: string | null;
  phone: string | null;
  optInStatus: "opted_in" | "opted_out" | "unknown";
  optInSource: string | null;
  tags: string[];
}

const OPTIN: Record<string, { label: string; cls: string }> = {
  opted_in: { label: "Opted-in", cls: "bg-emerald-50 text-emerald-700" },
  opted_out: { label: "Opted-out", cls: "bg-red-50 text-red-700" },
  unknown: { label: "Unknown", cls: "bg-slate-100 text-slate-600" },
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
      return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${o.cls}`}>{o.label}</span>;
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
          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
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
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/contacts/${row.original.id}/edit`}
          aria-label="Edit kontak"
          title="Edit"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-brand-blue"
        >
          <Pencil className="size-4" />
        </Link>
        <Link
          href={`/contacts/${row.original.id}/delete`}
          aria-label="Hapus kontak"
          title="Hapus"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </Link>
      </div>
    ),
  },
];

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari nama atau telepon…" emptyMessage="Belum ada kontak. Tambah atau import dulu." />;
}
