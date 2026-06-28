"use client";

import { useState, useTransition } from "react";
import { Save, Plus } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { addKnowledge, previewAi, savePersona } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { KbMarkdownEditor } from "@/components/app/kb-markdown-editor";
import { StatusPill } from "@/components/app/status-pill";
import { statusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";

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
      <PageHeader
        title="AI Agent"
        description="Persona, knowledge base, tools — gaya Halo AI."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Persona */}
        <SectionCard
          title="Persona"
          description="Atur gaya & instruksi dasar AI."
        >
          <textarea
            value={personaText}
            onChange={(e) => setPersonaText(e.target.value)}
            rows={6}
            placeholder="Kamu asisten sales toko… ramah, Bahasa Indonesia, dorong penjualan tanpa memaksa."
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
          <Button onClick={doSavePersona} disabled={savingP} size="lg" className="mt-3">
            <Save className="size-4" /> Simpan Persona
          </Button>
        </SectionCard>

        {/* Preview */}
        <SectionCard
          title="Uji Jawaban"
          description="Pratinjau jawaban AI memakai persona & knowledge base."
        >
          <div className="flex gap-2">
            <input
              value={previewMsg}
              onChange={(e) => setPreviewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doPreview()}
              placeholder="Tanya sesuatu…"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <Button onClick={doPreview} disabled={previewing} size="lg">
              {previewing ? "…" : "Tanya"}
            </Button>
          </div>
          {previewAns !== null && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-foreground dark:bg-blue-500/10">{previewAns}</div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Pakai RAG dari knowledge base (filter tenant) + persona di atas.
          </p>
        </SectionCard>

        {/* Knowledge base */}
        <SectionCard
          title={`Knowledge Base (${docs.length})`}
          description="Dokumen yang di-embed untuk menjawab pertanyaan."
        >
          <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto">
            {docs.length === 0 && <p className="text-xs text-muted-foreground">Belum ada dokumen.</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="truncate">{d.title}</span>
                <StatusPill tone={d.status === "ready" ? "emerald" : "amber"}>{statusLabel(d.status)}</StatusPill>
              </div>
            ))}
          </div>
          <input
            value={kbTitle}
            onChange={(e) => setKbTitle(e.target.value)}
            placeholder="Judul dokumen (mis. Katalog Produk)"
            className="mb-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
          <KbMarkdownEditor
            value={kbText}
            onChange={setKbText}
            rows={4}
            placeholder="Tulis pengetahuan (produk, FAQ, SOP)… mendukung Markdown"
          />
          <Button onClick={doAddKb} disabled={addingKb} size="lg" className="mt-3">
            <Plus className="size-4" /> Tambah & Embed
          </Button>
        </SectionCard>

        {/* Tools */}
        <SectionCard
          title="Tools"
          description="Fungsi yang bisa dipanggil AI via function calling."
        >
          <ul className="space-y-1.5 text-sm">
            {TOOLS.map((t) => (
              <li key={t} className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Tool dipanggil via API tenant (function calling). Konfigurasi tool — TODO.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
