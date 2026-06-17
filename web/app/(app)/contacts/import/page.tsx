"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileUp, Info } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { importContacts } from "@/lib/actions";

type Row = { name: string; phone: string };

const HEADER_RE = /\b(nama|name|telepon|phone|hp|nomor)\b/i;

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && HEADER_RE.test(lines[0]) && lines[0].includes(",")) lines.shift();
  return lines.map((line) => {
    const [name = "", phone = ""] = line.split(",").map((c) => c.trim());
    return { name, phone };
  });
}

export default function ImportContactsPage() {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const rows = useMemo(() => parseCsv(text).filter((r) => r.name || r.phone), [text]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  function submit() {
    if (!rows.length) {
      gooeyToast.error("Belum ada baris untuk diimport");
      return;
    }
    start(async () => {
      try {
        const res = await importContacts(rows);
        gooeyToast.success(
          `${res.inserted} kontak diimport${res.skipped ? `, ${res.skipped} dilewati (duplikat)` : ""}`,
        );
        router.push("/contacts");
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Gagal import kontak");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Import Kontak</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Format CSV: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">nama,telepon</code> per baris. Header
        opsional.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Kontak hasil import berstatus <b>belum opt-in</b> — tidak bisa dikirimi broadcast sampai consent diperoleh.
          Hanya import kontak milik tenant sendiri.
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="csv" className="text-sm font-medium text-foreground">
            Tempel CSV
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            <FileUp className="size-3.5" /> Unggah file .csv
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
        </div>
        <textarea
          id="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"Budi Santoso,628111111111\nSari Indah,628122222222"}
          className="w-full rounded-xl border border-border bg-card p-3 font-mono text-sm outline-none transition-shadow focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
        />
      </div>

      {rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">
            {rows.length} baris terdeteksi <span className="font-normal text-muted-foreground">(preview 5 pertama)</span>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {rows.slice(0, 5).map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-foreground">{r.name || "—"}</span>
                <span>·</span>
                <span>{r.phone || "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          onClick={submit}
          disabled={pending || rows.length === 0}
          className="flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <Upload className="size-4" /> {pending ? "Mengimport…" : `Import ${rows.length || ""} kontak`}
        </button>
        <Link
          href="/contacts"
          className="flex h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50"
        >
          Batal
        </Link>
      </div>
    </div>
  );
}
