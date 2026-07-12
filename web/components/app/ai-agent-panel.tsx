"use client";

import { useState, useTransition } from "react";
import {
  Save,
  Plus,
  Bot,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  Radio,
  BookOpen,
  Send,
} from "lucide-react";
import Link from "next/link";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { addKnowledge, deleteKnowledge, previewAi, savePersona } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { KbMarkdownEditor } from "@/components/app/kb-markdown-editor";
import { StatusPill } from "@/components/app/status-pill";
import { DeleteButton } from "@/components/app/delete-button";
import { statusLabel, CHANNEL_META, type ChannelType } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Doc = { id: string; title: string; status: string; sourceType: string };
type Chan = { id: string; name: string; type: string; status: string; autoReplyEnabled: boolean };

// Template persona siap-pakai — sekali klik isi textarea. Mempermudah user yang
// bingung mulai dari mana. Semua bisa disunting setelah dipilih.
const PRESETS: { key: string; label: string; text: string }[] = [
  {
    key: "sales",
    label: "Sales Toko",
    text: "Kamu asisten sales toko yang ramah dan antusias. Bahasa Indonesia santai. Bantu pelanggan memilih produk, jelaskan manfaatnya, dan dorong pembelian tanpa memaksa. Jika ditanya stok atau harga yang tidak kamu ketahui, tawarkan untuk mengecek ke admin.",
  },
  {
    key: "cs",
    label: "Customer Service",
    text: "Kamu customer service yang sopan, sabar, dan solutif. Bahasa Indonesia. Jawab pertanyaan hanya berdasarkan knowledge base. Jika keluhan rumit atau menyangkut data pribadi maupun pembayaran, alihkan ke agen manusia.",
  },
  {
    key: "reservasi",
    label: "Reservasi",
    text: "Kamu asisten reservasi yang ramah dan efisien. Bantu pelanggan mengecek ketersediaan, menjelaskan paket, dan mencatat permintaan booking. Konfirmasi detail (tanggal, jumlah orang, jam) sebelum menyelesaikan.",
  },
];

