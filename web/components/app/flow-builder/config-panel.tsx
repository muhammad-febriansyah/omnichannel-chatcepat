"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useState } from "react";
import { Plus, Trash2, X, AlertCircle, Copy, SlidersHorizontal, FlaskConical, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WaMessageEditor } from "@/components/app/wa-message-editor";
import {
  CONDITION_OPS,
  aiNodeMode,
  newId,
  type ConditionOp,
  type GraphNode,
  type NodeDataMap,
  type NodeKind,
  type TriggerKind,
} from "@/lib/flow-graph";
import { NODE_META } from "./meta";
import { takenAccounts, type FlowTriggerInfo } from "@/lib/flow-conflicts";
import { BroadcastMessageFields, BroadcastTriggerFields } from "./broadcast-config";
import { PostPicker } from "./post-picker";
import type { BroadcastTemplateOpt } from "@/lib/broadcast-flow";
import { AiConfigEditor, AiSimulator, type DocOption } from "@/components/app/ai-config/ai-config-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeAiConfig, type PromoItem } from "@/lib/ai-agent-options";

const inputCls =
  "h-10 w-full text-sm";
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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"))}
        placeholder={placeholder}
        className={cn(inputCls, "pl-8 pr-8 font-mono")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">{"}}"}</span>
    </div>
  );
}

