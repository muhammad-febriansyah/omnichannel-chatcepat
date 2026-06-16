"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { initials } from "@/lib/format";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isSelf: boolean;
}

const ROLE: Record<string, { label: string; cls: string }> = {
  super_admin: { label: "Super Admin", cls: "bg-violet-50 text-violet-700" },
  admin: { label: "Admin", cls: "bg-blue-50 text-blue-700" },
  supervisor: { label: "Supervisor", cls: "bg-amber-50 text-amber-700" },
  agent: { label: "Agent", cls: "bg-slate-100 text-slate-600" },
};
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "text-success" },
  invited: { label: "Diundang", cls: "text-brand-blue" },
  disabled: { label: "Nonaktif", cls: "text-muted-foreground" },
};

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-semibold text-white">
          {initials(row.original.name)}
        </div>
        <span className="font-medium">
          {row.original.name}
          {row.original.isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(kamu)</span>}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const r = ROLE[row.original.role] ?? ROLE.agent;
      return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.cls}`}>{r.label}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = STATUS[row.original.status] ?? STATUS.disabled;
      return (
        <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${s.cls}`}>
          <span className={`size-1.5 rounded-full ${row.original.status === "active" ? "bg-success" : row.original.status === "invited" ? "bg-brand-blue" : "bg-muted-foreground"}`} />
          {s.label}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/settings/users/${row.original.id}/edit`}
          aria-label="Edit user"
          title="Edit"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-brand-blue"
        >
          <Pencil className="size-4" />
        </Link>
        {!row.original.isSelf && (
          <Link
            href={`/settings/users/${row.original.id}/delete`}
            aria-label="Hapus user"
            title="Hapus"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </Link>
        )}
      </div>
    ),
  },
];

export function UsersTable({ rows }: { rows: UserRow[] }) {
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari nama atau email…" emptyMessage="Belum ada anggota tim." />;
}