export function AiAgentPanel({
  persona,
  docs,
  channels,
  aiEnabled,
}: {
  persona: string;
  docs: Doc[];
  channels: Chan[];
  aiEnabled: boolean;
}) {
  const [personaText, setPersonaText] = useState(persona);
  const [savedPersona, setSavedPersona] = useState(persona);
  const [kbTitle, setKbTitle] = useState("");
  const [kbText, setKbText] = useState("");
  const [previewMsg, setPreviewMsg] = useState("");
  const [previewAns, setPreviewAns] = useState<{ text: string; kb: boolean } | null>(null);
  const [savingP, startSaveP] = useTransition();
  const [addingKb, startKb] = useTransition();
  const [previewing, startPreview] = useTransition();

  const dirty = personaText !== savedPersona;
  const activeChannels = channels.filter((c) => c.autoReplyEnabled && c.status === "connected");

  function doSavePersona() {
    startSaveP(async () => {
      try {
        await savePersona(personaText);
        setSavedPersona(personaText);
        gooeyToast.success("Persona tersimpan");
      } catch {
        gooeyToast.error("Gagal menyimpan persona");
      }
    });
  }

  function doAddKb() {
    if (!kbTitle.trim() || !kbText.trim()) return gooeyToast.error("Judul & isi wajib diisi");
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
          setPreviewAns({ text: "AI belum aktif. Hubungi admin untuk mengaktifkannya.", kb: false });
        } else {
          setPreviewAns({ text: r.answer ?? "(tidak ada jawaban)", kb: Boolean(r.kb_used) });
        }
      } catch (e) {
        gooeyToast.error(e instanceof Error ? e.message : "Gagal menjalankan uji coba");
      }
    });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="AI Agent"
        description="Atur cara AI menjawab pelanggan: persona, pengetahuan, lalu uji sebelum dipakai."
      />

      {/* Status ringkas: engine hidup? aktif di berapa channel? */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            aiEnabled
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
          }`}
        >
          <span className={`size-1.5 rounded-full ${aiEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
          {aiEnabled ? "AI aktif" : "AI nonaktif"}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            activeChannels.length > 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          }`}
        >
          <Radio className="size-3.5" />
          Menjawab di {activeChannels.length} channel
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Kolom utama: konfigurasi */}
        <div className="space-y-5 lg:col-span-2">
          {/* Persona + presets */}
          <SectionCard
            title="1. Persona"
            description="Gaya bicara & instruksi dasar AI. Pilih template lalu sesuaikan."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPersonaText(p.text)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-brand-blue/40 hover:text-foreground"
                >
                  <Sparkles className="size-3.5" /> {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={personaText}
              onChange={(e) => setPersonaText(e.target.value)}
              rows={6}
              placeholder="Contoh: Kamu asisten sales toko… ramah, Bahasa Indonesia, dorong penjualan tanpa memaksa."
              className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {dirty ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-500" /> Belum disimpan
                  </span>
                ) : (
                  "Tersimpan"
                )}
              </span>
              <Button onClick={doSavePersona} disabled={savingP || !dirty} size="lg">
                <Save className="size-4" /> Simpan Persona
              </Button>
            </div>
          </SectionCard>

          {/* Knowledge base */}
          <SectionCard
            title={`2. Knowledge Base (${docs.length})`}
            description="Dokumen (produk, FAQ, SOP) yang dipakai AI untuk menjawab."
          >
            {docs.length === 0 ? (
              <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                <BookOpen className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Belum ada pengetahuan</p>
                <p className="text-xs text-muted-foreground">
                  Tambahkan katalog produk, daftar harga, atau FAQ agar AI menjawab akurat.
                </p>
              </div>
            ) : (
              <div className="mb-4 space-y-1.5">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{d.title}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill tone={d.status === "ready" ? "emerald" : "amber"}>
                        {statusLabel(d.status)}
                      </StatusPill>
                      <DeleteButton
                        onConfirm={() => deleteKnowledge(d.id)}
                        title="Hapus dokumen?"
                        description={
                          <>
                            Dokumen <span className="font-semibold">{d.title}</span> dan embedding-nya
                            dihapus permanen. AI berhenti memakainya untuk menjawab.
                          </>
                        }
                        successMessage="Dokumen dihapus"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border pt-3">
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
            </div>
          </SectionCard>
        </div>

        {/* Sidebar: uji + kemampuan (sticky di desktop supaya tetap terlihat saat scroll) */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {/* Uji jawaban */}
          <SectionCard title="Uji Jawaban" description="Coba dulu sebelum dipakai ke pelanggan.">
            <div className="flex gap-2">
              <input
                value={previewMsg}
                onChange={(e) => setPreviewMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doPreview()}
                placeholder="Tanya sesuatu…"
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
              />
              <Button onClick={doPreview} disabled={previewing} size="lg" aria-label="Kirim">
                <Send className="size-4" />
              </Button>
            </div>
            {previewAns && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Jawaban AI</p>
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-foreground dark:bg-blue-500/10">
                  {previewAns.text}
                </div>
                {previewAns.kb && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="size-3" /> Memakai knowledge base
                  </span>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Memakai persona di samping + knowledge base (khusus data tenant kamu).
            </p>
          </SectionCard>

          {/* Kemampuan jujur + aktivasi */}
          <SectionCard title="Kemampuan & Aktivasi" description="Yang benar-benar bisa dilakukan AI.">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>Menjawab dari knowledge base (RAG) & persona.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>Otomatis alihkan ke agen manusia saat ragu atau topik sensitif.</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <span>Integrasi (cek ongkir, buat invoice, cek stok) — segera hadir.</span>
              </li>
            </ul>

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Aktif di channel</p>
              {activeChannels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10">
                  AI belum menjawab di channel manapun. Aktifkan{" "}
                  <span className="font-medium">Balas otomatis</span> pada channel di halaman Channel.
                  <Link
                    href="/channels"
                    className="mt-1 inline-flex items-center gap-1 font-medium text-brand-blue hover:underline"
                  >
                    Buka Channel <ArrowRight className="size-3" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeChannels.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      <Bot className="size-3" />
                      {c.name}
                      <span className="text-emerald-600/70">
                        · {CHANNEL_META[c.type as ChannelType]?.label ?? c.type}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
