"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  QrCode,
  Check,
  Loader2,
  Lock,
  KeyRound,
  Plug,
  ChevronRight,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { createChannel } from "@/lib/actions";
import { CHANNEL_META, ChannelType } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/app/channel-icon";
import { WaEmbeddedSignup } from "./wa-embedded-signup";

type Tag = { label: string; tone: "green" | "blue" | "amber" | "slate" };

const TYPES: { value: ChannelType; label: string; desc: string; tag: Tag }[] = [
  { value: "telegram", label: "Telegram", desc: "Paste bot token dari @BotFather", tag: { label: "Gratis", tone: "green" } },
  { value: "wa_official", label: "WhatsApp Official", desc: "Meta Cloud API (berbayar, aman)", tag: { label: "Resmi", tone: "blue" } },
  { value: "wa_unofficial", label: "WhatsApp Unofficial", desc: "Scan QR (gratis, rawan banned)", tag: { label: "Rawan banned", tone: "amber" } },
  { value: "instagram", label: "Instagram", desc: "Meta Graph API", tag: { label: "Meta", tone: "slate" } },
  { value: "facebook", label: "Facebook", desc: "Meta Graph API", tag: { label: "Meta", tone: "slate" } },
];

const TAG_CLS: Record<Tag["tone"], string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-blue-100 text-brand-navy dark:bg-blue-500/15 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

