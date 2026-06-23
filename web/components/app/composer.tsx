"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { sendReply } from "@/lib/actions";

export function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

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
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
        <textarea
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
  );
}
