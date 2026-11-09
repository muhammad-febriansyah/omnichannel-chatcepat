"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { importFaqs } from "@/lib/knowledge-actions";
import { importProducts } from "@/lib/import-actions";
import { FIELD_LABEL, TEMPLATE_CSV, rowsToFaqs, rowsToProducts, type ImportKind } from "@/lib/table-import";

const COPY: Record<ImportKind, { title: string; back: string; backLabel: string; columns: string; note: string }> = {
  products: {
    title: "Import produk dari Excel",
    back: "/products",
    backLabel: "Produk",
    columns: "Kolom: Nama, Harga (wajib) · Stok, SKU, Kategori, Deskripsi (opsional)",
    note: "Produk dengan SKU yang sudah ada akan diperbarui; sisanya ditambahkan sebagai produk baru (aktif, tanpa foto).",
  },
  faqs: {
    title: "Import tanya-jawab dari Excel",
    back: "/flows?tab=pengetahuan",
    backLabel: "Pengetahuan",
    columns: "Kolom: Pertanyaan, Jawaban",
    note: "Pertanyaan yang sudah ada dilewati.",
  },
};

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

// Upload CSV/Excel → preview the mapped rows → import. Nothing is saved before "Import".
export function TableImport({ kind }: { kind: ImportKind }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const mapped = useMemo(() => {
    if (!table) return null;
    return kind === "products" ? rowsToProducts(table.columns, table.rows) : rowsToFaqs(table.columns, table.rows);
  }, [table, kind]);

  async function read(f: File | null) {
    setFile(f);
    setTable(null);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return gooeyToast.error("File maksimal 10 MB");
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("purpose", kind);
      const res = await fetch("/api/import/table", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { columns?: string[]; rows?: string[][]; error?: string };
      if (!res.ok || !json.columns) throw new Error(json.error ?? "Gagal membaca file");
      setTable({ columns: json.columns, rows: json.rows ?? [] });
    } catch (e) {
      gooeyToast.error(errorMessage(e) ?? "Gagal membaca file");
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV[kind]], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = kind === "products" ? "contoh-produk.csv" : "contoh-tanya-jawab.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function runImport() {
    if (!mapped || mapped.items.length === 0) return;
    start(async () => {
      try {
        if (kind === "products") {
          const r = await importProducts(mapped.items as Parameters<typeof importProducts>[0]);
          gooeyToast.success(`${r.added} produk ditambahkan, ${r.updated} diperbarui`);
        } else {
          const r = await importFaqs(mapped.items as Parameters<typeof importFaqs>[0]);
          gooeyToast.success(`${r.added} tanya-jawab ditambahkan${r.skipped ? `, ${r.skipped} sudah ada` : ""}`);
        }
        router.push(copy.back);
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal mengimpor");
      }
    });
  }

  const preview = mapped?.items.slice(0, 8) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <ActionLink href={copy.back} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" /> {copy.backLabel}
      </ActionLink>
      <div className="space-y-5 rounded-[20px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold">{copy.title}</h1>
              <p className="text-xs text-muted-foreground">{copy.columns}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-3.5" /> Unduh contoh
          </Button>
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => read(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {reading ? <Loader2 className="size-5 animate-spin text-brand-blue" /> : <FileSpreadsheet className="size-5 text-emerald-600" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{reading ? "Membaca file…" : table ? `${table.rows.length} baris data` : ""}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Ganti file" onClick={() => read(null)} disabled={pending}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              read(e.dataTransfer.files?.[0] ?? null);
            }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground transition hover:border-brand-blue/50 hover:bg-muted/40"
          >
            <Upload className="size-7 text-brand-blue" />
            <span>
              <b className="text-foreground">Pilih file Excel (.xlsx) atau CSV</b> atau tarik ke sini
            </span>
            <span className="text-xs">Baris pertama = judul kolom · maks 1.000 baris</span>
          </button>
        )}

        {mapped && mapped.missing.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Kolom <b>{mapped.missing.join(", ")}</b> tidak ditemukan. Kolom di file: {table?.columns.filter(Boolean).join(", ") || "—"}. Samakan dengan
              contoh lalu unggah lagi.
            </span>
          </div>
        )}

        {mapped && mapped.missing.length === 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    {(kind === "products" ? ["name", "priceIdr", "stock", "sku", "category"] : ["question", "answer"]).map((f) => (
                      <th key={f} className="px-3 py-2 font-medium">
                        {FIELD_LABEL[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((item, i) => (
                    <tr key={i}>
                      {kind === "products" ? (
                        <>
                          <td className="px-3 py-2">{(item as { name: string }).name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{rupiah((item as { priceIdr: number }).priceIdr)}</td>
                          <td className="px-3 py-2">{(item as { stock: number }).stock}</td>
                          <td className="px-3 py-2 text-muted-foreground">{(item as { sku: string }).sku || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{(item as { category: string }).category || "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 align-top font-medium">{(item as { question: string }).question}</td>
                          <td className="px-3 py-2 text-muted-foreground">{(item as { answer: string }).answer}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {mapped.items.length > preview.length ? `Menampilkan ${preview.length} dari ${mapped.items.length} baris. ` : ""}
              {copy.note}
            </p>

            {mapped.errors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="mb-1 font-semibold">{mapped.errors.length} baris dilewati:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {mapped.errors.slice(0, 6).map((e) => (
                    <li key={e.row}>
                      Baris {e.row}: {e.message}
                    </li>
                  ))}
                  {mapped.errors.length > 6 && <li>… dan {mapped.errors.length - 6} lainnya</li>}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <ActionLink href={copy.back} variant="outline">
                Batal
              </ActionLink>
              <Button type="button" onClick={runImport} disabled={pending || mapped.items.length === 0}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import {mapped.items.length} baris
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
