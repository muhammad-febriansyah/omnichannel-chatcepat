"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/action-error";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Bot, ChevronDown, Loader2, Save } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { setChannelAutomation, type FallbackAction } from "@/lib/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type FlowOption = { id: string; name: string; status: string };
type AgentOption = { id: string; name: string; isDefault: boolean; isActive: boolean };

const DEFAULT_FALLBACK_TEXT = "Terima kasih, pesan Anda kami terima. Agen kami akan segera membalas.";

const FALLBACKS: { value: FallbackAction; label: string; hint: string }[] = [
  { value: "ai", label: "Dijawab AI", hint: "Asisten di atas menjawab pertanyaan apa pun" },
  { value: "message", label: "Pesan tetap", hint: "Kirim satu pesan, lalu CS lanjutkan" },
  { value: "silent", label: "Diam", hint: "Tidak dibalas, tunggu CS" },
];

type State = {
  enabled: boolean;
  flowId: string;
  agentId: string;
  fallbackAction: FallbackAction;
  fallbackMessage: string;
};

// Per channel: auto-reply on/off, optional main flow, which assistant answers, and what
// happens when no flow matches (AI / fixed message / stay silent).
export function ChannelAutomationSettings({
  channelId,
  type,
  enabled,
  defaultFlowId,
  flows,
  agentId,
  agents,
  fallbackAction,
  fallbackMessage,
}: {
  channelId: string;
  type: string;
  enabled: boolean;
  defaultFlowId: string | null;
  flows: FlowOption[];
  agentId: string | null;
  agents: AgentOption[];
  fallbackAction: FallbackAction;
  fallbackMessage: string | null;
}) {
  const [s, setS] = useState<State>({
    enabled,
    flowId: defaultFlowId ?? "",
    agentId: agentId ?? "",
    fallbackAction,
    fallbackMessage: fallbackMessage ?? "",
  });
  const [savedMessage, setSavedMessage] = useState(fallbackMessage ?? "");
  const [pending, start] = useTransition();
  const active = flows.filter((f) => f.status === "active");
  const defaultAgent = agents.find((a) => a.isDefault);

  function save(patch: Partial<State>, done = "Pengaturan balasan tersimpan") {
    const previous = s;
    const next = { ...s, ...patch };
    setS(next);
    start(async () => {
      try {
        await setChannelAutomation(channelId, {
          enabled: next.enabled,
          flowId: next.flowId || null,
          agentId: next.agentId || null,
          fallbackAction: next.fallbackAction,
          fallbackMessage: next.fallbackMessage.trim() || null,
        });
        setSavedMessage(next.fallbackMessage);
        if (patch.enabled && type === "wa_unofficial") {
          gooeyToast.warning("Balas otomatis aktif — nomor unofficial lebih rawan dibatasi WhatsApp.");
        } else {
          gooeyToast.success(done);
        }
      } catch (error) {
        setS(previous);
        gooeyToast.error(errorMessage(error) ?? "Gagal menyimpan pengaturan");
      }
    });
  }

  const selectCls = "h-9 w-full pr-8 text-xs";
  const chevron = <ChevronDown className="pointer-events-none absolute bottom-2.5 right-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">Balas otomatis</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {s.enabled ? (
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
        <Switch checked={s.enabled} onCheckedChange={(value) => save({ enabled: value })} disabled={pending} aria-label="Balas otomatis" />
      </div>

      {s.enabled && (
        <>
          <label className="relative block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Flow utama (opsional)</span>
            <NativeSelect value={s.flowId} onChange={(e) => save({ flowId: e.target.value })} disabled={pending} className={selectCls}>
              <NativeSelectOption value="">Otomatis sesuai pemicu</NativeSelectOption>
              {active.map((flow) => (
                <NativeSelectOption key={flow.id} value={flow.id}>
                  {flow.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {chevron}
          </label>

          <label className="relative block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              Asisten AI
              <Link href="/ai-agent" className="font-medium text-brand-blue hover:underline">
                Kelola
              </Link>
            </span>
            <NativeSelect value={s.agentId} onChange={(e) => save({ agentId: e.target.value })} disabled={pending} className={selectCls}>
              <NativeSelectOption value="">
                {defaultAgent ? `Default workspace (${defaultAgent.name})` : "Default workspace"}
              </NativeSelectOption>
              {agents.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                  {a.isActive ? "" : " (nonaktif)"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {chevron}
          </label>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Kalau tidak ada flow yang cocok</span>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Kalau tidak ada flow yang cocok">
              {FALLBACKS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={s.fallbackAction === f.value}
                  title={f.hint}
                  disabled={pending}
                  onClick={() => s.fallbackAction !== f.value && save({ fallbackAction: f.value })}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors",
                    s.fallbackAction === f.value
                      ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{FALLBACKS.find((f) => f.value === s.fallbackAction)?.hint}</p>
          </div>

          {s.fallbackAction !== "silent" && (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {s.fallbackAction === "ai" ? "Pesan cadangan (kalau AI tidak bisa menjawab)" : "Isi pesan"}
              </span>
              <Textarea
                value={s.fallbackMessage}
                maxLength={500}
                rows={2}
                onChange={(e) => setS({ ...s, fallbackMessage: e.target.value })}
                placeholder={DEFAULT_FALLBACK_TEXT}
                className="text-xs"
              />
              {s.fallbackMessage !== savedMessage && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => save({}, "Pesan disimpan")}>
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan pesan
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
