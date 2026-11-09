"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquareText, Save } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ActionLink } from "@/components/app/action-link";
import { saveFaq } from "@/lib/knowledge-actions";

const BACK = "/flows?tab=pengetahuan";

// Create / edit one Tanya-jawab. fromUnanswered: answering a "Belum terjawab" question.
export function FaqForm({
  faqId,
  initial,
  fromUnanswered,
}: {
  faqId: string | null;
  initial: { question: string; answer: string; isActive: boolean };
  fromUnanswered?: string | null;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initial.question);
  const [answer, setAnswer] = useState(initial.answer);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) return gooeyToast.error("Pertanyaan minimal 3 karakter");
    if (!answer.trim()) return gooeyToast.error("Jawaban wajib diisi");
    start(async () => {
      try {
        await saveFaq(faqId, { question, answer, isActive }, fromUnanswered);
        gooeyToast.success(faqId ? "Tanya-jawab disimpan" : "Tanya-jawab ditambahkan — AI langsung memakainya");
        router.push(BACK);
      } catch (err) {
        gooeyToast.error(errorMessage(err) ?? "Gagal menyimpan tanya-jawab");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <ActionLink href={BACK} variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" /> Pengetahuan
      </ActionLink>
      <form onSubmit={submit} className="space-y-5 rounded-[20px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <MessageSquareText className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold">{faqId ? "Ubah tanya-jawab" : "Tambah tanya-jawab"}</h1>
            <p className="text-xs text-muted-foreground">AI memakai jawaban ini untuk pertanyaan yang mirip, dengan bahasanya sendiri.</p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Pertanyaan pelanggan</span>
          <Input value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="mis. Bisa bayar COD?" className="h-10" autoFocus={!question} />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Jawaban</span>
          <Textarea
            value={answer}
            maxLength={2000}
            rows={6}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="mis. Bisa kak, COD tersedia untuk area Jakarta & Tangerang. Di luar itu bisa transfer BCA atau QRIS."
            autoFocus={!!question && !answer}
          />
          <span className="block text-right text-[11px] text-muted-foreground">{answer.length}/2000</span>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">Aktif</span>
            <span className="block text-xs text-muted-foreground">Nonaktif = disimpan, tapi tidak dipakai AI.</span>
          </span>
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Tanya-jawab aktif" />
        </label>

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
