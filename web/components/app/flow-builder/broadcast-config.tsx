"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2, MousePointerClick, ShieldCheck, Upload, Users, Zap } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { WaMessageEditor } from "@/components/app/wa-message-editor";
import { WaTemplatePreview } from "@/components/app/wa-template-preview";
import { errorMessage } from "@/lib/action-error";
import { previewAudience, uploadBroadcastMedia } from "@/lib/actions";
import {
  BROADCAST_CHANNEL_TYPES,
  PARAM_SOURCE_LABEL,
  formatWib,
  isoToWibInput,
  previewTemplateBody,
  wibInputToIso,
  type BroadcastTemplateOpt,
} from "@/lib/broadcast-flow";
import { newId, type NodeDataMap, type TemplateParamSource } from "@/lib/flow-graph";
import { cn } from "@/lib/utils";

const labelCls = "mb-1.5 block text-xs font-semibold text-foreground";
const hintCls = "mt-1.5 text-[11px] leading-snug text-muted-foreground";

type ChannelOption = { id: string; name: string; type: string; autoReply?: boolean };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

function Choice({ active, onClick, icon: Icon, title, desc }: { active: boolean; onClick: () => void; icon: typeof Zap; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active ? "border-brand-blue bg-blue-50 dark:bg-blue-500/10" : "border-border hover:bg-muted/60",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-blue" : "text-muted-foreground")} />
      <span className="min-w-0">
        <span className={cn("block text-[13px] font-medium", active && "text-brand-blue")}>{title}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

// --- Trigger: account, audience, schedule ------------------------------------------

export function BroadcastTriggerFields({
  d,
  set,
  channels,
  tags,
}: {
  d: NodeDataMap["trigger"];
  set: (patch: Partial<NodeDataMap["trigger"]>) => void;
  channels: ChannelOption[];
  tags: string[];
}) {
  const wa = channels.filter((c) => BROADCAST_CHANNEL_TYPES.includes(c.type));
  const selected = d.channels?.[0] ?? "";
  const selTags = d.tags ?? [];
  const [estimate, setEstimate] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState(Boolean(d.scheduleAt));
  const [openedAt] = useState(() => Date.now()); // "past schedule" check, stable across renders
  const tagKey = selTags.join("|");

  useEffect(() => {
    let live = true;
    previewAudience(tagKey ? tagKey.split("|") : [])
      .then((n) => live && setEstimate(n))
      .catch(() => live && setEstimate(null));
    return () => {
      live = false;
    };
  }, [tagKey]);

  const past = d.scheduleAt ? new Date(d.scheduleAt).getTime() < openedAt : false;
  const picked = wa.find((c) => c.id === selected);
  const isUnofficial = picked?.type === "wa_unofficial";

  return (
    <>
      <Field label="Akun WhatsApp pengirim" hint="Broadcast hanya untuk WhatsApp. Facebook/Instagram tidak mengizinkan pesan massal.">
        {wa.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Belum ada akun WhatsApp.{" "}
            <Link href="/channels/connect" className="font-medium text-brand-blue hover:underline">
              Hubungkan dulu
            </Link>
            .
          </p>
        ) : (
          <NativeSelect value={selected} onChange={(e) => set({ channels: e.target.value ? [e.target.value] : [] })} className="h-10 w-full text-sm">
            <NativeSelectOption value="">— Pilih akun —</NativeSelectOption>
            {wa.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name} · {c.type === "wa_official" ? "WA Official" : "WA"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field label="Penerima" hint="Hanya kontak yang sudah opt-in yang dikirimi. Kontak opt-out otomatis dilewati.">
        <div className="space-y-1.5">
          <Choice active={selTags.length === 0} onClick={() => set({ tags: [] })} icon={Users} title="Semua kontak opt-in" desc="Kirim ke seluruh kontak yang setuju menerima pesan" />
          {tags.length > 0 && (
            <div className="rounded-lg border border-border p-2.5">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Atau hanya kontak dengan tag:</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const on = selTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set({ tags: on ? selTags.filter((x) => x !== t) : [...selTags, t] })}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs",
                        on ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10" : "border-border hover:bg-muted/60",
                      )}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-brand-blue dark:bg-blue-500/10">
            <Users className="size-3.5" />
            Estimasi penerima saat ini: <b>{estimate === null ? "…" : estimate.toLocaleString("id-ID")} kontak</b>
          </div>
        </div>
      </Field>

      <Field label="Waktu kirim">
        <div className="space-y-1.5">
          <Choice
            active={!scheduled}
            onClick={() => {
              setScheduled(false);
              set({ scheduleAt: null });
            }}
            icon={Zap}
            title="Segera saat flow diaktifkan"
            desc="Mulai terkirim beberapa detik setelah Anda menyimpan & mengaktifkan"
          />
          <Choice active={scheduled} onClick={() => setScheduled(true)} icon={CalendarClock} title="Jadwalkan" desc="Pilih tanggal & jam (WIB)" />
          {scheduled && (
            <>
              <Input
                type="datetime-local"
                value={isoToWibInput(d.scheduleAt)}
                onChange={(e) => set({ scheduleAt: wibInputToIso(e.target.value) })}
                className="h-10 w-full text-sm"
              />
              {d.scheduleAt && (
                <p className={cn(hintCls, past && "font-medium text-red-600 dark:text-red-400")}>
                  {past ? "Jadwal sudah lewat — pilih waktu yang akan datang." : `Terkirim mulai ${formatWib(d.scheduleAt)}.`}
                </p>
              )}
            </>
          )}
        </div>
      </Field>

      {picked && picked.autoReply === false && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs leading-snug text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Balas otomatis akun ini sedang <b>nonaktif</b> — pesan broadcast tetap terkirim, tetapi langkah setelahnya tidak jalan saat kontak membalas.{" "}
            <Link href="/channels" className="font-semibold underline underline-offset-2">
              Aktifkan di Channel
            </Link>
            .
          </span>
        </div>
      )}
      {isUnofficial && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Nomor WA biasa rawan diblokir bila blast massal. Engine mengirim pelan (jeda acak + batas harian warm-up).
        </div>
      )}
    </>
  );
}

// --- First message -----------------------------------------------------------------

export function BroadcastMessageFields({
  d,
  set,
  channel,
  templates,
  waVars,
}: {
  d: NodeDataMap["broadcast_message"];
  set: (patch: Partial<NodeDataMap["broadcast_message"]>) => void;
  channel: ChannelOption | null;
  templates: BroadcastTemplateOpt[];
  waVars: { label: string; token: string }[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!channel) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Pilih akun WhatsApp pengirim di Pemicu Broadcast dulu — isi pesan menyesuaikan jenis akunnya.
      </div>
    );
  }

  async function upload(file: File | undefined, field: "mediaUrl" | "headerUrl") {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const { url } = await uploadBroadcastMedia(fd);
      set({ [field]: url });
    } catch (err) {
      gooeyToast.error(errorMessage(err) ?? "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const official = channel.type === "wa_official";
  const own = templates.filter((t) => t.channelId === channel.id);
  const tpl = own.find((t) => t.name === d.template && t.language === d.language) ?? null;
  const needsMedia = ["IMAGE", "VIDEO", "DOCUMENT"].includes(d.headerFormat);

  const imageInput = (field: "mediaUrl" | "headerUrl", placeholder: string) => (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0], field)}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {d[field] ? "Ganti gambar" : "Unggah gambar"}
      </Button>
      <Input value={d[field]} onChange={(e) => set({ [field]: e.target.value.trim() })} placeholder={placeholder} className="h-9 w-full text-sm" />
    </div>
  );

  if (!official) {
    return (
      <>
        <Field label="Isi pesan" hint="Gunakan {{nama}} untuk menyapa dengan nama kontak. Langkah berikutnya jalan saat kontak membalas.">
          <WaMessageEditor value={d.text} onChange={(text) => set({ text })} rows={6} placeholder="Tulis pesan broadcast…" variables={waVars} />
        </Field>
        <Field label="Gambar (opsional)" hint="Dikirim sebagai foto dengan pesan di atas sebagai caption.">
          {imageInput("mediaUrl", "https://…/promo.jpg")}
        </Field>
        <SaveAsHint saveAs={d.saveAs} />
      </>
    );
  }

  function pickTemplate(key: string) {
    const t = own.find((x) => `${x.name}|${x.language}` === key);
    if (!t) {
      set({ template: "", language: "", headerFormat: "", headerUrl: "", params: [], buttons: [] });
      return;
    }
    set({
      template: t.name,
      language: t.language,
      text: t.body,
      headerFormat: t.headerFormat,
      headerUrl: "",
      params: Array.from({ length: t.variableCount }, (_, i) => ({
        id: newId("p"),
        source: (i === 0 ? "contact_name" : "static") as TemplateParamSource,
        value: "",
        fallback: i === 0 ? "Kak" : "",
      })),
      // Quick-reply buttons become branches; link/phone buttons need no handling.
      buttons: t.buttons.flatMap((b, index) => (b.type === "QUICK_REPLY" ? [{ id: newId("b"), index, text: b.text }] : [])),
    });
  }

  return (
    <>
      <Field label="Template WhatsApp" hint="WA Official wajib memakai template yang sudah disetujui Meta.">
        <NativeSelect value={tpl ? `${tpl.name}|${tpl.language}` : ""} onChange={(e) => pickTemplate(e.target.value)} className="h-10 w-full text-sm">
          <NativeSelectOption value="">— Pilih template —</NativeSelectOption>
          {own.map((t) => (
            <NativeSelectOption key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
              {t.name} ({t.language}){t.buttons.length ? ` · ${t.buttons.length} tombol` : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {own.length === 0 && (
          <p className={hintCls}>
            Belum ada template disetujui di akun ini.{" "}
            <Link href="/templates/new" className="font-medium text-brand-blue hover:underline">
              Buat template
            </Link>
          </p>
        )}
        {d.template && !tpl && <p className={cn(hintCls, "font-medium text-red-600 dark:text-red-400")}>Template {d.template} tidak ditemukan / belum disetujui.</p>}
      </Field>

      {needsMedia && <Field label="Media header">{imageInput("headerUrl", "https://…/poster.jpg")}</Field>}

      {d.params.length > 0 && (
        <Field label="Isi variabel">
          <div className="space-y-2">
            {d.params.map((p, i) => (
              <div key={p.id} className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-center font-mono text-xs font-semibold text-muted-foreground">{`{{${i + 1}}}`}</span>
                  <NativeSelect
                    value={p.source}
                    onChange={(e) => set({ params: d.params.map((x) => (x.id === p.id ? { ...x, source: e.target.value as TemplateParamSource } : x)) })}
                    className="h-9 w-full text-sm"
                  >
                    {(Object.keys(PARAM_SOURCE_LABEL) as TemplateParamSource[]).map((k) => (
                      <NativeSelectOption key={k} value={k}>
                        {PARAM_SOURCE_LABEL[k]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <Input
                  value={p.source === "static" ? p.value : p.fallback}
                  onChange={(e) =>
                    set({
                      params: d.params.map((x) =>
                        x.id === p.id ? (p.source === "static" ? { ...x, value: e.target.value } : { ...x, fallback: e.target.value }) : x,
                      ),
                    })
                  }
                  placeholder={p.source === "static" ? "Nilai, mis. 19 November" : "Jika kosong pakai… (mis. Kak)"}
                  className="h-9 w-full text-sm"
                />
              </div>
            ))}
          </div>
        </Field>
      )}

      {tpl && (
        <div>
          <p className={labelCls}>Pratinjau</p>
          <WaTemplatePreview
            headerFormat={tpl.headerFormat}
            headerText={tpl.headerText}
            mediaUrl={d.headerUrl || null}
            body={previewTemplateBody(tpl.body, d.params)}
            footer={tpl.footer}
            buttons={tpl.buttons}
          />
        </div>
      )}

      {d.buttons.length > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <MousePointerClick className="size-3.5" /> Tiap tombol punya cabang sendiri
          </div>
          Sambungkan titik tombol di kanvas ke langkah berikutnya. Klik juga tercatat di laporan broadcast. Teks tombol tersimpan di {"{{tombol}}"}.
        </div>
      )}
      <SaveAsHint saveAs={d.saveAs} />
    </>
  );
}

function SaveAsHint({ saveAs }: { saveAs: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-snug text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Balasan kontak tersimpan di <code className="font-mono">{`{{${saveAs || "balasan"}}}`}</code> — pakai di node Kondisi untuk bercabang. Flow menunggu
        balasan hingga 3 hari.
      </span>
    </div>
  );
}
