"use client";

import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/action-error";
import { Suspense, useEffect, useState, useTransition } from "react";
import { unstable_rethrow, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { createChannel } from "@/lib/actions";
import { CHANNEL_META, ChannelType } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChannelIcon } from "@/components/app/channel-icon";
import { WaEmbeddedSignup } from "./wa-embedded-signup";

type Tag = { label: string; tone: "green" | "blue" | "amber" | "slate" };

const TYPES: { value: ChannelType; label: string; desc: string; tag: Tag }[] = [
  {
    value: "wa_official",
    label: "WhatsApp Official",
    desc: "WhatsApp Cloud API resmi dari Meta",
    tag: { label: "Resmi", tone: "green" },
  },
  {
    value: "telegram",
    label: "Telegram",
    desc: "Paste bot token dari @BotFather",
    tag: { label: "Gratis", tone: "green" },
  },
  {
    value: "wa_unofficial",
    label: "WhatsApp Unofficial",
    desc: "Scan QR untuk menghubungkan",
    tag: { label: "Scan QR", tone: "blue" },
  },
  {
    value: "instagram",
    label: "Instagram",
    desc: "DM & komentar Instagram Professional (resmi Meta)",
    tag: { label: "Resmi", tone: "green" },
  },
  {
    value: "facebook",
    label: "Facebook",
    desc: "Messenger & komentar Facebook Page (resmi Meta)",
    tag: { label: "Resmi", tone: "green" },
  },
];

const TAG_CLS: Record<Tag["tone"], string> = {
  green:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-blue-100 text-brand-navy dark:bg-blue-500/15 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

const FIELDS: Record<
  ChannelType,
  { key: string; label: string; placeholder: string; hint?: string; optional?: boolean }[]
> = {
  telegram: [
    {
      key: "bot_token",
      label: "Bot Token",
      placeholder: "123456:ABC-DEF…",
      hint: "Dari @BotFather → /newbot.",
    },
  ],
  wa_official: [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "1098…" },
    { key: "waba_id", label: "WABA ID", placeholder: "1023…" },
    {
      key: "access_token",
      label: "Access Token",
      placeholder: "EAAG…",
      hint: "Token permanen System User dengan izin whatsapp_business_messaging & whatsapp_business_management.",
    },
    {
      key: "pin",
      label: "PIN 2 Langkah",
      placeholder: "6 digit",
      hint: "Hanya bila nomor belum terdaftar di Cloud API.",
      optional: true,
    },
  ],
  instagram: [
    { key: "page_id", label: "Facebook Page ID", placeholder: "1789…", hint: "ID Page Facebook yang tertaut ke akun Instagram Professional." },
    { key: "access_token", label: "Page Access Token", placeholder: "EAAG…", hint: "Token Page dengan izin instagram_basic, instagram_manage_messages, instagram_manage_comments." },
  ],
  facebook: [
    { key: "page_id", label: "Page ID", placeholder: "1789…" },
    { key: "access_token", label: "Page Access Token", placeholder: "EAAG…", hint: "Token Page dengan izin pages_messaging, pages_manage_metadata, pages_manage_engagement." },
  ],
  wa_unofficial: [],
};

export default function ConnectChannelPage() {
  return (
    <Suspense>
      <ConnectChannel />
    </Suspense>
  );
}

