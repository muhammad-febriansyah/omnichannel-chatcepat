"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, FileUp, Globe, Loader2, PenLine, Save, X } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionLink } from "@/components/app/action-link";
import { KbMarkdownEditor } from "@/components/app/kb-markdown-editor";
import { addKnowledge } from "@/lib/actions";
import { importKnowledgeUrl } from "@/lib/knowledge-actions";
import { cn } from "@/lib/utils";

const BACK = "/flows?tab=pengetahuan";
const ACCEPT = ".pdf,.docx,.txt,.md";
const MAX_MB = 10;

type Mode = "write" | "file" | "url";

const MODES: { value: Mode; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "write", label: "Tulis", icon: PenLine, hint: "Ketik atau tempel teks." },
  { value: "file", label: "Upload file", icon: FileUp, hint: "PDF, Word (.docx), atau TXT — maks 10 MB." },
  { value: "url", label: "Dari website", icon: Globe, hint: "Satu halaman website Anda sendiri, mis. halaman FAQ." },
];

// New knowledge document: written text, an uploaded file, or a page of the business's site.
export function DocForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("write");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    if (f && f.size > MAX_MB * 1024 * 1024) return gooeyToast.error(`File maksimal ${MAX_MB} MB`);
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120));
  }

  async function upload(): Promise<void> {
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("title", title.trim());
    const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Gagal memproses file");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "write" && (!title.trim() || !text.trim())) return gooeyToast.error("Judul & isi wajib diisi");
    if (mode === "file" && !file) return gooeyToast.error("Pilih file dulu");
    if (mode === "url" && !/^https?:\/\/\S+$/i.test(url.trim())) return gooeyToast.error("Masukkan alamat lengkap, mis. https://tokoanda.com/faq");
    start(async () => {
      try {
        const job: Promise<unknown> =
          mode === "write" ? addKnowledge(title.trim(), text) : mode === "file" ? upload() : importKnowledgeUrl(url, title);
        await gooeyToast.promise(job, {
          loading: mode === "url" ? "Mengambil halaman…" : "Memproses dokumen…",
          success: "Dokumen ditambahkan ke pengetahuan AI",
          error: (err: unknown) => errorMessage(err) ?? "Gagal menambah dokumen",
        });
        router.push(BACK);
      } catch {
        /* toast shown */
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <ActionLink href={BACK} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" /> Pengetahuan
      </ActionLink>
      <form onSubmit={submit} className="space-y-5 rounded-[20px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <BookOpen className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold">Tambah dokumen pengetahuan</h1>
            <p className="text-xs text-muted-foreground">Untuk teks panjang. Pertanyaan singkat lebih baik dibuat sebagai Tanya-jawab.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sumber dokumen">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:text-sm",
                mode === m.value ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <m.icon className="size-4" /> {m.label}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{MODES.find((m) => m.value === mode)?.hint}</p>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Judul {mode !== "write" && <span className="font-normal text-muted-foreground">(opsional)</span>}</span>
          <Input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === "url" ? "Kosongkan untuk memakai judul halaman" : "mis. Kebijakan pengiriman & retur"}
            className="h-10"
          />
        </label>

        {mode === "write" && (
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Isi</span>
            <KbMarkdownEditor
              value={text}
              onChange={setText}
              rows={14}
              placeholder={"## Pengiriman\nKirim setiap hari kerja sebelum jam 15.00 via JNE & SiCepat.\n\n## Retur\nTukar ukuran maksimal 7 hari, barang belum dipakai."}
            />
          </div>
        )}

        {mode === "file" && (
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <FileUp className="size-5 shrink-0 text-brand-blue" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus file" onClick={() => pick(null)}>
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
                  pick(e.dataTransfer.files?.[0] ?? null);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground transition hover:border-brand-blue/50 hover:bg-muted/40"
              >
                <FileUp className="size-7 text-brand-blue" />
                <span>
                  <b className="text-foreground">Pilih file</b> atau tarik ke sini
                </span>
                <span className="text-xs">PDF · Word (.docx) · TXT — maks {MAX_MB} MB</span>
              </button>
            )}
            <p className="text-xs text-muted-foreground">PDF hasil scan (gambar) belum bisa dibaca. Teks di dalam file dibaca otomatis.</p>
          </div>
        )}

        {mode === "url" && (
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Alamat halaman</span>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tokoanda.com/faq" className="h-10" inputMode="url" />
            <span className="block text-xs text-muted-foreground">Hanya halaman publik website Anda sendiri. Teks halaman diambil sekali; ambil lagi bila isinya berubah.</span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <ActionLink href={BACK} variant="outline">
            Batal
          </ActionLink>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </form>
    </div>
  );
}
