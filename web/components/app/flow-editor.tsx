"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
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

  const compiled = useMemo(() => compile(keywords, steps), [keywords, steps]);

  function addKeyword() {
    const v = kwInput.trim().toLowerCase();
    if (v && !keywords.includes(v)) setKeywords((k) => [...k, v]);
    setKwInput("");
  }
  function addStep(type: Step["type"]) {
    const s: Step =
      type === "send_text"
        ? { type, text: "" }
        : type === "wait_reply"
          ? { type, saveAs: "" }
          : { type };
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
        await gooeyToast.promise(
          saveFlow(id, { name, status, trigger: "keyword", definition: compiled }),
          { loading: "Menyimpan flow…", success: "Flow tersimpan", error: "Gagal menyimpan" },
        );
      } catch {}
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
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
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Save className="size-4" /> Simpan
        </button>
      </div>

      {/* Trigger keywords */}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
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

      {/* Steps */}
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
        {(["send_text", "wait_reply", "ai_agent", "handoff"] as Step["type"][]).map((t) => (
          <button
            key={t}
            onClick={() => addStep(t)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            <Plus className="size-3.5" /> {STEP_LABEL[t]}
          </button>
        ))}
      </div>

      <details className="mt-5 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Pratinjau JSON (definition)</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px]">
          {JSON.stringify(compiled, null, 2)}
        </pre>
      </details>
    </div>
  );
}
