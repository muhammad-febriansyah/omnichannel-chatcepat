"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Play,
  X,
  Zap,
  MessageSquare,
  Clock,
  Sparkles,
  UserPlus,
  ChevronDown,
  Flag,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { saveFlow } from "@/lib/actions";
import { cn } from "@/lib/utils";

type Step =
  | { type: "send_text"; text: string }
  | { type: "wait_reply"; saveAs: string }
  | { type: "ai_agent" }
  | { type: "handoff" };

const STEP_LABEL: Record<Step["type"], string> = {
  send_text: "Kirim Teks",
  wait_reply: "Tunggu Balasan",
  ai_agent: "AI Agent",
  handoff: "Alihkan ke Agen",
};

const STEP_META: Record<Step["type"], { icon: React.ElementType; color: string }> = {
  send_text: { icon: MessageSquare, color: "#3b82f6" },
  wait_reply: { icon: Clock, color: "#f59e0b" },
  ai_agent: { icon: Sparkles, color: "#8b5cf6" },
  handoff: { icon: UserPlus, color: "#10b981" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function parse(nodes: any[]): { keywords: string[]; steps: Step[] } {
  const trig = nodes.find((n) => n?.type === "trigger");
  const keywords: string[] = trig?.trigger?.match ?? [];
  const steps: Step[] = [];
  for (const n of nodes.filter((x) => x?.type !== "trigger")) {
    if (n.type === "send_text") steps.push({ type: "send_text", text: n.text ?? "" });
    else if (n.type === "wait_reply") steps.push({ type: "wait_reply", saveAs: n.save_as ?? "" });
    else if (n.type === "ai_agent") steps.push({ type: "ai_agent" });
    else if (n.type === "handoff") steps.push({ type: "handoff" });
  }
  return { keywords, steps };
}

function compile(keywords: string[], steps: Step[]) {
  const nodes: any[] = [
    {
      id: "start",
      type: "trigger",
      trigger: { kind: "keyword", match: keywords },
      next: steps.length ? "s0" : null,
    },
  ];
  steps.forEach((s, i) => {
    const id = `s${i}`;
    const next = i < steps.length - 1 ? `s${i + 1}` : null;
    if (s.type === "send_text") nodes.push({ id, type: "send_text", text: s.text, next });
    else if (s.type === "wait_reply") nodes.push({ id, type: "wait_reply", save_as: s.saveAs || `var${i}`, next });
    else if (s.type === "ai_agent") nodes.push({ id, type: "ai_agent", next });
    else if (s.type === "handoff") nodes.push({ id, type: "handoff", to: "agent" });
  });
  return { nodes };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------- Canvas visual (read-only, live dari steps) ---------- */
function Connector() {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <div className="h-5 w-px bg-border" />
      <ChevronDown className="-mt-1.5 size-3.5 text-muted-foreground" />
    </div>
  );
}

function FlowCanvas({ keywords, steps }: { keywords: string[]; steps: Step[] }) {
  return (
    <div className="rounded-xl border border-border bg-[radial-gradient(circle_at_1px_1px,theme(colors.slate.200)_1px,transparent_0)] [background-size:18px_18px] p-5">
      <div className="flex flex-col items-center">
        {/* Trigger */}
        <div className="w-full max-w-[280px] rounded-xl border-l-4 border-brand-navy bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-brand-navy" /> Trigger · keyword
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {keywords.length ? (
              keywords.map((k) => (
                <span key={k} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-brand-blue">
                  {k}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">belum ada keyword</span>
            )}
          </div>
        </div>

        {steps.length === 0 ? (
          <>
            <Connector />
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Tambah langkah →
            </div>
          </>
        ) : (
          steps.map((s, i) => {
            const meta = STEP_META[s.type];
            const Icon = meta.icon;
            const summary =
              s.type === "send_text"
                ? s.text || "(teks kosong)"
                : s.type === "wait_reply"
                  ? `simpan → ${s.saveAs || "var"}`
                  : s.type === "ai_agent"
                    ? "serahkan ke AI"
                    : "alihkan ke agen (selesai)";
            return (
              <div key={i} className="flex w-full flex-col items-center">
                <Connector />
                <div className="w-full max-w-[280px] rounded-xl border-l-4 bg-card p-3 shadow-sm" style={{ borderColor: meta.color }}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4" style={{ color: meta.color }} />
                    {i + 1}. {STEP_LABEL[s.type]}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{summary}</p>
                </div>
              </div>
            );
          })
        )}

        {(steps.length === 0 || steps[steps.length - 1]?.type !== "handoff") && (
          <>
            <Connector />
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Flag className="size-3.5" /> Selesai
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Test panel (simulasi dry-run, tanpa kirim nyata) ---------- */
function FlowTestPanel({ keywords, steps, onClose }: { keywords: string[]; steps: Step[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">Simulasi Flow</h3>
            <p className="text-[11px] text-muted-foreground">Pratinjau — tidak mengirim pesan nyata.</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-background p-4">
          {/* User memicu */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-blue to-brand-light px-3.5 py-2 text-sm text-white">
              {keywords[0] ?? "(keyword)"}
            </div>
          </div>

          {steps.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada langkah.</p>}

          {steps.map((s, i) => {
            if (s.type === "send_text") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2 text-sm">
                    <div className="mb-0.5 text-[10px] font-semibold text-brand-blue">Bot</div>
                    {s.text || <span className="text-muted-foreground">(teks kosong)</span>}
                  </div>
                </div>
              );
            }
            const marker =
              s.type === "wait_reply"
                ? `⏸ Menunggu balasan user → simpan ke "${s.saveAs || "var"}"`
                : s.type === "ai_agent"
                  ? "🤖 Diserahkan ke AI agent (jawab dari knowledge base)"
                  : "👤 Dialihkan ke agen manusia — flow selesai";
            return (
              <div key={i} className="flex justify-center">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
                  {marker}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FlowEditor({
  id,
  name: initName,
  status: initStatus,
  definition,
}: {
  id: string;
  name: string;
  status: "draft" | "active";
  definition: { nodes?: unknown[] };
}) {
  const parsed = useMemo(() => parse((definition.nodes as never[]) ?? []), [definition]);
  const [name, setName] = useState(initName);
  const [status, setStatus] = useState<"draft" | "active">(initStatus);
  const [keywords, setKeywords] = useState<string[]>(parsed.keywords);
  const [kwInput, setKwInput] = useState("");
  const [steps, setSteps] = useState<Step[]>(parsed.steps);
  const [pending, start] = useTransition();
  const [testOpen, setTestOpen] = useState(false);

  const compiled = useMemo(() => compile(keywords, steps), [keywords, steps]);

  function addKeyword() {
    const v = kwInput.trim().toLowerCase();
    if (v && !keywords.includes(v)) setKeywords((k) => [...k, v]);
    setKwInput("");
  }
  function addStep(type: Step["type"]) {
    const s: Step =
      type === "send_text" ? { type, text: "" } : type === "wait_reply" ? { type, saveAs: "" } : { type };
    setSteps((x) => [...x, s]);
  }
  function move(i: number, d: number) {
    setSteps((x) => {
      const a = [...x];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }

  function save() {
    if (!name.trim()) return gooeyToast.error("Nama flow wajib");
    start(async () => {
      try {
        await gooeyToast.promise(saveFlow(id, { name, status, trigger: "keyword", definition: compiled }), {
          loading: "Menyimpan flow…",
          success: "Flow tersimpan",
          error: "Gagal menyimpan",
        });
      } catch {}
    });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/flows" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      <div className="flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-lg font-bold outline-none focus:border-brand-blue"
        />
        <button
          onClick={() => setStatus((s) => (s === "active" ? "draft" : "active"))}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
          )}
        >
          {status === "active" ? "Aktif" : "Draft"}
        </button>
        <button
          onClick={() => setTestOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          <Play className="size-4 text-brand-blue" /> Test
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Save className="size-4" /> Simpan
        </button>
      </div>

      {testOpen && <FlowTestPanel keywords={keywords} steps={steps} onClose={() => setTestOpen(false)} />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor */}
        <div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Trigger (keyword)</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-brand-blue">
                  {k}
                  <button onClick={() => setKeywords((x) => x.filter((y) => y !== k))}>×</button>
                </span>
              ))}
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="+ keyword"
                className="w-28 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs outline-none"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {i + 1}. {STEP_LABEL[s.type]}
                  </span>
                  <div className="flex gap-1 text-muted-foreground">
                    <button onClick={() => move(i, -1)} className="hover:text-foreground"><ArrowUp className="size-4" /></button>
                    <button onClick={() => move(i, 1)} className="hover:text-foreground"><ArrowDown className="size-4" /></button>
                    <button onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} className="hover:text-danger"><Trash2 className="size-4" /></button>
                  </div>
                </div>
                {s.type === "send_text" && (
                  <textarea
                    value={s.text}
                    onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
                    rows={2}
                    placeholder="Teks (boleh {{nama}})"
                    className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-brand-blue"
                  />
                )}
                {s.type === "wait_reply" && (
                  <input
                    value={s.saveAs}
                    onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, saveAs: e.target.value } : y)))}
                    placeholder="Simpan jawaban ke variabel (mis. menu)"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
                  />
                )}
                {s.type === "ai_agent" && <p className="text-xs text-muted-foreground">Serahkan ke AI agent.</p>}
                {s.type === "handoff" && <p className="text-xs text-muted-foreground">Alihkan ke agen manusia (terminal).</p>}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["send_text", "wait_reply", "ai_agent", "handoff"] as Step["type"][]).map((t) => {
              const Icon = STEP_META[t].icon;
              return (
                <button
                  key={t}
                  onClick={() => addStep(t)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  <Icon className="size-3.5" style={{ color: STEP_META[t].color }} /> {STEP_LABEL[t]}
                </button>
              );
            })}
          </div>

          <details className="mt-5 rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Pratinjau JSON (definition)</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px]">{JSON.stringify(compiled, null, 2)}</pre>
          </details>
        </div>

        {/* Canvas */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alur Visual</h2>
          <FlowCanvas keywords={keywords} steps={steps} />
        </div>
      </div>
    </div>
  );
}