const FIELDS: Record<ChannelType, { key: string; label: string; placeholder: string; hint?: string }[]> = {
  telegram: [{ key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF…", hint: "Dari @BotFather → /newbot." }],
  wa_official: [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "1098…" },
    { key: "waba_id", label: "WABA ID", placeholder: "1023…" },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…", hint: "Permanent token dari Meta Business." },
  ],
  instagram: [
    { key: "page_id", label: "Page/IG ID", placeholder: "1789…" },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…" },
  ],
  facebook: [
    { key: "page_id", label: "Page ID", placeholder: "1789…" },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…" },
  ],
  wa_unofficial: [],
};

export default function ConnectChannelPage() {
  const [type, setType] = useState<ChannelType>("telegram");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);
  const [pending, start] = useTransition();

  const fields = FIELDS[type];
  // Meta (FB/IG) pakai OAuth "Login dengan Facebook"; WA pakai Embedded Signup.
  // Untuk semua ini form manual hanya fallback lanjutan (advanced).
  const isMeta = type === "facebook" || type === "instagram";
  const isWaOfficial = type === "wa_official";
  const hasGuidedFlow = isMeta || isWaOfficial;

  function submit() {
    if (!name.trim()) {
      gooeyToast.error("Nama channel wajib diisi");
      return;
    }
    for (const f of fields) {
      if (!creds[f.key]?.trim()) {
        gooeyToast.error(`${f.label} wajib diisi`);
        return;
      }
    }
    const externalId =
      type === "wa_official" ? creds.phone_number_id : creds.page_id ?? undefined;
    start(async () => {
      try {
        await gooeyToast.promise(
          createChannel({ type, name, credentials: creds, externalId }),
          { loading: "Menghubungkan channel…", success: "Channel terhubung", error: "Gagal menghubungkan" },
        );
      } catch {
        /* error toast sudah tampil */
      }
    });
  }

  const selectedMeta = CHANNEL_META[type];
  const selectedType = TYPES.find((t) => t.value === type);

  const inputCls =
    "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

  return (
    <div className="p-6">
      <Link
        href="/channels"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Hubungkan Channel</h1>
      <p className="text-sm text-muted-foreground">Pilih tipe channel lalu isi kredensial.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* Type picker */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipe Channel</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TYPES.map((t) => {
              const active = type === t.value;
              const meta = CHANNEL_META[t.value];
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setType(t.value);
                    setCreds({});
                    setAdvanced(false);
                  }}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                    active
                      ? "border-brand-blue bg-blue-50/70 shadow-[0_4px_20px_-6px_rgba(59,130,246,0.35)] ring-1 ring-brand-blue/20 dark:bg-blue-500/10"
                      : "border-border bg-card hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md",
                  )}
                >
                  <span
                    className={cn(
                      "absolute right-3.5 top-3.5 flex size-5 items-center justify-center rounded-full transition-all",
                      active
                        ? "scale-100 bg-brand-blue text-white"
                        : "scale-0 bg-muted text-muted-foreground group-hover:scale-100",
                    )}
                  >
                    {active ? <Check className="size-3" /> : <ChevronRight className="size-3" />}
                  </span>

                  <span
                    className="flex size-10 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105"
                    style={{ background: meta.color }}
                  >
                    <ChannelIcon type={t.value} className="size-5" />
                  </span>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TAG_CLS[t.tag.tone])}>
                        {t.tag.label}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credential form */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Header bertema warna channel */}
            <div
              className="flex items-center gap-3 border-b border-border px-5 py-4"
              style={{ background: `${selectedMeta.color}14` }}
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5"
                style={{ background: selectedMeta.color }}
              >
                <ChannelIcon type={type} className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{selectedType?.label}</div>
                <div className="truncate text-xs text-muted-foreground">{selectedType?.desc}</div>
              </div>
            </div>

            {/* FB/IG = OAuth 1-klik; WA = Embedded Signup. Form manual hanya fallback. */}
            {hasGuidedFlow ? (
              <div className="space-y-4 p-5">
                {isMeta ? (
                  <MetaOAuthFlow platform={type as "facebook" | "instagram"} label={selectedType?.label ?? ""} />
                ) : (
                  <WaEmbeddedSignup />
                )}

                {/* Fallback lanjutan: input token manual (advanced) */}
                <button
                  type="button"
                  onClick={() => setAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <span>Punya token sendiri? Input manual</span>
                  <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} />
                </button>

                {advanced && (
                  <div className="space-y-4 rounded-xl border border-dashed border-border bg-muted/30 p-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Nama Channel</label>
                      <div className="relative">
                        <Plug className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="mis. Page Toko Utama"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    {fields.map((f) => (
                      <div key={f.key}>
                        <label className="mb-1.5 block text-sm font-medium">{f.label}</label>
                        <div className="relative">
                          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={creds[f.key] ?? ""}
                            onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className={cn(inputCls, "font-mono")}
                          />
                        </div>
                        {f.hint && <p className="mt-1.5 text-xs text-muted-foreground">{f.hint}</p>}
                      </div>
                    ))}
                    <Button onClick={submit} disabled={pending} variant="outline" size="lg" className="w-full">
                      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                      {pending ? "Menghubungkan…" : "Hubungkan manual"}
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="size-3" />
                  Kredensial dienkripsi at-rest (AES-256-GCM).
                </div>
              </div>
            ) : (
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nama Channel</label>
                <div className="relative">
                  <Plug className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. WA Toko Utama"
                    className={inputCls}
                  />
                </div>
              </div>

              {fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium">{f.label}</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={creds[f.key] ?? ""}
                      onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={cn(inputCls, "font-mono")}
                    />
                  </div>
                  {f.hint && <p className="mt-1.5 text-xs text-muted-foreground">{f.hint}</p>}
                </div>
              ))}

              {type === "wa_unofficial" && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                  <span className="grid size-12 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <QrCode className="size-6" />
                  </span>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Pairing via Scan QR</p>
                  <p className="text-xs leading-snug text-amber-700/90 dark:text-amber-300/80">
                    Setelah dibuat, kamu diarahkan ke halaman scan QR untuk pairing. Rawan banned untuk broadcast —
                    gunakan hati-hati.
                  </p>
                </div>
              )}

              <Button onClick={submit} disabled={pending} size="lg" className="w-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                {pending ? "Menghubungkan…" : "Hubungkan"}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="size-3" />
                Kredensial dienkripsi at-rest (AES-256-GCM).
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Jalur OAuth Meta: tombol "Login dengan Facebook" → /oauth/start (redirect dialog Meta).
function MetaOAuthFlow({ platform, label }: { platform: "facebook" | "instagram"; label: string }) {
  const [redirecting, setRedirecting] = useState(false);
  const steps = [
    "Klik tombol, login & pilih halaman di Facebook",
    "Beri izin akses pesan ke ChatCepat",
    "Selesai — pesan masuk langsung ke inbox",
  ];
  return (
    <div className="space-y-4">
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-brand-navy dark:bg-blue-500/15 dark:text-blue-300">
              {i + 1}
            </span>
            <span className="leading-snug text-muted-foreground">{s}</span>
          </li>
        ))}
      </ol>

      <a
        href={`/api/channels/facebook/oauth/start?platform=${platform}`}
        onClick={() => setRedirecting(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#1877f2] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1568d8] active:scale-[0.99]"
      >
        {redirecting ? <Loader2 className="size-5 animate-spin" /> : <ChannelIcon type={platform} className="size-5" />}
        {redirecting ? "Mengarahkan…" : `Login dengan ${label}`}
      </a>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-snug text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>Aman lewat Meta resmi. ChatCepat tak pernah melihat kata sandi Facebook-mu.</span>
      </div>
    </div>
  );
}
