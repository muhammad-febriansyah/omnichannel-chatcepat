"use client";

import { Infinity as InfinityIcon, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NODE_META, PALETTE_GROUPS } from "@/components/app/flow-builder/meta";
import { CHANNEL_KINDS, PLAN_FEATURES, fmtTokens, type PlanEntitlements } from "@/lib/plan-config";
import { cn } from "@/lib/utils";

const ALL_NODES = PALETTE_GROUPS.flatMap((g) => g.kinds);

// Number field where empty = unlimited (shown as ∞).
function LimitInput({ id, value, onChange }: { id: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        value={value === null ? "" : value.toLocaleString("id-ID")}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "");
          onChange(d === "" ? null : Number(d));
        }}
        placeholder="Tanpa batas"
        className="h-10 pr-9 tabular-nums"
      />
      {value === null && <InfinityIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {hint && <p className="mb-3 mt-1 text-xs text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

// What the plan grants: AI tokens, channel limits (total + per type), team/KB/broadcast
// limits, features and allowed flow steps. Empty number = unlimited.
export function PlanEntitlementsEditor({ value: v, onChange }: { value: PlanEntitlements; onChange: (v: PlanEntitlements) => void }) {
  const setLimit = (patch: Partial<PlanEntitlements["limits"]>) => onChange({ ...v, limits: { ...v.limits, ...patch } });
  const nodes = v.flowNodes ?? ALL_NODES;
  const toggleNode = (k: string) => {
    const next = nodes.includes(k) ? nodes.filter((x) => x !== k) : [...nodes, k];
    onChange({ ...v, flowNodes: ALL_NODES.every((n) => next.includes(n)) ? null : next });
  };

  return (
    <>
      <Section title="Token AI" hint="Kuota token AI per bulan (reset tiap awal bulan WIB). Tenant bisa menambah lewat paket top-up.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="aiTokens">Token AI / bulan</Label>
            <Input
              id="aiTokens"
              inputMode="numeric"
              value={v.aiTokensMonthly.toLocaleString("id-ID")}
              onChange={(e) => onChange({ ...v, aiTokensMonthly: Number(e.target.value.replace(/\D/g, "") || 0) })}
              className="h-10 tabular-nums"
            />
            <p className="text-xs text-muted-foreground">≈ {fmtTokens(v.aiTokensMonthly)} token · 0 = AI tidak termasuk paket</p>
          </div>
        </div>
      </Section>

      <Section title="Channel" hint="Batas akun yang bisa dihubungkan. Kosong = tanpa batas. Contoh Paket Plus: maks 2 WhatsApp, 2 Instagram.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="maxChannels">Total semua channel</Label>
            <LimitInput id="maxChannels" value={v.limits.maxChannels} onChange={(x) => setLimit({ maxChannels: x })} />
          </div>
          {CHANNEL_KINDS.map((c) => (
            <div key={c.value} className="space-y-1.5">
              <Label htmlFor={`ch-${c.value}`}>{c.label}</Label>
              <LimitInput
                id={`ch-${c.value}`}
                value={v.limits.channels[c.value]}
                onChange={(x) => setLimit({ channels: { ...v.limits.channels, [c.value]: x } })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Batas lain">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="maxAgents">Anggota tim</Label>
            <LimitInput id="maxAgents" value={v.limits.maxAgents} onChange={(x) => setLimit({ maxAgents: x })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxKbDocs">Dokumen pengetahuan AI</Label>
            <LimitInput id="maxKbDocs" value={v.limits.maxKbDocs} onChange={(x) => setLimit({ maxKbDocs: x })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast">Broadcast / bulan (penerima)</Label>
            <LimitInput id="broadcast" value={v.limits.broadcastPerMonth} onChange={(x) => setLimit({ broadcastPerMonth: x })} />
          </div>
        </div>
      </Section>

      <Section title="Fitur">
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAN_FEATURES.filter((f) => !f.hidden).map((f) => (
            <label key={f.value} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{f.label}</span>
                <span className="block text-xs text-muted-foreground">{f.desc}</span>
              </span>
              <Switch checked={v.features[f.value]} onCheckedChange={(x) => onChange({ ...v, features: { ...v.features, [f.value]: x } })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Langkah flow yang didapat" hint="Langkah yang tidak dicentang tampil terkunci di Automation. Pemicu selalu tersedia.">
        <div className="mb-3 flex items-center gap-2 text-xs">
          <button type="button" onClick={() => onChange({ ...v, flowNodes: null })} className="font-medium text-brand-blue hover:underline">
            Pilih semua
          </button>
          <span className="text-muted-foreground">·</span>
          <button type="button" onClick={() => onChange({ ...v, flowNodes: [] })} className="font-medium text-muted-foreground hover:underline">
            Kosongkan
          </button>
          <span className="ml-auto text-muted-foreground">
            {v.flowNodes === null ? "Semua langkah" : `${nodes.length}/${ALL_NODES.length} langkah`}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {PALETTE_GROUPS.map((g) => (
            <div key={g.group} className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{g.group}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.kinds.map((k) => {
                  const m = NODE_META[k];
                  const Icon = m.icon;
                  const on = nodes.includes(k);
                  return (
                    <label
                      key={k}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                        on ? "border-brand-blue/30 bg-blue-50/60 dark:bg-blue-500/10" : "border-border text-muted-foreground",
                      )}
                    >
                      <Checkbox checked={on} onCheckedChange={() => toggleNode(k)} />
                      <span className="grid size-6 shrink-0 place-items-center rounded-md text-white" style={{ background: m.color }}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate">{m.label}</span>
                      {!on && <Lock className="ml-auto size-3.5 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
