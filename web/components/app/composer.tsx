"use client";

import { errorMessage } from "@/lib/action-error";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send, AlertTriangle, Paperclip, X, FileText, Film, Music, Loader2 } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { WaFormatToolbar } from "@/components/app/wa-message-editor";
import { sendReply } from "@/lib/actions";
import { CHAT_ACCEPT, CHAT_MAX_BYTES, CHAT_MIME, attachmentKind, formatBytes, type ChatAttachment } from "@/lib/chat-attachments";
import { cn } from "@/lib/utils";

type Pending = { file: File; preview: string | null };

function validate(file: File): string | null {
  const entry = CHAT_MIME[file.type];
  if (!entry) return "Format file tidak didukung. Kirim gambar, video, audio, PDF, Office, TXT/CSV, atau ZIP.";
  if (file.size > CHAT_MAX_BYTES[entry[1]]) return `Ukuran maksimal ${formatBytes(CHAT_MAX_BYTES[entry[1]])} untuk file ini`;
  return null;
}

async function upload(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/inbox/upload", { method: "POST", body: form });
  const j = (await res.json().catch(() => ({}))) as Partial<ChatAttachment> & { error?: string };
  if (!res.ok || !j.url) throw new Error(j.error ?? "Gagal mengunggah file");
  return j as ChatAttachment;
}

export function Composer({ conversationId, blockedReason }: { conversationId: string; blockedReason?: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<Pending | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // wa_official di luar window 24 jam → teks bebas ditolak Meta; blokir + arahkan ke template.
  if (blockedReason) {
    return (
      <div className="border-t border-border bg-card p-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {blockedReason}{" "}
            <Link href="/inbox/new" className="font-semibold underline underline-offset-2">
              Kirim template lewat Pesan Baru
            </Link>
            .
          </span>
        </div>
      </div>
    );
  }

  function pick(f: File | null | undefined) {
    if (!f) return;
    const err = validate(f);
    if (err) return gooeyToast.error(err);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setFile({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    taRef.current?.focus();
  }

  function clearFile() {
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    const body = text.trim();
    if (!body && !file) return;
    startTransition(async () => {
      try {
        await gooeyToast.promise(
          (async () => {
            const att = file ? await upload(file.file) : null;
            await sendReply(conversationId, body, att ? { url: att.url, mime: att.mime, filename: att.filename } : null);
          })(),
          {
            loading: file ? "Mengunggah & mengirim…" : "Mengirim…",
            success: file ? "File dikirim" : "Pesan dikirim",
            error: (e: unknown) => errorMessage(e) ?? "Gagal mengirim",
          },
        );
        setText("");
        clearFile();
      } catch {
        /* toast sudah menampilkan error */
      }
    });
  }

  const kind = file ? attachmentKind(file.file.type) : null;
  const KindIcon = kind === "video" ? Film : kind === "audio" ? Music : FileText;

  return (
    <div
      className="relative border-t border-border bg-card p-3"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary">
          Lepas file untuk dilampirkan
        </div>
      )}

      <div className="rounded-xl border border-border bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <div className="flex items-center border-b border-border px-1.5 py-1">
          <WaFormatToolbar textareaRef={taRef} value={text} onChange={setText} disabled={pending} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Lampirkan file (gambar, video, audio, dokumen)"
            aria-label="Lampirkan file"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <input ref={fileRef} type="file" accept={CHAT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        {file && (
          <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
            {file.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={file.preview} alt="" className="size-14 rounded-lg object-cover" />
            ) : (
              <span className="grid size-14 place-items-center rounded-lg bg-muted text-muted-foreground">
                <KindIcon className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.file.size)} · tulis keterangan di bawah (opsional)
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus lampiran" disabled={pending} onClick={clearFile}>
              <X />
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files)[0];
              if (f) {
                e.preventDefault();
                pick(f);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={file ? "Tambahkan keterangan… (opsional)" : "Tulis balasan… (Enter kirim, Shift+Enter baris baru)"}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={pending || (!text.trim() && !file)}
            aria-label="Kirim"
            className={cn("size-9 shrink-0 rounded-lg")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
