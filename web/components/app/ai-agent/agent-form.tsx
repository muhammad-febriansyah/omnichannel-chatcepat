"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ActionLink } from "@/components/app/action-link";
import { AiConfigEditor, AiSimulator } from "@/components/app/ai-config/ai-config-editor";
import { saveAgent } from "@/lib/ai-agent-actions";
import type { AgentInput, AiConfig, KnowledgeDoc, PromoItem } from "@/lib/ai-agent-options";

// Create/edit one assistant (menu Asisten AI): identity, prompt, style, knowledge,
// handoff — with a live simulator next to it.
export function AgentForm({
  agentId,
  initial,
  docs,
  promos,
}: {
  agentId: string | null;
  initial: AgentInput;
  docs: KnowledgeDoc[];
  promos: PromoItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [config, setConfig] = useState<AiConfig>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _n, isActive: _a, ...rest } = initial;
    return rest;
  });
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) return gooeyToast.error("Nama asisten wajib diisi");
    start(async () => {
      try {
        const { id } = await saveAgent(agentId, { ...config, name, isActive });
        gooeyToast.success(agentId ? "Asisten disimpan" : "Asisten dibuat");
        if (!agentId) router.replace(`/ai-agent/${id}`);
        else router.refresh();
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menyimpan asisten");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ActionLink href="/ai-agent" variant="ghost" size="sm">
          <ArrowLeft className="size-4" /> Semua asisten
        </ActionLink>
        <Button onClick={save} disabled={pending} size="lg">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {agentId ? "Simpan perubahan" : "Buat asisten"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="space-y-3 rounded-[20px] bg-card p-4">
            <label className="block space-y-1.5">
              <span className="block text-[13px] font-semibold">Nama di daftar</span>
              <Input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. CS Toko, Sales Instagram"
                className="h-10"
              />
              <span className="block text-[11px] text-muted-foreground">
                Hanya untuk Anda. Nama yang dipakai saat membalas pelanggan diatur di &quot;Nama asisten&quot;.
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span>
                <span className="block text-[13px] font-medium">Aktif</span>
                <span className="block text-[11px] text-muted-foreground">Nonaktif = channel & flow memakai asisten default.</span>
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Asisten aktif" />
            </label>
          </div>

          <AiConfigEditor value={config} onChange={setConfig} docs={docs} promos={promos} defaultOpen={["identitas", "instruksi"]} />

          <div className="flex items-start gap-2.5 rounded-[20px] border border-emerald-200 bg-emerald-50/60 p-3.5 text-[12px] leading-relaxed text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Aturan keamanan selalu berlaku di atas prompt Anda: AI tidak mengarang harga/stok, tidak membocorkan data pelanggan, dan
              mengalihkan ke CS bila tidak yakin.
            </span>
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="space-y-3 rounded-[20px] bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                <Sparkles className="size-3.5" />
              </span>
              <div>
                <div className="text-[13px] font-semibold">Coba asisten</div>
                <div className="text-[11px] text-muted-foreground">Pakai pengaturan di kiri, belum perlu disimpan.</div>
              </div>
            </div>
            <AiSimulator value={config} />
          </div>
        </aside>
      </div>
    </div>
  );
}
