"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Users, AlertTriangle, Check } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { createAndRunBroadcast, previewAudience } from "@/lib/actions";
import { CHANNEL_META, ChannelType, cleanIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Channel = { id: string; name: string; type: string };
export type TemplateOpt = { name: string; body: string; language: string };

const STEPS = ["Audience", "Pesan", "Konfirmasi"];

export function BroadcastWizard({
  channels,
  tags,
  templates = [],
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
  const [templateName, setTemplateName] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const channel = channels.find((c) => c.id === channelId);
  const isUnofficial = channel?.type === "wa_unofficial";
  const isOfficial = channel?.type === "wa_official";
  const useTemplate = isOfficial && !!templateName;

  function pickTemplate(tn: string) {
    setTemplateName(tn);
    const t = templates.find((x) => x.name === tn);
    if (t) setBody(t.body); // snapshot body template untuk preview/record
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
    if (!body.trim()) return gooeyToast.error("Pesan kosong");
    start(async () => {
      try {
        await gooeyToast.promise(
          createAndRunBroadcast({
            name,
            channelId,
            body,
            tags: selTags,
            templateId: useTemplate ? templateName : undefined,
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
      <Link href="/broadcasts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Broadcast Baru</h1>

      {/* steps */}
      <div className="mt-4 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                i <= step ? "bg-brand-blue text-white" : "bg-slate-100 text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
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
                    selTags.includes(t) ? "border-brand-blue bg-blue-50 text-brand-blue" : "border-border",
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
                setTemplateName(""); // template hanya valid utk channel WA official terpilih
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

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-brand-blue">
              <Users className="size-4" />
              Estimasi penerima (opted-in): <b>{estimate === null ? "…" : cleanIDR(estimate)}</b>
            </div>
            {isUnofficial && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Channel unofficial rawan banned. Rate dibatasi ketat oleh engine.
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            {isOfficial && (
              <div className="mb-4">
                <label className="block text-sm font-medium">Template HSM (luar window 24 jam)</label>
                <select
                  value={templateName}
                  onChange={(e) => pickTemplate(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue"
                >
                  <option value="">— Tanpa template (teks bebas, hanya dalam window) —</option>
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Belum ada template HSM approved. Buat di menu Template Pesan.
                  </p>
                )}
              </div>
            )}

            <label className="block text-sm font-medium">
              {useTemplate ? "Isi Template (preview)" : "Isi Pesan"}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              readOnly={useTemplate}
              rows={6}
              placeholder="Tulis pesan broadcast… (official di luar window butuh template)"
              className={cn(
                "mt-1.5 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10",
                useTemplate && "bg-slate-50 text-muted-foreground",
              )}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {useTemplate
                ? `Pakai template "${templateName}". Variabel {{n}} perlu parameter — belum didukung di wizard ini.`
                : "Isi di-snapshot saat broadcast dibuat (tak ikut perubahan template)."}
            </p>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <Row k="Nama" v={name || "—"} />
            <Row k="Channel" v={channel ? `${channel.name} · ${CHANNEL_META[channel.type as ChannelType]?.label}` : "—"} />
            <Row k="Template HSM" v={useTemplate ? templateName : "—"} />
            <Row k="Filter tag" v={selTags.length ? selTags.join(", ") : "semua opted-in"} />
            <Row k="Estimasi penerima" v={estimate === null ? "…" : `${cleanIDR(estimate)} kontak`} />
            <div className="rounded-lg bg-slate-50 p-3 text-muted-foreground">{body || "—"}</div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-700">
              <Check className="size-4" /> Hanya kontak opted-in dikirimi. Opted-out otomatis di-skip (guard engine).
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Kembali
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Jalankan Broadcast
            </button>
          )}
        </div>
      </div>
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
