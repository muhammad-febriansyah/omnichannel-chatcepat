"use client";

import { useState, useTransition } from "react";
import { Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { setChannelAutoReply } from "@/lib/actions";

// Toggle "Balas otomatis" per-channel. Jalan untuk official & unofficial — user
// tinggal set ON/OFF. Optimistic + rollback saat gagal. Untuk wa_unofficial,
// mengaktifkan menaikkan risiko banned (nomor pribadi) → beri peringatan.
export function AutoReplyToggle({
  channelId,
  type,
  enabled,
}: {
  channelId: string;
  type: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    const prev = on;
    setOn(next); // optimistic
    start(async () => {
      try {
        await setChannelAutoReply(channelId, next);
        if (next && type === "wa_unofficial") {
          gooeyToast.warning("Balas otomatis aktif — nomor unofficial lebih rawan banned.");
        } else {
          gooeyToast.success(next ? "Balas otomatis aktif" : "Balas otomatis nonaktif");
        }
      } catch {
        setOn(prev); // rollback
        gooeyToast.error("Gagal mengubah balas otomatis");
      }
    });
  }

  return (
    <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <Switch
        checked={on}
        onCheckedChange={change}
        disabled={pending}
        size="sm"
        aria-label="Balas otomatis"
      />
      <span className="inline-flex items-center gap-1">
        <Bot className="size-3.5" /> Balas otomatis
      </span>
    </label>
  );
}
