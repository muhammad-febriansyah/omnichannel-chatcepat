"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileUp } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { importContacts } from "@/lib/actions";
import { ActionLink } from "@/components/app/action-link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusPill } from "@/components/app/status-pill";

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
    <div className="space-y-5 p-6">
      <ActionLink href="/contacts" variant="ghost" size="default" className="-ml-2 w-fit gap-1.5">
        <ArrowLeft className="size-4" /> Kembali ke Kontak
      </ActionLink>

      <PageHeader
        icon={Upload}
        title="Import Kontak"
        description={
          <>
            Format CSV: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">nama,telepon</code> per baris. Header
            opsional.
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <StatusPill tone="amber">Belum opt-in</StatusPill>
        <span>
          Kontak hasil import <b>tidak bisa dikirimi broadcast</b> sampai consent diperoleh. Hanya import kontak milik
          tenant sendiri.
        </span>
      </div>

      <SectionCard
        title="Tempel CSV"
        action={
          <Button type="button" variant="outline" size="default" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> Unggah file .csv
          </Button>
        }
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
        <textarea
          id="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"Budi Santoso,628111111111\nSari Indah,628122222222"}
          className="w-full rounded-xl border border-border bg-background p-3 font-mono text-sm outline-none transition-shadow focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
        />

        {rows.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium">
              {rows.length} baris terdeteksi{" "}
              <span className="font-normal text-muted-foreground">(preview 5 pertama)</span>
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
      </SectionCard>

      <div className="flex gap-2">
        <ActionLink href="/contacts" variant="outline" className="px-5">
          Batal
        </ActionLink>
        <Button onClick={submit} disabled={pending || rows.length === 0} size="lg" className="px-5">
          <Upload className="size-4" /> {pending ? "Mengimport…" : `Import ${rows.length || ""} kontak`}
        </Button>
      </div>
    </div>
  );
}
