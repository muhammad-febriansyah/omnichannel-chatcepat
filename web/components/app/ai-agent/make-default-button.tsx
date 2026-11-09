"use client";

import { useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { setDefaultAgent } from "@/lib/ai-agent-actions";

export function MakeDefaultButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await setDefaultAgent(id);
            gooeyToast.success("Asisten default diganti");
          } catch (e) {
            gooeyToast.error(errorMessage(e) ?? "Gagal mengganti default");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Star className="size-3.5" />} Jadikan default
    </Button>
  );
}
