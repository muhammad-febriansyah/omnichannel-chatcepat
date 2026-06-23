"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  ShoppingBag,
  UserPlus,
  ChevronDown,
  Flag,
  Info,
  Plus,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { saveFlow } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Step =
  | { type: "send_text"; text: string }
  | { type: "send_catalog"; category: string; intro: string }
  | { type: "wait_reply"; saveAs: string }
  | { type: "ai_agent" }
  | { type: "handoff" };

const STEP_LABEL: Record<Step["type"], string> = {
  send_text: "Kirim Teks",
  send_catalog: "Kirim Katalog",
  wait_reply: "Tunggu Balasan",
  ai_agent: "AI Agent",
  handoff: "Alihkan ke Agen",
};

const STEP_META: Record<Step["type"], { icon: React.ElementType; color: string; desc: string }> = {
  send_text: { icon: MessageSquare, color: "#3b82f6", desc: "Kirim pesan teks ke pelanggan" },
  send_catalog: { icon: ShoppingBag, color: "#0ea5e9", desc: "Kirim foto + harga produk aktif (katalog)" },
  wait_reply: { icon: Clock, color: "#f59e0b", desc: "Tunggu balasan, simpan ke variabel" },
  ai_agent: { icon: Sparkles, color: "#8b5cf6", desc: "Serahkan ke AI (jawab dari knowledge base)" },
  handoff: { icon: UserPlus, color: "#10b981", desc: "Alihkan ke agen manusia — flow selesai" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function parse(nodes: any[]): { keywords: string[]; steps: Step[] } {
  const trig = nodes.find((n) => n?.type === "trigger");
  const keywords: string[] = trig?.trigger?.match ?? [];
  const steps: Step[] = [];
  for (const n of nodes.filter((x) => x?.type !== "trigger")) {
    if (n.type === "send_text") steps.push({ type: "send_text", text: n.text ?? "" });
    else if (n.type === "send_catalog") steps.push({ type: "send_catalog", category: n.category ?? "", intro: n.intro ?? "" });
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
    else if (s.type === "send_catalog") nodes.push({ id, type: "send_catalog", category: s.category || undefined, intro: s.intro || undefined, next });
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
    <div className="rounded-2xl border border-border bg-[radial-gradient(circle_at_1px_1px,theme(colors.slate.200)_1px,transparent_0)] [background-size:18px_18px] p-5 dark:bg-[radial-gradient(circle_at_1px_1px,theme(colors.slate.700)_1px,transparent_0)]">
      <div className="flex flex-col items-center">
        {/* Trigger */}
        <div className="w-full max-w-[280px] rounded-xl border-l-4 border-brand-navy bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-brand-navy" /> Trigger · keyword
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {keywords.length ? (
              keywords.map((k) => (
                <span key={k} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-brand-blue dark:bg-blue-500/10 dark:text-blue-300">
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
                : s.type === "send_catalog"
                  ? `kirim produk${s.category ? ` · ${s.category}` : " (semua)"}`
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Simulasi Flow"
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">Simulasi Flow</h3>
            <p className="text-[11px] text-muted-foreground">Pratinjau — tidak mengirim pesan nyata.</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
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
                    <div className="mb-0.5 text-[10px] font-semibold text-brand-blue dark:text-blue-300">Bot</div>
                    {s.text || <span className="text-muted-foreground">(teks kosong)</span>}
                  </div>
                </div>
              );
            }
            const marker =
              s.type === "send_catalog"
                ? `🛍 Kirim katalog produk${s.category ? ` (${s.category})` : ""} — foto + harga`
                : s.type === "wait_reply"
                  ? `⏸ Menunggu balasan user → simpan ke "${s.saveAs || "var"}"`
                  : s.type === "ai_agent"
                    ? "🤖 Diserahkan ke AI agent (jawab dari knowledge base)"
                    : "👤 Dialihkan ke agen manusia — flow selesai";
            return (
              <div key={i} className="flex justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
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
      type === "send_text"
        ? { type, text: "" }
        : type === "send_catalog"
          ? { type, category: "", intro: "" }
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
        <ArrowLeft className="size-4" /> Kembali ke daftar flow
      </Link>

      {/* Action bar — sticky agar Simpan/Test selalu terjangkau di flow panjang */}
      <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nama flow"
          placeholder="Nama flow…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-lg font-bold outline-none focus:border-brand-blue"
        />
        <button
          type="button"
          onClick={() => setStatus((s) => (s === "active" ? "draft" : "active"))}
          aria-pressed={status === "active"}
          title={status === "active" ? "Aktif — klik untuk jadikan draft" : "Draft — klik untuk mengaktifkan"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-border bg-muted text-muted-foreground hover:bg-muted",
          )}
        >
          <span className={cn("size-1.5 rounded-full", status === "active" ? "bg-emerald-500" : "bg-slate-400")} />
          {status === "active" ? "Aktif" : "Draft"}
        </button>
        <Button type="button" variant="outline" size="lg" onClick={() => setTestOpen(true)}>
          <Play className="size-4 text-brand-blue" /> Test
        </Button>
        <Button type="button" size="lg" onClick={save} disabled={pending}>
          <Save className="size-4" /> Simpan
        </Button>
      </div>

      {/* Help — jelaskan cara baca flow */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-muted-foreground dark:border-blue-500/20 dark:bg-blue-500/10">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-blue" />
        <p>
          Flow berjalan dari <strong className="font-semibold text-foreground">atas ke bawah</strong>: saat pelanggan
          mengirim salah satu <strong className="font-semibold text-foreground">keyword</strong>, bot menjalankan setiap{" "}
          <strong className="font-semibold text-foreground">langkah</strong> berurutan sampai selesai. Klik{" "}
          <strong className="font-semibold text-foreground">Test</strong> untuk simulasi tanpa mengirim pesan nyata.
        </p>
      </div>

      {testOpen && <FlowTestPanel keywords={keywords} steps={steps} onClose={() => setTestOpen(false)} />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor */}
        <div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-brand-navy" />
              <h2 className="text-sm font-semibold">Trigger · keyword</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Pesan masuk yang cocok dengan salah satu keyword akan memulai flow.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-2.5 pr-1.5 text-xs text-brand-blue dark:bg-blue-500/10 dark:text-blue-300">
                  {k}
                  <button
                    type="button"
                    onClick={() => setKeywords((x) => x.filter((y) => y !== k))}
                    aria-label={`Hapus keyword ${k}`}
                    className="grid size-4 place-items-center rounded-full text-brand-blue/70 hover:bg-brand-blue/15 hover:text-brand-blue"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                onBlur={addKeyword}
                aria-label="Tambah keyword"
                placeholder="+ ketik keyword, Enter"
                className="w-40 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Langkah</h2>
          <div className="space-y-2">
            {steps.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-xs text-muted-foreground">
                Belum ada langkah. Tambahkan langkah pertama dari tombol di bawah.
              </div>
            )}
            {steps.map((s, i) => {
              const meta = STEP_META[s.type];
              const Icon = meta.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${meta.color}1a` }}>
                        <Icon className="size-3.5" style={{ color: meta.color }} />
                      </span>
                      <span className="truncate">{i + 1}. {STEP_LABEL[s.type]}</span>
                    </span>
                    <div className="flex shrink-0 gap-0.5 text-muted-foreground">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Pindah ke atas" className="grid size-7 place-items-center rounded-md hover:bg-muted hover:text-foreground disabled:opacity-30"><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Pindah ke bawah" className="grid size-7 place-items-center rounded-md hover:bg-muted hover:text-foreground disabled:opacity-30"><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label="Hapus langkah" className="grid size-7 place-items-center rounded-md hover:bg-danger/10 hover:text-danger"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  {s.type === "send_text" && (
                    <textarea
                      value={s.text}
                      onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
                      rows={2}
                      placeholder="Tulis pesan… boleh pakai {{nama}} untuk personalisasi"
                      className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-brand-blue"
                    />
                  )}
                  {s.type === "send_catalog" && (
                    <div className="space-y-2">
                      <input
                        value={s.intro}
                        onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, intro: e.target.value } : y)))}
                        placeholder="Teks pembuka (opsional, mis. Ini katalog kami 👇)"
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
                      />
                      <input
                        value={s.category}
                        onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, category: e.target.value } : y)))}
                        placeholder="Filter kategori (opsional, kosong = semua produk aktif)"
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
                      />
                    </div>
                  )}
                  {s.type === "wait_reply" && (
                    <input
                      value={s.saveAs}
                      onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, saveAs: e.target.value } : y)))}
                      placeholder="Simpan jawaban ke variabel (mis. menu)"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
                    />
                  )}
                  {(s.type === "ai_agent" || s.type === "handoff") && (
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Tambah langkah</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["send_text", "send_catalog", "wait_reply", "ai_agent", "handoff"] as Step["type"][]).map((t) => {
              const meta = STEP_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => addStep(t)}
                  className="group flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-card p-2.5 text-left transition hover:border-brand-blue/40 hover:bg-muted/50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${meta.color}1a` }}>
                    <Icon className="size-4" style={{ color: meta.color }} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <Plus className="size-3 text-muted-foreground transition group-hover:text-brand-blue" /> {STEP_LABEL[t]}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{meta.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <details className="mt-5 rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Pratinjau JSON (definition)</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-[11px]">{JSON.stringify(compiled, null, 2)}</pre>
          </details>
        </div>

        {/* Canvas */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alur Visual</h2>
          <FlowCanvas keywords={keywords} steps={steps} />
        </div>
      </div>
    </div>
  );
}
