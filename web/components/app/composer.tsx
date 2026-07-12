"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send, AlertTriangle } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { WaFormatToolbar } from "@/components/app/wa-message-editor";
import { sendReply } from "@/lib/actions";

export function Composer({ conversationId, blockedReason }: { conversationId: string; blockedReason?: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

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

  function submit() {
    const body = text.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        // "Dikirim" = masuk antrian; status nyata (terkirim/gagal) muncul di bubble pesan.
        await gooeyToast.promise(sendReply(conversationId, body), {
          loading: "Mengirim…",
          success: "Pesan dikirim",
          error: (e: unknown) => (e instanceof Error ? e.message : "Gagal mengirim"),
        });
        setText("");
      } catch {
        /* toast sudah menampilkan error */
      }
    });
  }

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="rounded-xl border border-border bg-background focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
        <div className="border-b border-border px-1.5 py-1">
          <WaFormatToolbar textareaRef={taRef} value={text} onChange={setText} disabled={pending} />
        </div>
        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <button
            onClick={submit}
            disabled={pending || !text.trim()}
            className="flex size-9 items-center justify-center rounded-lg bg-brand-blue text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
