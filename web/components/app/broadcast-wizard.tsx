"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Users, AlertTriangle, Check, Send, Upload, Loader2, MousePointerClick, Workflow } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { ActionLink } from "@/components/app/action-link";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/section-card";
import { WaMessageEditor } from "@/components/app/wa-message-editor";
import { WaTemplatePreview, type PreviewButton } from "@/components/app/wa-template-preview";
import { createAndRunBroadcast, previewAudience, uploadBroadcastMedia } from "@/lib/actions";
import { CHANNEL_META, ChannelType, cleanIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Channel = { id: string; name: string; type: string };
// channelId = channel (WABA) pemilik template; template hanya valid untuk channel itu.
export type TemplateOpt = {
  name: string;
  body: string;
  language: string;
  channelId: string;
  variableCount: number;
  headerFormat: string;
  headerText: string;
  footer: string;
  buttons: PreviewButton[];
};

type ParamSource = "contact_name" | "contact_phone" | "static";
type Param = { source: ParamSource; value: string; fallback: string };

const SOURCE_LABEL: Record<ParamSource, string> = {
  contact_name: "Nama kontak",
  contact_phone: "Nomor kontak",
  static: "Teks tetap",
};

const STEPS = ["Audience", "Pesan", "Konfirmasi"];
const STEP_DESC = [
  "Pilih nama, segmen tag, dan channel pengirim.",
  "Tulis isi pesan atau pilih template HSM.",
  "Tinjau ringkasan sebelum menjalankan broadcast.",
];

export function BroadcastWizard({
  channels,
  tags,
  templates: allTemplates = [],
}: {
  channels: Channel[];
  tags: string[];
  templates?: TemplateOpt[];
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selTags, setSelTags] = useState<string[]>([]);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [templateKey, setTemplateKey] = useState(""); // `${name}|${language}`
  const [params, setParams] = useState<Param[]>([]);
  const [headerUrl, setHeaderUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const channel = channels.find((c) => c.id === channelId);
  const templates = allTemplates.filter((t) => t.channelId === channelId);
  const isUnofficial = channel?.type === "wa_unofficial";
  const isOfficial = channel?.type === "wa_official";
  const tpl = isOfficial ? templates.find((t) => `${t.name}|${t.language}` === templateKey) : undefined;
  const useTemplate = !!tpl;
  const needsMedia = !!tpl && ["IMAGE", "VIDEO", "DOCUMENT"].includes(tpl.headerFormat);
  const quickButtons = tpl?.buttons.filter((b) => b.type === "QUICK_REPLY") ?? [];

  function pickTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.find((x) => `${x.name}|${x.language}` === key);
    setHeaderUrl("");
    // Default: {{1}} = nama kontak (pola paling umum), sisanya teks tetap.
    setParams(
      Array.from({ length: t?.variableCount ?? 0 }, (_, i) =>
        i === 0 ? { source: "contact_name", value: "", fallback: "Kak" } : { source: "static", value: "", fallback: "" },
      ),
    );
    if (t) setBody(t.body);
  }

  // Body dengan variabel terisi contoh → pratinjau + snapshot laporan.
  const filledBody = tpl
    ? tpl.body.replace(/\{\{(\d+)\}\}/g, (all, n) => {
        const p = params[Number(n) - 1];
        if (!p) return all;
        if (p.source === "contact_name") return "[Nama]";
        if (p.source === "contact_phone") return "[Nomor]";
        return p.value || all;
      })
    : body;

  async function onPickHeader(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const { url } = await uploadBroadcastMedia(fd);
      setHeaderUrl(url);
    } catch (err) {
      gooeyToast.error(err instanceof Error ? err.message : "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    let live = true;
    previewAudience(selTags).then((n) => live && setEstimate(n));
    return () => {
      live = false;
    };
  }, [selTags]);

  function toggleTag(t: string) {
    setSelTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  function submit() {
    if (!name.trim()) return gooeyToast.error("Nama broadcast wajib");
    if (!channelId) return gooeyToast.error("Pilih channel");
    if (isOfficial && !tpl) return gooeyToast.error("Pilih template WhatsApp yang sudah disetujui");
    if (!tpl && !body.trim()) return gooeyToast.error("Pesan kosong");
    if (needsMedia && !headerUrl) return gooeyToast.error("Unggah gambar/media header");
    const emptyIdx = params.findIndex((p) => p.source === "static" && !p.value.trim());
    if (emptyIdx >= 0) return gooeyToast.error(`Isi nilai variabel {{${emptyIdx + 1}}}`);
    start(async () => {
      try {
        await gooeyToast.promise(
          createAndRunBroadcast({
            name,
            channelId,
            body: tpl ? filledBody : body,
            tags: selTags,
            templateId: tpl?.name,
            templateLang: tpl?.language,
            headerMediaUrl: needsMedia ? headerUrl : undefined,
            bodyParams: tpl ? params : undefined,
          }),
          { loading: "Menjalankan broadcast…", success: "Broadcast berjalan", error: "Gagal menjalankan" },
        );
      } catch {
        /* error toast tampil */
      }
    });
  }

  return (
    <div className="p-6">
      <ActionLink href="/broadcasts" variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </ActionLink>
      <h1 className="text-2xl font-bold tracking-tight">Broadcast Baru</h1>

      {/* steps */}
      <div className="mt-4 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                i <= step ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <SectionCard className="mt-5" title={STEPS[step]} description={STEP_DESC[step]}>
        {step === 0 && (
          <>
            <label className="block text-sm font-medium">Nama Broadcast</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Promo Akhir Bulan"
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />

            <label className="mt-4 block text-sm font-medium">Filter Tag (opsional)</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">Belum ada tag — kirim ke semua opted-in.</span>}
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    selTags.includes(t)
                      ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-brand-blue/15 dark:text-brand-blue"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium">Channel</label>
            <select
              value={channelId}
              onChange={(e) => {
                setChannelId(e.target.value);
                setTemplateKey(""); // template hanya valid utk channel WA official terpilih
                setParams([]);
              }}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue"
            >
              {channels.length === 0 && <option value="">Belum ada channel</option>}
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {CHANNEL_META[c.type as ChannelType]?.label}
                </option>
              ))}
            </select>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-brand-blue dark:bg-brand-blue/15 dark:text-brand-blue">
              <Users className="size-4" />
              Estimasi penerima (opted-in): <b>{estimate === null ? "…" : cleanIDR(estimate)}</b>
            </div>
            {isUnofficial && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Channel unofficial rawan banned. Rate dibatasi ketat oleh engine.
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <div className={cn("grid gap-6", isOfficial && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
            <div className="min-w-0 space-y-4">
              {isOfficial ? (
                <>
                  <div>
                    <label className="block text-sm font-medium">Template WhatsApp</label>
                    <select
                      value={templateKey}
                      onChange={(e) => pickTemplate(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue"
                    >
                      <option value="">— Pilih template yang sudah disetujui —</option>
                      {templates.map((t) => (
                        <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                          {t.name} ({t.language}){t.buttons.length ? ` · ${t.buttons.length} tombol` : ""}
                        </option>
                      ))}
                    </select>
                    {templates.length === 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Belum ada template disetujui di channel ini.{" "}
                        <Link href="/templates/new" className="font-medium text-brand-blue hover:underline">Buat template</Link>
                      </p>
                    )}
                  </div>

                  {needsMedia && (
                    <div>
                      <label className="block text-sm font-medium">Gambar header</label>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickHeader(e.target.files?.[0])} />
                        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                          {headerUrl ? "Ganti gambar" : "Unggah gambar"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {headerUrl ? "Gambar siap dikirim." : "JPG/PNG maks 2 MB. Atau tempel URL https di bawah."}
                        </span>
                        <input
                          value={headerUrl}
                          onChange={(e) => setHeaderUrl(e.target.value.trim())}
                          placeholder="https://…/poster.jpg"
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue"
                        />
                      </div>
                    </div>
                  )}

                  {params.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium">Isi variabel</label>
                      <div className="mt-1.5 space-y-2">
                        {params.map((p, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                            <span className="w-10 shrink-0 text-center font-mono text-xs font-semibold text-muted-foreground">{`{{${i + 1}}}`}</span>
                            <select
                              value={p.source}
                              onChange={(e) =>
                                setParams((ps) => ps.map((x, j) => (j === i ? { ...x, source: e.target.value as ParamSource } : x)))
                              }
                              className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-brand-blue"
                            >
                              {(Object.keys(SOURCE_LABEL) as ParamSource[]).map((k) => (
                                <option key={k} value={k}>{SOURCE_LABEL[k]}</option>
                              ))}
                            </select>
                            <input
                              value={p.source === "static" ? p.value : p.fallback}
                              onChange={(e) =>
                                setParams((ps) =>
                                  ps.map((x, j) =>
                                    j === i ? (p.source === "static" ? { ...x, value: e.target.value } : { ...x, fallback: e.target.value }) : x,
                                  ),
                                )
                              }
                              placeholder={p.source === "static" ? "Nilai, mis. 19 November" : "Jika kosong, pakai… (mis. Kak)"}
                              className="h-9 min-w-[160px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickButtons.length > 0 && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                        <MousePointerClick className="size-3.5" /> Saat tombol diklik
                      </div>
                      Klik dicatat di laporan broadcast, lalu flow dengan pemicu <b>Klik tombol</b> berlabel sama dijalankan otomatis:
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {quickButtons.map((b) => (
                          <span key={b.text} className="rounded-md bg-white px-2 py-0.5 font-medium text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-200">
                            {b.text}
                          </span>
                        ))}
                      </div>
                      <Link href="/flows" className="mt-2 inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-200">
                        <Workflow className="size-3.5" /> Atur flow balasan
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium">Isi Pesan</label>
                  <WaMessageEditor
                    value={body}
                    onChange={setBody}
                    rows={6}
                    placeholder="Tulis pesan broadcast…"
                    className="mt-1.5"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Isi di-snapshot saat broadcast dibuat. Tip: tulis pilihan bernomor (1, 2, 3) lalu buat flow pemicu keyword untuk tiap angka.
                  </p>
                </div>
              )}
            </div>

            {isOfficial && (
              <div className="lg:sticky lg:top-6 lg:self-start">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pratinjau</p>
                {tpl ? (
                  <WaTemplatePreview
                    headerFormat={tpl.headerFormat}
                    headerText={tpl.headerText}
                    mediaUrl={headerUrl || null}
                    body={filledBody}
                    footer={tpl.footer}
                    buttons={tpl.buttons}
                  />
                ) : (
                  <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
                    Pilih template untuk melihat pratinjau
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <Row k="Nama" v={name || "—"} />
            <Row k="Channel" v={channel ? `${channel.name} · ${CHANNEL_META[channel.type as ChannelType]?.label}` : "—"} />
            <Row k="Template" v={tpl ? `${tpl.name} (${tpl.language})` : "—"} />
            {quickButtons.length > 0 && <Row k="Tombol dilacak" v={quickButtons.map((b) => b.text).join(", ")} />}
            <Row k="Filter tag" v={selTags.length ? selTags.join(", ") : "semua opted-in"} />
            <Row k="Estimasi penerima" v={estimate === null ? "…" : `${cleanIDR(estimate)} kontak`} />
            <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-muted-foreground">{(useTemplate ? filledBody : body) || "—"}</div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check className="size-4" /> Hanya kontak opted-in dikirimi. Opted-out otomatis di-skip (guard engine).
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" /> Kembali
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={() => setStep((s) => s + 1)}>
              Lanjut
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={pending}>
              <Send className="size-4" /> Jalankan Broadcast
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
