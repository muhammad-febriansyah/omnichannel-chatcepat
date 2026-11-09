"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  /** Leading "No" column numbered across pages (1, 2, 3, …). Default on. */
  numbered?: boolean;
  /** Hide the search box (e.g. for tiny tables). */
  searchable?: boolean;
  /** Extra controls next to the search box (filters, export, …). */
  toolbar?: React.ReactNode;
}

const PAGE_SIZES = [10, 25, 50, 100];

// Page buttons around the current page: 1 … 4 5 [6] 7 8 … 20
function pageWindow(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Cari…",
  pageSize = 10,
  emptyMessage = "Tidak ada data.",
  numbered = true,
  searchable = true,
  toolbar,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // The number follows the visible order (after search + sort) and continues across
  // pages, so row 1 on page 2 shows 11 with a page size of 10.
  const allColumns = useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!numbered) return columns;
    const no: ColumnDef<TData, TValue> = {
      id: "__no",
      header: "No",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize: size } = table.getState().pagination;
        const pos = table.getRowModel().rows.findIndex((r) => r.id === row.id);
        return <span className="tabular-nums text-muted-foreground">{pageIndex * size + pos + 1}</span>;
      },
    };
    return [no, ...columns];
  }, [columns, numbered]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const total = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * size + 1;
  const to = Math.min(total, (pageIndex + 1) * size);

  return (
    <div className="space-y-3">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchable ? (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={globalFilter}
                onChange={(e) => {
                  setGlobalFilter(e.target.value);
                  table.setPageIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              {total} data
            </span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b border-border bg-muted/50 hover:bg-muted/50">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                        header.column.id === "__no" && "w-14 text-center",
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1.5 uppercase transition-colors hover:text-foreground",
                            sorted && "text-foreground",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon className={cn("size-3", sorted ? "text-brand-blue" : "opacity-50")} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-brand-blue/[0.04]">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-3", cell.column.id === "__no" && "w-14 text-center")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="h-36 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted">
                      <Inbox className="size-5" />
                    </span>
                    {globalFilter ? `Tidak ada hasil untuk “${globalFilter}”.` : emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZES[0] && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <b className="font-semibold text-foreground">{from}–{to}</b> dari {total}
            </span>
            <select
              value={size}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              aria-label="Baris per halaman"
              className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-brand-blue"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / halaman
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {pageWindow(pageIndex, table.getPageCount()).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1.5">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === pageIndex ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => table.setPageIndex(p)}
                  aria-current={p === pageIndex ? "page" : undefined}
                  className="tabular-nums"
                >
                  {p + 1}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
