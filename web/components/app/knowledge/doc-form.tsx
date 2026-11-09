"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, Save } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionLink } from "@/components/app/action-link";
import { KbMarkdownEditor } from "@/components/app/kb-markdown-editor";
import { addKnowledge } from "@/lib/actions";

const BACK = "/flows?tab=pengetahuan";

// New knowledge document (long text: policy, SOP, price list).
export function DocForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return gooeyToast.error("Judul & isi wajib diisi");
    start(async () => {
      try {
        await gooeyToast.promise(addKnowledge(title.trim(), text), {
          loading: "Memproses dokumen…",
          success: "Dokumen ditambahkan",
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
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Judul</span>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Kebijakan pengiriman & retur" className="h-10" autoFocus />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Isi</span>
          <KbMarkdownEditor
            value={text}
            onChange={setText}
            rows={14}
            placeholder={"## Pengiriman\nKirim setiap hari kerja sebelum jam 15.00 via JNE & SiCepat.\n\n## Retur\nTukar ukuran maksimal 7 hari, barang belum dipakai."}
          />
        </div>
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