function KeywordInput({
  value,
  onChange,
  placeholder = "mis. harga, promo",
  lowercase = true,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  lowercase?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft
      .split(",")
      .map((s) => (lowercase ? s.trim().toLowerCase() : s.trim()))
      .filter(Boolean);
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
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-[100px] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

export type ChannelOption = { id: string; name: string; type: string; autoReply?: boolean };
export type AgentOption = { id: string; name: string; isActive: boolean; isDefault: boolean };

const IDLE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Hanya pesan pertama" },
  { value: 6, label: "Atau setelah 6 jam tidak aktif" },
  { value: 12, label: "Atau setelah 12 jam tidak aktif" },
  { value: 24, label: "Atau setelah 1 hari tidak aktif" },
  { value: 72, label: "Atau setelah 3 hari tidak aktif" },
];

// Other wordings of the same message. The engine picks one at random per send, so
// repeated bot replies read natural instead of copy-pasted (also a spam signal).
function VariantsField({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <Field label={`Variasi kalimat (${value.length}/4, opsional)`} hint="Satu kalimat dipilih acak tiap kirim supaya balasan terasa natural, tidak copy-paste.">
      <div className="space-y-2">
        {value.map((t, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Textarea
              value={t}
              rows={3}
              maxLength={1000}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={placeholder}
              className="w-full p-2.5 text-sm"
            />
            <button
              type="button"
              aria-label="Hapus variasi"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {value.length < 4 && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="size-3.5" /> Tambah variasi
          </Button>
        )}
      </div>
    </Field>
  );
}

// Bot replies on these channels are sent the way a person answers (see gateway).
const HumanizedNote = () => (
  <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
    Di WhatsApp, Facebook, dan Instagram, bot membalas seperti manusia: pesan ditandai dibaca, muncul <i>mengetik…</i>, lalu jeda sesuai panjang pesan sebelum terkirim.
  </p>
);

const CHANNEL_LABEL: Record<string, string> = {
  wa_official: "WA Official",
  wa_unofficial: "WA",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
};

// Pick the ONE account a trigger listens to ("Semua akun" = every account). Stored as
// a list for compatibility: [] = all, [id] = that account only.
function ChannelPicker({
  value,
  onChange,
  options,
  taken = new Map(),
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: ChannelOption[];
  // account id (or "*" = all) → name of the other active flow already using it
  taken?: Map<string, string>;
}) {
  if (options.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Belum ada akun yang cocok. Hubungkan dulu di menu Channel.</p>;
  }
  // Older flows may list several accounts; show the first and save a single one on change.
  const selected = value.find((id) => options.some((o) => o.id === id)) ?? null;
  // Another flow holds every account → each one is taken; "Semua akun" needs all free.
  const holder = (id: string) => taken.get(id) ?? taken.get("*");
  const allHolder = taken.get("*") ?? (taken.size ? [...taken.values()][0] : undefined);
  const row = (key: string, active: boolean, onPick: () => void, label: React.ReactNode, badge?: string, usedBy?: string) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      disabled={!!usedBy && !active}
      title={usedBy ? `Sudah dipakai flow "${usedBy}"` : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
        active ? "border-brand-blue bg-blue-50 dark:bg-blue-500/10" : "border-border hover:bg-muted/50",
        usedBy && !active && "cursor-not-allowed opacity-60 hover:bg-transparent",
        usedBy && active && "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10",
      )}
    >
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border-2", active ? "border-brand-blue" : "border-muted-foreground/40")}>
        {active && <span className="size-2 rounded-full bg-brand-blue" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {usedBy && <span className="block truncate text-[11px] text-red-600 dark:text-red-400">Dipakai flow &quot;{usedBy}&quot;</span>}
      </span>
      {badge && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{badge}</span>}
    </button>
  );
  return (
    <div role="radiogroup" className="space-y-1">
      {row("__all", selected === null, () => onChange([]), <span className="font-medium">Semua akun</span>, undefined, allHolder)}
      {options.map((c) => row(c.id, selected === c.id, () => onChange([c.id]), c.name, CHANNEL_LABEL[c.type] ?? c.type, holder(c.id)))}
      {value.length > 1 && (
        <p className="px-1 pt-1 text-[11px] text-amber-700 dark:text-amber-300">Flow ini sebelumnya memakai beberapa akun. Pilih satu akun lalu simpan.</p>
      )}
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
  onToggleDisabled,
  disabled = false,
  onClose,
  docs = [],
  promos = [],
  channels = [],
  otherFlows = [],
  tags = [],
  templates = [],
  broadcastChannelId = null,
}: {
  // Other active flows (one-account-one-flow rule for catch-all triggers).
  otherFlows?: FlowTriggerInfo[];
  docs?: DocOption[];
  promos?: PromoItem[];
  channels?: ChannelOption[];
  tags?: string[];
  templates?: BroadcastTemplateOpt[];
  // Sending account picked on the broadcast trigger (drives the Pesan Broadcast form).
  broadcastChannelId?: string | null;
  node: GraphNode;
  issues: string[];
  variables: string[];
  onChange: (payload: GraphNode["data"]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleDisabled?: () => void;
  disabled?: boolean;
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
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ["keyword", "Keyword"],
                ["comment", "Komentar FB/IG"],
                ["broadcast", "Broadcast terjadwal"],
                ["button", "Klik tombol"],
                ["welcome", "Awal percakapan"],
                ["fallback", "Cadangan"],
              ] as [TriggerKind, string][]).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set<"trigger">(k === "broadcast" || d.kind === "broadcast" ? { kind: k, channels: [] } : { kind: k })}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    d.kind === k ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10" : "border-transparent bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={hintCls}>
              {d.kind === "keyword" && "Flow mulai saat pesan pelanggan mengandung salah satu keyword."}
              {d.kind === "button" && "Flow mulai saat pelanggan mengklik tombol dengan label ini — dari template broadcast atau pesan interaktif."}
              {d.kind === "welcome" &&
                (d.idleHours
                  ? `Flow mulai di pesan pertama pelanggan, dan lagi bila pelanggan kembali setelah ${d.idleHours} jam tidak mengirim pesan.`
                  : "Flow mulai saat pelanggan mengirim pesan pertama kali.")}
              {d.kind === "fallback" && "Flow mulai saat pesan tidak cocok dengan flow lain."}
              {d.kind === "comment" &&
                "Flow mulai saat ada komentar baru di postingan Facebook Page / Instagram. Balas publik dengan Balas Komentar, kirim pesan pribadi dengan Kirim DM."}
              {d.kind === "broadcast" &&
                "Kirim pesan massal WhatsApp ke kontak opt-in pada waktu yang Anda pilih. Sambungkan ke Pesan Broadcast, lalu atur langkah saat kontak membalas atau klik tombol."}
            </p>
          </Field>
          {d.kind === "welcome" && (
            <Field label="Mulai lagi" hint="Pelanggan lama yang menyapa lagi ikut mendapat sambutan, bukan cuma kontak baru.">
              <NativeSelect
                value={String(d.idleHours ?? 0)}
                onChange={(e) => set<"trigger">({ idleHours: Number(e.target.value) || undefined })}
                className={inputCls}
              >
                {IDLE_OPTIONS.map((o) => (
                  <NativeSelectOption key={o.value} value={String(o.value)}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {d.kind === "broadcast" && <BroadcastTriggerFields d={d} set={(patch) => set<"trigger">(patch)} channels={channels} tags={tags} />}
          {d.kind === "comment" && (
            <>
              <Field label="Kata kunci komentar (opsional)" hint="Kosongkan untuk membalas SEMUA komentar. Flow dengan kata kunci didahulukan.">
                <KeywordInput value={d.keywords} onChange={(keywords) => set<"trigger">({ keywords })} placeholder="mis. harga, info, mau" />
              </Field>
              <Field label="Hanya postingan tertentu (opsional)" hint="Buat satu flow per postingan supaya tiap postingan punya balasannya sendiri.">
                <PostPicker
                  value={d.posts ?? []}
                  onChange={(posts) => set<"trigger">({ posts })}
                  accounts={channels.filter(
                    (c) => (c.type === "facebook" || c.type === "instagram") && (!d.channels?.length || d.channels.includes(c.id)),
                  )}
                />
                <div className="mt-2">
                  <KeywordInput value={d.posts ?? []} onChange={(posts) => set<"trigger">({ posts })} placeholder="atau tempel ID postingan" lowercase={false} />
                </div>
              </Field>
            </>
          )}
          {d.kind !== "broadcast" && (
          <Field
            label={d.kind === "comment" ? "Akun Facebook/Instagram" : "Berlaku untuk akun"}
            hint={d.kind === "comment" ? "Pilih Page/akun IG yang komentarnya dibalas." : "Batasi flow ke akun tertentu, mis. hanya Instagram toko A."}
          >
            <ChannelPicker
              value={d.channels ?? []}
              onChange={(ids) => set<"trigger">({ channels: ids })}
              taken={takenAccounts(d.kind, "", otherFlows)}
              options={d.kind === "comment" ? channels.filter((c) => c.type === "facebook" || c.type === "instagram") : channels}
            />
          </Field>
          )}
          {d.kind === "keyword" && (
            <Field label="Keyword" hint="Tekan Enter atau koma untuk menambah. Tidak membedakan huruf besar/kecil.">
              <KeywordInput value={d.keywords} onChange={(keywords) => set<"trigger">({ keywords })} />
            </Field>
          )}
          {d.kind === "button" && (
            <Field label="Label tombol" hint="Tulis persis seperti teks tombol di template, mis. Mau Daftar Offline. Huruf besar/kecil diabaikan.">
              <KeywordInput
                value={d.keywords}
                onChange={(keywords) => set<"trigger">({ keywords })}
                placeholder="mis. Mau Daftar Offline"
                lowercase={false}
              />
            </Field>
          )}
        </>
      );
      break;
    }
    case "reply_comment": {
      const d = node.data as NodeDataMap["reply_comment"];
      const update = (texts: string[]) => set<"reply_comment">({ texts });
      body = (
        <>
          <p className="rounded-lg bg-pink-50 p-3 text-xs leading-relaxed text-pink-900 dark:bg-pink-500/10 dark:text-pink-200">
            Balasan ini tampil <b>publik</b> di bawah komentar. Jangan tulis harga khusus atau data pribadi — arahkan ke DM.
          </p>
          <Field label={`Variasi balasan (${d.texts.length}/5)`} hint="Satu dipilih acak tiap komentar supaya tidak terlihat seperti spam.">
            <div className="space-y-2">
              {d.texts.map((t, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Textarea
                    value={t}
                    rows={2}
                    maxLength={500}
                    onChange={(e) => update(d.texts.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="Terima kasih kak {{nama}}! Cek DM ya 🙏"
                    className="w-full p-2.5 text-sm"
                  />
                  <button
                    type="button"
                    aria-label="Hapus variasi"
                    disabled={d.texts.length <= 1}
                    onClick={() => update(d.texts.filter((_, j) => j !== i))}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {d.texts.length < 5 && (
                <Button type="button" variant="outline" size="sm" onClick={() => update([...d.texts, ""])}>
                  <Plus className="size-3.5" /> Tambah variasi
                </Button>
              )}
            </div>
          </Field>
          <p className={hintCls}>Variabel: {"{{nama}}"}, {"{{komentar}}"}.</p>
        </>
      );
      break;
    }
    case "private_reply": {
      const d = node.data as NodeDataMap["private_reply"];
      body = (
        <>
          <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
            Meta hanya mengizinkan <b>1 DM per komentar</b> (maks. 7 hari). Pesan teks lain di flow ini digabung ke DM yang sama. Setelah pelanggan membalas DM, flow lanjut seperti chat biasa (mis. Tunggu Balasan / Menu).
          </p>
          <Field label="Isi DM" hint="Klik variabel untuk menyisipkan.">
            <WaMessageEditor value={d.text} onChange={(text) => set<"private_reply">({ text })} variables={waVars} rows={6} placeholder="Halo {{nama}}, ini info yang kakak tanyakan…" />
          </Field>
          <VariantsField value={d.variants ?? []} onChange={(variants) => set<"private_reply">({ variants })} placeholder="Hai kak {{nama}} 👋 makasih sudah komen, ini infonya ya…" />
        </>
      );
      break;
    }
    case "broadcast_message": {
      const d = node.data as NodeDataMap["broadcast_message"];
      body = (
        <BroadcastMessageFields
          d={d}
          set={(patch) => set<"broadcast_message">(patch)}
          channel={channels.find((c) => c.id === broadcastChannelId) ?? null}
          templates={templates}
          waVars={waVars}
        />
      );
      break;
    }
    case "send_text": {
      const d = node.data as NodeDataMap["send_text"];
      body = (
        <>
          <Field label="Isi pesan" hint="Klik variabel untuk menyisipkan, mis. {{nama}}.">
            <WaMessageEditor value={d.text} onChange={(text) => set<"send_text">({ text })} variables={waVars} rows={6} placeholder="Halo {{nama}}, ada yang bisa kami bantu?" />
          </Field>
          <VariantsField value={d.variants ?? []} onChange={(variants) => set<"send_text">({ variants })} placeholder="Hai kak {{nama}} 👋 ada yang bisa dibantu?" />
          <HumanizedNote />
        </>
      );
      break;
    }
    case "send_media": {
      const d = node.data as NodeDataMap["send_media"];
      body = (
        <>
          <Field label="URL media" hint="Link publik gambar/dokumen (https://…).">
            <Input value={d.url} onChange={(e) => set<"send_media">({ url: e.target.value })} placeholder="https://…/brosur.jpg" className={inputCls} />
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
            <Input value={d.category} onChange={(e) => set<"send_catalog">({ category: e.target.value })} placeholder="mis. Minuman" className={inputCls} />
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
                <Input
                  value={p.key}
                  onChange={(e) => update(d.pairs.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") } : x)))}
                  placeholder="nama_var"
                  className={cn(inputCls, "w-2/5 font-mono")}
                />
                <Input
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
            <NativeSelect value={d.variable} onChange={(e) => set<"condition">({ variable: e.target.value })} className={inputCls}>
              {[...new Set([d.variable, ...variables])].filter(Boolean).map((v) => (
                <NativeSelectOption key={v} value={v}>{`{{${v}}}`}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Aturan" hint="Dicek berurutan dari atas. Yang pertama cocok dipakai; tidak ada yang cocok → cabang Lainnya.">
            <div className="space-y-2">
              {d.rules.map((r, i) => {
                const needsValue = CONDITION_OPS.find((o) => o.value === r.op)?.needsValue;
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-background text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                    <NativeSelect
                      value={r.op}
                      onChange={(e) => update(d.rules.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionOp } : x)))}
                      className={cn(inputCls, "h-9 w-[44%] px-2 text-xs")}
                    >
                      {CONDITION_OPS.map((o) => (
                        <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {needsValue ? (
                      <Input
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
          <Field label="Pilihan" hint="Di WhatsApp Official tampil sebagai tombol (≤3) atau list (≤10). Di channel lain, pelanggan membalas kode atau labelnya.">
            <div className="space-y-2">
              {d.options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <Input
                    value={o.code}
                    maxLength={4}
                    onChange={(e) => update(d.options.map((x, j) => (j === i ? { ...x, code: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") } : x)))}
                    placeholder="A"
                    className={cn(inputCls, "w-14 text-center font-semibold uppercase")}
                  />
                  <Input
                    value={o.label}
                    maxLength={24}
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
    case "add_tag": {
      const d = node.data as NodeDataMap["add_tag"];
      body = (
        <Field label="Tag" hint="Tag ditambahkan ke kontak. Pakai untuk filter broadcast lanjutan, mis. daftar-offline.">
          <KeywordInput value={d.tags} onChange={(tags) => set<"add_tag">({ tags })} placeholder="mis. daftar-offline" />
        </Field>
      );
      break;
    }
    case "ai_agent": {
      const data = node.data as NodeDataMap["ai_agent"];
      const ai = normalizeAiConfig(data?.ai);
      const mode = aiNodeMode(data);
      // Older steps answered with a saved assistant; one click moves them to settings
      // on the step itself (where all AI options now live).
      body = mode !== "custom" ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-violet-50 p-3 text-[12px] leading-relaxed text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
            Langkah ini masih memakai {mode === "agent" ? <b>asisten {data?.agentName ?? "tersimpan"}</b> : <b>asisten default</b>} dari
            pengaturan lama. Atur prompt, gaya, dan info bisnis langsung di langkah ini.
          </p>
          <Button type="button" className="w-full" onClick={() => set<"ai_agent">({ mode: "custom", agentId: undefined, agentName: undefined })}>
            <SlidersHorizontal className="size-4" /> Atur di langkah ini
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="atur" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="atur" className="flex-1">
              <SlidersHorizontal className="size-3.5" /> Atur
            </TabsTrigger>
            <TabsTrigger value="uji" className="flex-1">
              <FlaskConical className="size-3.5" /> Uji AI
            </TabsTrigger>
          </TabsList>
          <TabsContent value="atur" className="space-y-3">
            <AiConfigEditor value={ai} onChange={(next) => set<"ai_agent">({ ai: next })} docs={docs} promos={promos} />
            <div className="rounded-xl border border-dashed border-border p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <div className="mb-1.5 font-semibold text-foreground">Dua jalur keluar</div>
              <div className="flex items-start gap-2">
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                <span>
                  <b className="text-foreground">Terjawab</b> — lanjut ke langkah berikutnya (opsional).
                </span>
              </div>
              <div className="mt-1 flex items-start gap-2">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground" />
                <span>
                  <b className="text-foreground">Perlu CS</b> — sambungkan untuk minta data dulu / beri tag. Kosong = langsung dialihkan ke CS.
                </span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="uji">
            <p className="mb-2 text-[11.5px] text-muted-foreground">Coba pengaturan saat ini (belum perlu disimpan) dengan AI sungguhan.</p>
            <AiSimulator value={ai} />
          </TabsContent>
        </Tabs>
      );
      break;
    }
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
        {disabled && node.type !== "trigger" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Langkah ini <b>nonaktif</b>: dilewati saat flow berjalan, lalu flow lanjut ke langkah sesudahnya. Pengaturannya tetap tersimpan.
          </p>
        )}
        {body}
      </div>

      {node.type !== "trigger" && (
        <div className="flex gap-2 border-t border-border p-3">
          {onToggleDisabled && (
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onToggleDisabled} aria-pressed={disabled}>
              <Power className="size-3.5" /> {disabled ? "Aktifkan" : "Nonaktifkan"}
            </Button>
          )}
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
