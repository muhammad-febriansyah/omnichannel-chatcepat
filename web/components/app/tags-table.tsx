"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { DeleteButton } from "@/components/app/delete-button";
import { deleteTag } from "@/lib/actions";

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

const columns: ColumnDef<TagRow>[] = [
  {
    accessorKey: "name",
    header: "Tag",
    cell: ({ row }) => {
      const c = row.original.color ?? "#64748b";
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium" style={{ background: `${c}1a`, color: c }}>
          <span className="size-2 rounded-full" style={{ background: c }} />
          {row.original.name}
        </span>
      );
    },
  },
  {
    id: "color",
    accessorFn: (r) => r.color ?? "",
    header: "Warna",
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.color ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/tags/${row.original.id}/edit`}
          aria-label="Edit tag"
          title="Edit"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-brand-blue"
        >
          <Pencil className="size-4" />
        </Link>
        <DeleteButton
          onConfirm={() => deleteTag(row.original.id)}
          title="Hapus tag?"
          description={
            <>
              Tag <span className="font-semibold text-foreground">{row.original.name}</span> akan dihapus. Kontak yang
              sudah ditandai tidak otomatis berubah.
            </>
          }
          successMessage="Tag dihapus"
          triggerLabel="Hapus tag"
        />
      </div>
    ),
  },
];

export function TagsTable({ rows }: { rows: TagRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari tag…" emptyMessage="Belum ada tag. Buat tag pertama." />;
}
