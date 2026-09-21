"use client";

import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { deletePlatformUser } from "@/lib/actions";
import { DeleteButton } from "@/components/app/delete-button";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { roleLabel } from "@/lib/format";
import type { PlatformUserRow } from "@/lib/platform-stats";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  invited: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  disabled: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  invited: "Diundang",
  disabled: "Nonaktif",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function UserDetailDialog({ user }: { user: PlatformUserRow }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="warning" size="sm" aria-label={`Detail ${user.name}`} />}>
        <Eye data-icon="inline-start" /> Detail
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detail pengguna</DialogTitle>
          <DialogDescription>Informasi akun dan workspace pengguna.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Nama</dt>
            <dd className="mt-1 font-semibold text-foreground">{user.name}</dd>
          </div>
          <div className="rounded-lg border border-border p-3 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1 break-all text-sm text-foreground">{user.email}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-medium text-muted-foreground">Tenant</dt>
            <dd className="mt-1 text-sm text-foreground">{user.tenantName ?? "— Platform"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-medium text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm text-foreground">{roleLabel(user.role)}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-medium text-muted-foreground">Status</dt>
            <dd className="mt-1 text-sm text-foreground">{STATUS_LABEL[user.status] ?? user.status}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-medium text-muted-foreground">Terdaftar</dt>
            <dd className="mt-1 text-sm text-foreground">{fmtDateTime(user.createdAt)}</dd>
          </div>
          <div className="rounded-lg border border-border p-3 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Aktif terakhir</dt>
            <dd className="mt-1 text-sm text-foreground">{fmtDateTime(user.lastActiveAt)}</dd>
          </div>
        </dl>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createColumns(): ColumnDef<PlatformUserRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.name}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorFn: (r) => r.tenantName ?? "— Platform",
    id: "tenant",
    header: "Tenant",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <span>{roleLabel(row.original.role)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[row.original.status] ?? "bg-slate-100 text-slate-600"}`}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </span>
    ),
  },
  {
    accessorKey: "lastActiveAt",
    header: "Aktif Terakhir",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.lastActiveAt)}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Terdaftar",
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
  },
    {
      id: "actions",
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5">
          <UserDetailDialog user={row.original} />
          {row.original.role !== "admin" && (
            <DeleteButton
              onConfirm={() => deletePlatformUser(row.original.id)}
              title="Hapus pengguna?"
              description={
                <>
                  <span className="font-semibold text-foreground">{row.original.name}</span> ({row.original.email}) akan kehilangan akses ke platform.
                </>
              }
              successMessage="Pengguna dihapus"
              triggerLabel="Hapus"
            />
          )}
        </div>
      ),
    },
  ];
}

export function PlatformUsersTable({ rows }: { rows: PlatformUserRow[] }) {
  return (
    <DataTable
      columns={createColumns()}
      data={rows}
      searchPlaceholder="Cari nama / email / tenant…"
      pageSize={15}
      emptyMessage="Belum ada pengguna."
    />
  );
}
