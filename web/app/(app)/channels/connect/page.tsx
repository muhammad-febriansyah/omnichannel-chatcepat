"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { createChannel } from "@/lib/actions";
import { CHANNEL_META, ChannelType } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: { value: ChannelType; label: string; desc: string }[] = [
  { value: "telegram", label: "Telegram", desc: "Paste bot token dari @BotFather" },
  { value: "wa_official", label: "WhatsApp Official", desc: "Meta Cloud API (berbayar, aman)" },
  { value: "wa_unofficial", label: "WhatsApp Unofficial", desc: "Scan QR (gratis, rawan banned)" },
  { value: "instagram", label: "Instagram", desc: "Meta Graph API" },
  { value: "facebook", label: "Facebook", desc: "Meta Graph API" },
];

const FIELDS: Record<ChannelType, { key: string; label: string; placeholder: string }[]> = {
  telegram: [{ key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF…" }],
  wa_official: [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "1098…" },
    { key: "waba_id", label: "WABA ID", placeholder: "1023…" },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…" },
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
  const [pending, start] = useTransition();

  const fields = FIELDS[type];

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

  return (
    <div className="mx-auto max-w-xl p-6">
      <Link href="/channels" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Hubungkan Channel</h1>
      <p className="text-sm text-muted-foreground">Pilih tipe channel lalu isi kredensial.</p>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setType(t.value);
              setCreds({});
            }}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              type === t.value ? "border-brand-blue bg-blue-50" : "border-border bg-card hover:bg-slate-50",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ background: CHANNEL_META[t.value].color }}
              >
                {CHANNEL_META[t.value].short}
              </span>
              <span className="text-sm font-semibold">{t.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <label className="block text-sm font-medium">Nama Channel</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. WA Toko Utama"
          className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
        />

        {fields.map((f) => (
          <div key={f.key} className="mt-3">
            <label className="block text-sm font-medium">{f.label}</label>
            <input
              value={creds[f.key] ?? ""}
              onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
          </div>
        ))}

        {type === "wa_unofficial" && (
          <div className="mt-3 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <QrCode className="mt-0.5 size-5 shrink-0" />
            <div>
              Channel dibuat status <b>pending</b>. Scan QR via gateway untuk pairing (TODO).
              Rawan banned untuk broadcast — gunakan hati-hati.
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={pending}
          className="mt-5 h-10 w-full rounded-lg bg-brand-blue text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Hubungkan
        </button>
      </div>
    </div>
  );
}
