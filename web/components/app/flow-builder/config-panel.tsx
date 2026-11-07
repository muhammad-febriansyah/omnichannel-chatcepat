"use client";

import { useState } from "react";
import { Plus, Trash2, X, AlertCircle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WaMessageEditor } from "@/components/app/wa-message-editor";
import {
  CONDITION_OPS,
  newId,
  type ConditionOp,
  type GraphNode,
  type NodeDataMap,
  type NodeKind,
  type TriggerKind,
} from "@/lib/flow-graph";
import { NODE_META } from "./meta";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10";
const labelCls = "mb-1.5 block text-xs font-semibold text-foreground";
const hintCls = "mt-1.5 text-[11px] leading-snug text-muted-foreground";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

function VarInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">{"{{"}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"))}
        placeholder={placeholder}
        className={cn(inputCls, "pl-8 pr-8 font-mono")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">{"}}"}</span>
    </div>
  );
}

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-border bg-background p-2 focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
      <div className="flex flex-wrap gap-1.5">
        {value.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            {k}
            <button type="button" aria-label={`Hapus ${k}`} onClick={() => onChange(value.filter((x) => x !== k))}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={value.length ? "" : "mis. harga, promo"}
          className="h-7 min-w-[100px] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

export function ConfigPanel({
  node,
  issues,
  variables,
  onChange,
  onDelete,
  onDuplicate,
  onClose,
}: {
  node: GraphNode;
  issues: string[];
  variables: string[];
  onChange: (payload: GraphNode["data"]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const waVars = variables.map((v) => ({ label: v, token: `{{${v}}}` }));
  const set = <K extends NodeKind>(patch: Partial<NodeDataMap[K]>) => onChange({ ...(node.data as NodeDataMap[K]), ...patch });

  let body: React.ReactNode = null;
  switch (node.type) {
    case "trigger": {
      const d = node.data as NodeDataMap["trigger"];
      body = (
        <>
          <Field label="Jenis pemicu">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["keyword", "Keyword"],
                ["welcome", "Pesan pertama"],
                ["fallback", "Cadangan"],
              ] as [TriggerKind, string][]).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set<"trigger">({ kind: k })}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    d.kind === k ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10" : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={hintCls}>
              {d.kind === "keyword" && "Flow mulai saat pesan pelanggan mengandung salah satu keyword."}
              {d.kind === "welcome" && "Flow mulai saat pelanggan mengirim pesan pertama kali."}
              {d.kind === "fallback" && "Flow mulai saat pesan tidak cocok dengan flow lain."}
            </p>
          </Field>
          {d.kind === "keyword" && (
            <Field label="Keyword" hint="Tekan Enter atau koma untuk menambah. Tidak membedakan huruf besar/kecil.">
              <KeywordInput value={d.keywords} onChange={(keywords) => set<"trigger">({ keywords })} />
            </Field>
          )}
        </>
      );
      break;
    }
    case "send_text": {
      const d = node.data as NodeDataMap["send_text"];
      body = (
        <Field label="Isi pesan" hint="Klik variabel untuk menyisipkan, mis. {{nama}}.">
          <WaMessageEditor value={d.text} onChange={(text) => set<"send_text">({ text })} variables={waVars} rows={6} placeholder="Halo {{nama}}, ada yang bisa kami bantu?" />
        </Field>
      );
      break;
    }
    case "send_media": {
      const d = node.data as NodeDataMap["send_media"];
      body = (
        <>
          <Field label="URL media" hint="Link publik gambar/dokumen (https://…).">
            <input value={d.url} onChange={(e) => set<"send_media">({ url: e.target.value })} placeholder="https://…/brosur.jpg" className={inputCls} />
          </Field>
          <Field label="Caption (opsional)">
            <WaMessageEditor value={d.caption} onChange={(caption) => set<"send_media">({ caption })} variables={waVars} rows={3} />
          </Field>
        </>
      );
      break;
    }
    case "send_catalog": {
      const d = node.data as NodeDataMap["send_catalog"];
      body = (
        <>
          <Field label="Kategori (opsional)" hint="Kosongkan untuk mengirim semua produk aktif.">
            <input value={d.category} onChange={(e) => set<"send_catalog">({ category: e.target.value })} placeholder="mis. Minuman" className={inputCls} />
          </Field>
          <Field label="Pesan pembuka (opsional)">
            <WaMessageEditor value={d.intro} onChange={(intro) => set<"send_catalog">({ intro })} variables={waVars} rows={3} />
          </Field>
        </>
      );
      break;
    }
    case "wait_reply": {
      const d = node.data as NodeDataMap["wait_reply"];
      body = (
        <Field label="Simpan jawaban ke variabel" hint="Flow berhenti sampai pelanggan membalas, lalu lanjut ke langkah berikutnya.">
          <VarInput value={d.saveAs} onChange={(saveAs) => set<"wait_reply">({ saveAs })} placeholder="jawaban" />
        </Field>
      );
      break;
    }
    case "set_var": {
      const d = node.data as NodeDataMap["set_var"];
      const update = (pairs: NodeDataMap["set_var"]["pairs"]) => set<"set_var">({ pairs });
      body = (
        <Field label="Variabel">
          <div className="space-y-2">
            {d.pairs.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <input
                  value={p.key}
                  onChange={(e) => update(d.pairs.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") } : x)))}
                  placeholder="nama_var"
                  className={cn(inputCls, "w-2/5 font-mono")}
                />
                <input
                  value={p.value}
                  onChange={(e) => update(d.pairs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="nilai"
                  className={inputCls}
                />
                <button type="button" aria-label="Hapus variabel" onClick={() => update(d.pairs.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => update([...d.pairs, { id: newId("v"), key: "", value: "" }])}>
              <Plus className="size-3.5" /> Tambah variabel
            </Button>
          </div>
        </Field>
      );
      break;
    }
    case "condition": {
      const d = node.data as NodeDataMap["condition"];
      const update = (rules: NodeDataMap["condition"]["rules"]) => set<"condition">({ rules });
      body = (
        <>
          <Field label="Variabel yang dicek" hint="{{pesan}} = isi pesan terakhir pelanggan.">
            <select value={d.variable} onChange={(e) => set<"condition">({ variable: e.target.value })} className={inputCls}>
              {[...new Set([d.variable, ...variables])].filter(Boolean).map((v) => (
                <option key={v} value={v}>{`{{${v}}}`}</option>
              ))}
            </select>
          </Field>
          <Field label="Aturan" hint="Dicek berurutan dari atas. Yang pertama cocok dipakai; tidak ada yang cocok → cabang Lainnya.">
            <div className="space-y-2">
              {d.rules.map((r, i) => {
                const needsValue = CONDITION_OPS.find((o) => o.value === r.op)?.needsValue;
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-background text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                    <select
                      value={r.op}
                      onChange={(e) => update(d.rules.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionOp } : x)))}
                      className={cn(inputCls, "h-9 w-[44%] px-2 text-xs")}
                    >
                      {CONDITION_OPS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {needsValue ? (
                      <input
                        value={r.value}
                        onChange={(e) => update(d.rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                        placeholder="nilai"
                        className={cn(inputCls, "h-9 text-xs")}
                      />
                    ) : (
                      <span className="flex-1" />
                    )}
                    <button type="button" aria-label="Hapus aturan" onClick={() => update(d.rules.filter((_, j) => j !== i))} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-red-500">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => update([...d.rules, { id: newId("r"), op: "contains", value: "" }])}>
                <Plus className="size-3.5" /> Tambah aturan
              </Button>
            </div>
          </Field>
        </>
      );
      break;
    }
    case "menu": {
      const d = node.data as NodeDataMap["menu"];
      const update = (options: NodeDataMap["menu"]["options"]) => set<"menu">({ options });
      body = (
        <>
          <Field label="Pesan menu">
            <WaMessageEditor value={d.prompt} onChange={(prompt) => set<"menu">({ prompt })} variables={waVars} rows={5} />
          </Field>
          <Field label="Pilihan" hint="Pelanggan boleh membalas kode (A) atau labelnya (Informasi). Tiap pilihan punya sambungan sendiri di kanvas.">
            <div className="space-y-2">
              {d.options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    value={o.code}
                    maxLength={4}
                    onChange={(e) => update(d.options.map((x, j) => (j === i ? { ...x, code: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") } : x)))}
                    placeholder="A"
                    className={cn(inputCls, "w-14 text-center font-semibold uppercase")}
                  />
                  <input
                    value={o.label}
                    onChange={(e) => update(d.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Label pilihan"
                    className={inputCls}
                  />
                  <button type="button" aria-label="Hapus pilihan" disabled={d.options.length <= 2} onClick={() => update(d.options.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500 disabled:opacity-40">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {d.options.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update([...d.options, { id: newId("o"), code: String.fromCharCode(65 + d.options.length), label: "" }])}
                >
                  <Plus className="size-3.5" /> Tambah pilihan
                </Button>
              )}
            </div>
          </Field>
          <Field label="Simpan pilihan ke variabel">
            <VarInput value={d.saveAs} onChange={(saveAs) => set<"menu">({ saveAs })} placeholder="pilihan" />
          </Field>
          <Field label="Balasan jika tidak dikenali" hint="Dikirim lalu menu diulang, kecuali cabang “Tidak dikenali” disambungkan ke langkah lain.">
            <WaMessageEditor value={d.invalidText} onChange={(invalidText) => set<"menu">({ invalidText })} rows={2} />
          </Field>
        </>
      );
      break;
    }
    case "ai_agent":
      body = (
        <p className="rounded-lg bg-violet-50 p-3 text-xs leading-relaxed text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
          AI menjawab pesan pelanggan memakai persona, knowledge base, dan katalog dari menu <b>AI Agent</b>. Bila AI tidak yakin, percakapan otomatis dialihkan ke CS.
        </p>
      );
      break;
    case "handoff":
      body = (
        <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          Percakapan diserahkan ke agen manusia dan muncul di Inbox. Flow selesai di sini.
        </p>
      );
      break;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: meta.color }}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{meta.label}</div>
          <div className="truncate text-[11px] text-muted-foreground">{meta.desc}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup panel" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {issues.length > 0 && (
          <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {issues.map((m) => (
              <div key={m} className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {m}
              </div>
            ))}
          </div>
        )}
        {body}
      </div>

      {node.type !== "trigger" && (
        <div className="flex gap-2 border-t border-border p-3">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onDuplicate}>
            <Copy className="size-3.5" /> Duplikat
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-600" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Hapus
          </Button>
        </div>
      )}
    </div>
  );
}
