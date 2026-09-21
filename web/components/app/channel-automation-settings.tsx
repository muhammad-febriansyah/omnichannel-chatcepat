"use client";

import { useState, useTransition } from "react";
import { Bot, ChevronDown, ListChecks } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { setChannelAutomation } from "@/lib/actions";
import { Switch } from "@/components/ui/switch";

type Mode = "menu" | "ai" | "hybrid";

type FlowOption = { id: string; name: string; status: string };

const MODE_LABEL: Record<Mode, string> = {
  menu: "Menu otomatis",
  ai: "AI Agent",
  hybrid: "Menu lalu AI",
};

export function ChannelAutomationSettings({
  channelId,
  type,
  enabled,
  mode,
  defaultFlowId,
  flows,
}: {
  channelId: string;
  type: string;
  enabled: boolean;
  mode: Mode;
  defaultFlowId: string | null;
  flows: FlowOption[];
}) {
  const [on, setOn] = useState(enabled);
  const [selectedMode, setSelectedMode] = useState<Mode>(mode);
  const [flowId, setFlowId] = useState(defaultFlowId ?? "");
  const [pending, start] = useTransition();

  function save(next: Partial<{ enabled: boolean; mode: Mode; flowId: string | null }>) {
    const previous = { on, selectedMode, flowId };
    const nextState = {
      enabled: next.enabled ?? on,
      mode: next.mode ?? selectedMode,
      flowId: next.flowId === undefined ? flowId || null : next.flowId,
    };
    setOn(nextState.enabled);
    setSelectedMode(nextState.mode);
    setFlowId(nextState.flowId ?? "");
    start(async () => {
      try {
        await setChannelAutomation(channelId, nextState);
        if (nextState.enabled && type === "wa_unofficial") {
          gooeyToast.warning("Menu aktif — nomor unofficial lebih rawan dibatasi WhatsApp.");
        } else {
          gooeyToast.success("Pengaturan balasan tersimpan");
        }
      } catch (error) {
        setOn(previous.on);
        setSelectedMode(previous.selectedMode);
        setFlowId(previous.flowId);
        gooeyToast.error(error instanceof Error ? error.message : "Gagal menyimpan pengaturan");
      }
    });
  }

  return (
    <div className="mt-auto space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={on}
            onCheckedChange={(value) => save({ enabled: value })}
            disabled={pending}
            size="sm"
            aria-label="Balas otomatis"
          />
          <span className="inline-flex items-center gap-1">
            <Bot className="size-3.5" /> Balas otomatis
          </span>
        </label>
        <span className="text-[11px] text-muted-foreground">{on ? MODE_LABEL[selectedMode] : "Nonaktif"}</span>
      </div>

      {on && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative block">
            <span className="sr-only">Mode balasan</span>
            <select
              value={selectedMode}
              onChange={(event) => save({ mode: event.target.value as Mode })}
              disabled={pending}
              className="h-9 w-full appearance-none rounded-lg border border-border bg-background px-2.5 pr-8 text-xs outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            >
              {(Object.keys(MODE_LABEL) as Mode[]).map((value) => (
                <option key={value} value={value}>{MODE_LABEL[value]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
          </label>
          <label className="relative block">
            <span className="sr-only">Menu default</span>
            <select
              value={flowId}
              onChange={(event) => save({ flowId: event.target.value || null })}
              disabled={pending || selectedMode === "ai"}
              className="h-9 w-full appearance-none rounded-lg border border-border bg-background px-2.5 pr-8 text-xs outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Pilih menu…</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name}{flow.status !== "active" ? " (draft)" : ""}</option>
              ))}
            </select>
            <ListChecks className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
          </label>
        </div>
      )}
    </div>
  );
}
