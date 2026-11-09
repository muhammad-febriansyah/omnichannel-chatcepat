"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorMessage } from "@/lib/action-error";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Bot, ChevronDown } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { setChannelAutomation } from "@/lib/actions";
import { Switch } from "@/components/ui/switch";

type FlowOption = { id: string; name: string; status: string };

// Per channel: auto-reply on/off + optional main flow. What gets answered (menu, AI,
// comments) is decided by the flows in Automation.
export function ChannelAutomationSettings({
  channelId,
  type,
  enabled,
  defaultFlowId,
  flows,
}: {
  channelId: string;
  type: string;
  enabled: boolean;
  defaultFlowId: string | null;
  flows: FlowOption[];
}) {
  const [on, setOn] = useState(enabled);
  const [flowId, setFlowId] = useState(defaultFlowId ?? "");
  const [pending, start] = useTransition();
  const active = flows.filter((f) => f.status === "active");

  function save(next: Partial<{ enabled: boolean; flowId: string | null }>) {
    const previous = { on, flowId };
    const state = { enabled: next.enabled ?? on, flowId: next.flowId === undefined ? flowId || null : next.flowId };
    setOn(state.enabled);
    setFlowId(state.flowId ?? "");
    start(async () => {
      try {
        await setChannelAutomation(channelId, state);
        if (state.enabled && type === "wa_unofficial") {
          gooeyToast.warning("Balas otomatis aktif — nomor unofficial lebih rawan dibatasi WhatsApp.");
        } else {
          gooeyToast.success("Pengaturan balasan tersimpan");
        }
      } catch (error) {
        setOn(previous.on);
        setFlowId(previous.flowId);
        gooeyToast.error(errorMessage(error) ?? "Gagal menyimpan pengaturan");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">Balas otomatis</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {on ? (
              <>
                Mengikuti flow di{" "}
                <Link href="/flows" className="font-medium text-brand-blue hover:underline">
                  Automation
                </Link>
              </>
            ) : (
              "Nonaktif — CS membalas manual"
            )}
          </div>
        </div>
        <Switch checked={on} onCheckedChange={(value) => save({ enabled: value })} disabled={pending} aria-label="Balas otomatis" />
      </div>

      {on && (
        <label className="relative block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Flow utama (opsional)</span>
          <NativeSelect
            value={flowId}
            onChange={(event) => save({ flowId: event.target.value || null })}
            disabled={pending}
            className="h-9 w-full pr-8 text-xs"
          >
            <NativeSelectOption value="">Otomatis sesuai pemicu</NativeSelectOption>
            {active.map((flow) => (
              <NativeSelectOption key={flow.id} value={flow.id}>
                {flow.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <ChevronDown className="pointer-events-none absolute bottom-2.5 right-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
        </label>
      )}
    </div>
  );
}