function ConnectChannel() {
  const params = useSearchParams();
  const [type, setType] = useState<ChannelType>(() => {
    const t = params.get("type");
    return TYPES.some((x) => x.value === t) ? (t as ChannelType) : "wa_official";
  });
  // WA Official / Facebook / Instagram: login Meta (disarankan) atau input manual ID + token.
  const [waMode, setWaMode] = useState<"embedded" | "manual">("embedded");
  const isMeta = type === "facebook" || type === "instagram";

  // Errors from the Facebook login callback arrive as ?error=… — show them once.
  const oauthError = params.get("error");
  useEffect(() => {
    if (oauthError) gooeyToast.error(oauthError === "forbidden" ? "Anda tidak punya akses menghubungkan channel" : oauthError);
  }, [oauthError]);
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const fields = FIELDS[type];

  function submit() {
    if (!name.trim()) {
      gooeyToast.error("Nama channel wajib diisi");
      return;
    }
    for (const field of fields) {
      if (!field.optional && !creds[field.key]?.trim()) {
        gooeyToast.error(`${field.label} wajib diisi`);
        return;
      }
    }
    start(async () => {
      try {
        // createChannel redirect saat sukses (NEXT_REDIRECT) — jangan dibungkus
        // gooeyToast.promise, redirect-nya akan jadi "error" palsu & ketelan.
        await createChannel({
          type,
          name,
          credentials: creds,
        });
      } catch (e) {
        unstable_rethrow(e);
        gooeyToast.error(
          errorMessage(e) ?? "Gagal menghubungkan channel",
        );
      }
    });
  }

  const selectedMeta = CHANNEL_META[type];
  const selectedType = TYPES.find((t) => t.value === type);

  const inputCls =
    "h-11 w-full pl-10 pr-3 text-sm";

  return (
    <div className="p-6">
      <Link
        href="/channels"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Hubungkan Channel
      </h1>
      <p className="text-sm text-muted-foreground">
        Pilih tipe channel lalu isi kredensial.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* Type picker */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipe Channel
          </p>
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
                    {active ? (
                      <Check className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
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
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          TAG_CLS[t.tag.tone],
                        )}
                      >
                        {t.tag.label}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {t.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credential form */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-[20px] bg-card">
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
                <div className="text-sm font-semibold">
                  {selectedType?.label}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {selectedType?.desc}
                </div>
              </div>
            </div>

            {(type === "wa_official" || isMeta) && (
              <div className="flex gap-2 px-5 pt-5">
                {(["embedded", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWaMode(m)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      waMode === m
                        ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {m === "embedded" ? (isMeta ? "Login Facebook" : "Login Meta") : "Input Manual"}
                  </button>
                ))}
              </div>
            )}

            {type === "wa_official" && waMode === "embedded" ? (
              <div className="p-5">
                <WaEmbeddedSignup />
              </div>
            ) : isMeta && waMode === "embedded" ? (
              <div className="space-y-4 p-5">
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>Klik tombol di bawah lalu login dengan akun Facebook pengelola Page.</li>
                  <li>Izinkan akses yang diminta (pesan{type === "instagram" ? ", Instagram" : ""}, dan komentar).</li>
                  <li>Pilih {type === "instagram" ? "Page yang tertaut ke akun Instagram Anda" : "Page"} — channel langsung aktif.</li>
                </ol>
                {type === "instagram" && (
                  <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    Akun Instagram harus <b>Professional</b> (Bisnis/Kreator) dan sudah ditautkan ke Facebook Page.
                  </p>
                )}
                <a
                  href={`/api/channels/facebook/oauth/start?platform=${type}`}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  <ChannelIcon type="facebook" className="size-4" /> Login dengan Facebook
                </a>
              </div>
            ) : (
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Nama Channel
                </label>
                <div className="relative">
                  <Plug className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. WA Toko Utama"
                    className={inputCls}
                  />
                </div>
              </div>

              {fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1.5 block text-sm font-medium">
                      {f.label}
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={creds[f.key] ?? ""}
                        onChange={(e) =>
                          setCreds((c) => ({ ...c, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        className={cn(inputCls, "font-mono")}
                      />
                    </div>
                    {f.hint && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {f.hint}
                      </p>
                    )}
                  </div>
                ))}

              {type === "wa_unofficial" && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                  <span className="grid size-12 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <QrCode className="size-6" />
                  </span>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Pairing via Scan QR
                  </p>
                  <p className="text-xs leading-snug text-amber-700/90 dark:text-amber-300/80">
                    Setelah dibuat, kamu diarahkan ke halaman scan QR untuk
                    pairing.
                  </p>
                </div>
              )}

              <Button
                onClick={submit}
                disabled={pending}
                size="lg"
                className="w-full"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plug className="size-4" />
                )}
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
