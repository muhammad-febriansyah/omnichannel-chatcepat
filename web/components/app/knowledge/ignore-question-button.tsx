"use client";

import { useTransition } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { setUnansweredStatus } from "@/lib/knowledge-actions";

// Hide a question that doesn't need an answer (spam, off-topic, one-off).
export function IgnoreQuestionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await setUnansweredStatus(id, "ignored");
            gooeyToast.success("Pertanyaan diabaikan");
          } catch (e) {
            gooeyToast.error(errorMessage(e) ?? "Gagal mengabaikan pertanyaan");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />} Abaikan
    </Button>
  );
}
