"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorMessage } from "@/lib/action-error";
import { useState, useTransition } from "react";
import { Plus, Trash2, Send, Loader2, Layers, Palette, NotebookPen, BookOpen, Headset, UserRound, Store, WandSparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { simulateAgent, type SimulateResult } from "@/lib/ai-agent-actions";
import {
  BUSINESS_FIELDS,
  EMOJIS,
  PROMPT_TEMPLATES,
  roleLabel,
  GREETINGS,
  LANGUAGES,
  LENGTHS,
  ROLES,
  TONES,
  toneMeta,
  type AgentTone,
  type AiConfig,
  type BusinessInfo,
  type KnowledgeDoc,
  type PromoItem,
} from "@/lib/ai-agent-options";
import { KnowledgeDocs, PromoManager } from "./knowledge-section";

export type DocOption = KnowledgeDoc;

const inputCls =
  "h-9 w-full text-sm";
const areaCls =
  "w-full p-2.5 text-sm";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Section({
  value,
  icon: Icon,
  title,
  hint,
  children,
}: {
  value: string;
  icon: React.ElementType;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-[20px] bg-card not-last:border-b">
      <AccordionTrigger className="items-center gap-2.5 px-3 py-2.5 hover:no-underline">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{title}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">{hint}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 px-3 pb-3 pt-1 [&_p:not(:last-child)]:mb-0">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// All AI settings in one compact column for the AI Agent node side panel, including
// the shared knowledge documents and promos.
export function AiConfigEditor({
  value: v,
  onChange,
  docs,
  promos = [],
  defaultOpen = ["gaya"],
}: {
  value: AiConfig;
  onChange: (v: AiConfig) => void;
  docs: KnowledgeDoc[];
  promos?: PromoItem[];
  defaultOpen?: string[];
}) {
  const set = <K extends keyof AiConfig>(k: K, x: AiConfig[K]) => onChange({ ...v, [k]: x });
  const setInfo = (k: keyof BusinessInfo, x: string) => set("businessInfo", { ...v.businessInfo, [k]: x });
  const infoCount = BUSINESS_FIELDS.filter((f) => v.businessInfo[f.key].trim()).length;
  const identityHint = [
    v.businessInfo.assistantName.trim() || "Tanpa nama",
    v.businessInfo.businessName.trim(),
    `${infoCount} info bisnis`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Sample prompt for the chosen role; appended so nothing typed gets lost.
  function insertSample() {
    const sample = PROMPT_TEMPLATES[v.role];
    if (v.instructions.includes(sample)) return;
    const next = v.instructions.trim() ? `${v.instructions.trim()}\n\n${sample}` : sample;
    set("instructions", next.slice(0, 3000));
  }
  function insertToken(token: string) {
    set("instructions", `${v.instructions}${v.instructions && !v.instructions.endsWith(" ") ? " " : ""}${token}`.slice(0, 3000));
  }

  const filledExamples = v.examples.filter((x) => x.q.trim() && x.a.trim()).length;
  const knowledgeHint = [
    v.knowledgeAll ? "Semua dokumen" : `${v.documentIds.length} dokumen`,
    v.useCatalog && "katalog",
    v.usePromos && "promo",
  ]
    .filter(Boolean)
    .join(" · ");
  const handoffCount = v.handoffRules.split("\n").filter((l) => l.trim()).length;

  return (
    <Accordion multiple defaultValue={defaultOpen} className="gap-2">
      <Section value="identitas" icon={Store} title="Identitas & info bisnis" hint={identityHint}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-[11.5px] font-medium">Nama asisten</span>
            <Input value={v.businessInfo.assistantName} maxLength={40} onChange={(e) => setInfo("assistantName", e.target.value)} placeholder="mis. Rina" className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="block text-[11.5px] font-medium">Nama bisnis</span>
            <Input value={v.businessInfo.businessName} maxLength={80} onChange={(e) => setInfo("businessName", e.target.value)} placeholder="mis. Toko Mulia" className={inputCls} />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">AI hanya menyebut fakta yang Anda isi di sini, di Pengetahuan, katalog, atau promo.</p>
        <div className="grid gap-2.5">
          {BUSINESS_FIELDS.map((f) => (
            <label key={f.key} className="space-y-1">
              <span className="block text-[11.5px] font-medium">{f.label}</span>
              {f.rows ? (
                <Textarea value={v.businessInfo[f.key]} maxLength={f.max} rows={f.rows} onChange={(e) => setInfo(f.key, e.target.value)} placeholder={f.placeholder} className={areaCls} />
              ) : (
                <Input value={v.businessInfo[f.key]} maxLength={f.max} onChange={(e) => setInfo(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
              )}
            </label>
          ))}
        </div>
      </Section>

      <Section value="gaya" icon={Palette} title="Peran & gaya" hint={`${roleLabel(v.role)} · ${toneMeta(v.tone).emoji} ${toneMeta(v.tone).label}`}>
        <Group title="Peran">
          <NativeSelect value={v.role} onChange={(e) => set("role", e.target.value as AiConfig["role"])} className={inputCls}>
            {ROLES.map((r) => (
              <NativeSelectOption key={r.value} value={r.value}>
                {r.label} — {r.desc}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Input value={v.goal} maxLength={200} onChange={(e) => set("goal", e.target.value)} placeholder="Tujuan (opsional), mis. arahkan sampai checkout" className={inputCls} />
        </Group>

        <Group title="Gaya balasan">
          <div className="grid grid-cols-2 gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={v.tone === t.value}
                onClick={() => set("tone", t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                  v.tone === t.value ? "border-brand-blue bg-blue-50 ring-2 ring-brand-blue/10 dark:bg-blue-500/10" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{t.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-[#efeae2] p-2.5 dark:bg-[#0b141a]">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#667781]">Contoh gaya</div>
            <div className="max-w-[95%] rounded-xl rounded-tl-sm bg-white px-2.5 py-1.5 text-[12px] leading-relaxed text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              {toneMeta(v.tone).sample}
            </div>
          </div>
        </Group>

        <div className="grid gap-3">
          {(
            [
              ["Emoji", <Chips key="e" value={v.emoji} options={EMOJIS} onChange={(x) => set("emoji", x)} />],
              ["Panjang", <Chips key="p" value={v.length} options={LENGTHS} onChange={(x) => set("length", x)} />],
              ["Sapaan", <Chips key="s" value={v.greeting} options={GREETINGS} onChange={(x) => set("greeting", x)} />],
              ["Bahasa", <Chips key="b" value={v.language} options={LANGUAGES} onChange={(x) => set("language", x)} />],
            ] as const
          ).map(([label, chips]) => (
            <div key={label} className="space-y-1.5">
              <div className="text-[11.5px] font-medium">{label}</div>
              {chips}
            </div>
          ))}
        </div>
      </Section>

      <Section
        value="instruksi"
        icon={NotebookPen}
        title="Instruksi & contoh"
        hint={[v.instructions.trim() ? "Ada prompt" : "Belum ada prompt", `${filledExamples} contoh`].join(" · ")}
      >
        <Group title="Prompt / instruksi">
          <p className="text-[11px] text-muted-foreground">
            Jelaskan siapa asisten ini dan cara kerjanya, mis. &quot;Kamu adalah customer service…&quot;.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={insertSample} className="w-full">
            <WandSparkles className="size-3.5" /> Pakai contoh prompt {roleLabel(v.role)}
          </Button>
          <Textarea
            value={v.instructions}
            maxLength={3000}
            rows={6}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="mis. Kamu adalah {{nama_asisten}}, customer service {{nama_bisnis}}. Selalu tawarkan bundling."
            className={areaCls}
          />
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap gap-1">
              {["{{nama_asisten}}", "{{nama_bisnis}}"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insertToken(t)}
                  className="rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground hover:border-brand-blue hover:text-brand-blue"
                >
                  + {t}
                </button>
              ))}
            </div>
            <span className="text-[10.5px] text-muted-foreground">{v.instructions.length}/3000</span>
          </div>
        </Group>

        <Group title={`Contoh jawaban (${v.examples.length}/5)`}>
          <p className="text-[11px] text-muted-foreground">AI meniru gaya contoh, bukan isinya. Fakta tetap dari Pengetahuan.</p>
          {v.examples.map((ex, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
              <div className="flex gap-1.5">
                <Input
                  value={ex.q}
                  onChange={(e) => set("examples", v.examples.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                  placeholder="Pelanggan bertanya…"
                  className={cn(inputCls, "h-8 text-xs")}
                />
                <button
                  type="button"
                  aria-label="Hapus contoh"
                  onClick={() => set("examples", v.examples.filter((_, j) => j !== i))}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-red-500"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Textarea
                value={ex.a}
                rows={2}
                onChange={(e) => set("examples", v.examples.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                placeholder="Jawaban ideal…"
                className={cn(areaCls, "text-xs")}
              />
            </div>
          ))}
          {v.examples.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => set("examples", [...v.examples, { q: "", a: "" }])}>
              <Plus className="size-3.5" /> Tambah contoh
            </Button>
          )}
        </Group>
      </Section>

      <Section value="pengetahuan" icon={BookOpen} title="Pengetahuan & promo" hint={knowledgeHint || "Tanpa pengetahuan"}>
        <Group title="Dokumen">
          <KnowledgeDocs
            docs={docs}
            all={v.knowledgeAll}
            selected={v.documentIds}
            onAllChange={(x) => set("knowledgeAll", x)}
            onSelectedChange={(ids) => set("documentIds", ids)}
          />
        </Group>
        <Group title="Katalog">
          <Toggle label="Pakai katalog produk" hint="Harga & stok terkini dari menu Produk" checked={v.useCatalog} onChange={(x) => set("useCatalog", x)} />
        </Group>
        <Group title="Promo">
          <PromoManager promos={promos} enabled={v.usePromos} onEnabledChange={(x) => set("usePromos", x)} />
        </Group>
      </Section>

      <Section value="cs" icon={Headset} title="Alihkan ke CS" hint={handoffCount ? `${handoffCount} aturan tambahan` : "Aturan bawaan"}>
        <Group title="Alihkan ke CS jika…">
          <Textarea
            value={v.handoffRules}
            maxLength={1000}
            rows={3}
            onChange={(e) => set("handoffRules", e.target.value)}
            placeholder={"Satu aturan per baris, mis.\nTanya kemitraan/franchise"}
            className={areaCls}
          />
          <p className="text-[11px] text-muted-foreground">Sudah otomatis: minta manusia, komplain serius, negosiasi harga, data tidak tersedia.</p>
        </Group>
        <Group title="Pesan cadangan">
          <Input value={v.fallbackMessage} maxLength={300} onChange={(e) => set("fallbackMessage", e.target.value)} placeholder="Bila AI tak bisa menjawab (opsional)" className={inputCls} />
        </Group>
      </Section>
    </Accordion>
  );
}

const SAMPLE_QUESTIONS = ["Ada promo apa kak?", "Ongkir ke Bandung berapa?", "Barang saya rusak, kecewa!", "Bisa nego harga?"];

// Try the settings above against the real model, optionally in 3 tones side by side.
export function AiSimulator({ value }: { value: AiConfig }) {
  const [question, setQuestion] = useState("Ada promo apa kak?");
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [asked, setAsked] = useState("");
  const [pending, start] = useTransition();

  function run(compare: boolean, q = question) {
    if (!q.trim()) return gooeyToast.error("Tulis pertanyaan untuk dicoba");
    setQuestion(q);
    setAsked(q.trim());
    const others = (["ramah", "promosi", "singkat", "profesional"] as AgentTone[]).filter((t) => t !== value.tone);
    start(async () => {
      try {
        setResult(await simulateAgent(q, { ...value, name: "Simulasi", isActive: true }, compare ? [value.tone, ...others.slice(0, 2)] : undefined));
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menjalankan simulasi");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(false)}
          placeholder="Tulis pertanyaan pelanggan…"
          className={inputCls}
        />
        <Button onClick={() => run(false)} disabled={pending} size="icon" aria-label="Kirim pertanyaan">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending}
            onClick={() => run(false, q)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={() => run(true)} disabled={pending}>
        <Layers className="size-3.5" /> Bandingkan 3 gaya
      </Button>
      {(result || pending) && (
        <div className="space-y-1.5 rounded-lg bg-[#efeae2] p-2.5 dark:bg-[#0b141a]">
          {asked && (
            <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[12px] text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
              {asked}
            </div>
          )}
          {pending ? (
            <div className="flex w-fit items-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm dark:bg-[#202c33]">
              <span className="size-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[#667781]" />
            </div>
          ) : !result ? null : (
          !result.enabled ? (
            <p className="text-xs text-muted-foreground">AI belum aktif. Superadmin perlu menghubungkan provider AI di Konsol → AI &amp; Token.</p>
          ) : result.quotaExceeded ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Token AI habis. Beli top-up di <a href="/billing" className="font-medium underline">Tagihan &amp; Paket</a>.
            </p>
          ) : (
            <>
              {result.answers.map((a) => (
                <div key={a.tone} className="max-w-[95%] rounded-xl rounded-tl-sm bg-white px-2.5 py-1.5 text-[12px] leading-relaxed text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
                  {result.answers.length > 1 && (
                    <div className="mb-0.5 text-[10.5px] font-semibold text-brand-blue">
                      {toneMeta(a.tone).emoji} {toneMeta(a.tone).label}
                    </div>
                  )}
                  {a.answer.includes("[[HANDOFF]]") ? (
                    <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                      <UserRound className="size-3.5" /> Dialihkan ke CS
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{a.answer || "(tidak ada jawaban)"}</div>
                  )}
                </div>
              ))}
              {result.sources.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10.5px] font-medium text-muted-foreground">Jawaban berdasarkan:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.sources.map((s) => (
                      <span key={s} className="max-w-full truncate rounded-md bg-white/80 px-1.5 py-0.5 text-[10.5px] text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]" title={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10.5px] text-amber-700 dark:text-amber-300">
                  Tidak ada data yang cocok — tambahkan di Automation → Pengetahuan supaya AI tidak menebak.
                </p>
              )}
            </>
          ))}
        </div>
      )}
    </div>
  );
}
