"use client";

import { useState, useTransition } from "react";
import { Sparkles, FileText, Wrench, Send, Save, Plus } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { addKnowledge, previewAi, savePersona } from "@/lib/actions";

type Doc = { id: string; title: string; status: string; sourceType: string };

const TOOLS = [
  "cek_ongkir(tujuan, berat)",
  "buat_invoice(items, contact)",
  "cek_pembayaran(invoice_id)",
  "cek_stok(produk)",
  "eskalasi_ke_agen(alasan)",
];

export function AiAgentPanel({ persona, docs }: { persona: string; docs: Doc[] }) {
  const [personaText, setPersonaText] = useState(persona);
  const [kbTitle, setKbTitle] = useState("");
  const [kbText, setKbText] = useState("");
  const [previewMsg, setPreviewMsg] = useState("");
  const [previewAns, setPreviewAns] = useState<string | null>(null);
  const [savingP, startSaveP] = useTransition();
  const [addingKb, startKb] = useTransition();
  const [previewing, startPreview] = useTransition();

  function doSavePersona() {
    startSaveP(async () => {
      try {
        await gooeyToast.promise(savePersona(personaText), {
          loading: "Menyimpan persona…",
          success: "Persona tersimpan",
          error: "Gagal menyimpan",
        });
      } catch {}
    });
  }

  function doAddKb() {
    if (!kbTitle.trim() || !kbText.trim()) return gooeyToast.error("Judul & isi wajib");
    startKb(async () => {
      try {
        await gooeyToast.promise(addKnowledge(kbTitle, kbText), {
          loading: "Memproses & meng-embed dokumen…",
          success: "Dokumen ditambahkan",
          error: (e: unknown) => (e instanceof Error ? e.message : "Gagal"),
        });
        setKbTitle("");
        setKbText("");
      } catch {}
    });
  }

  function doPreview() {
    if (!previewMsg.trim()) return;
    startPreview(async () => {
      try {
        const r = await previewAi(previewMsg, personaText);
        if (!r.enabled) {
          setPreviewAns("(AI nonaktif — set LLM_PROVIDER di engine)");
        } else {
          setPreviewAns(r.answer ?? "(tidak ada jawaban)");
        }
      } catch (e) {
        gooeyToast.error(e instanceof Error ? e.message : "Gagal preview");
      }
    });
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">AI Agent</h1>
        <p className="text-sm text-muted-foreground">Persona, knowledge base, tools — gaya Halo AI.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Persona */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-brand-blue" />
            <h2 className="text-base font-semibold">Persona</h2>
          </div>
          <textarea
            value={personaText}
            onChange={(e) => setPersonaText(e.target.value)}
            rows={6}
            placeholder="Kamu asisten sales toko… ramah, Bahasa Indonesia, dorong penjualan tanpa memaksa."
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
          <button
            onClick={doSavePersona}
            disabled={savingP}
            className="mt-3 flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save className="size-4" /> Simpan Persona
          </button>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Send className="size-4 text-brand-blue" />
            <h2 className="text-base font-semibold">Uji Jawaban</h2>
          </div>
          <div className="flex gap-2">
            <input
              value={previewMsg}
              onChange={(e) => setPreviewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doPreview()}
              placeholder="Tanya sesuatu…"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <button
              onClick={doPreview}
              disabled={previewing}
              className="rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {previewing ? "…" : "Tanya"}
            </button>
          </div>
          {previewAns !== null && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-foreground">{previewAns}</div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Pakai RAG dari knowledge base (filter tenant) + persona di atas.
          </p>
        </div>

        {/* Knowledge base */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-4 text-brand-blue" />
            <h2 className="text-base font-semibold">Knowledge Base ({docs.length})</h2>
          </div>
          <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto">
            {docs.length === 0 && <p className="text-xs text-muted-foreground">Belum ada dokumen.</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="truncate">{d.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${d.status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
          <input
            value={kbTitle}
            onChange={(e) => setKbTitle(e.target.value)}
            placeholder="Judul dokumen (mis. Katalog Produk)"
            className="mb-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
          <textarea
            value={kbText}
            onChange={(e) => setKbText(e.target.value)}
            rows={4}
            placeholder="Paste teks pengetahuan (produk, FAQ, SOP)…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
          <button
            onClick={doAddKb}
            disabled={addingKb}
            className="mt-3 flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> Tambah & Embed
          </button>
        </div>

        {/* Tools */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="size-4 text-brand-blue" />
            <h2 className="text-base font-semibold">Tools</h2>
          </div>
          <ul className="space-y-1.5 text-sm">
            {TOOLS.map((t) => (
              <li key={t} className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Tool dipanggil via API tenant (function calling). Konfigurasi tool — TODO.
          </p>
        </div>
      </div>
    </div>
  );
}
