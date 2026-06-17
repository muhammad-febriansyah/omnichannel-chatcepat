"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, MessageCircle, Check } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          gooeyToast.success("Disalin");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          gooeyToast.error("Gagal menyalin");
        }
      }}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-slate-50"
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />} Salin
    </button>
  );
}

export function AcquireTools({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- baca window.location setelah mount (hindari mismatch SSR)
  useEffect(() => setOrigin(window.location.origin), []);
  const optInUrl = origin ? `${origin}/opt-in/${slug}` : `…/opt-in/${slug}`;

  const [wa, setWa] = useState("");
  const [msg, setMsg] = useState("Halo, saya mau tanya produk.");
  const waLink = useMemo(() => {
    const digits = wa.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
  }, [wa, msg]);

  const inputCls =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

  return (
    <div className="space-y-5">
      {/* Opt-in form link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5 text-brand-blue" /> Form Opt-in
          </CardTitle>
          <CardDescription>
            Bagikan tautan ini. Kontak yang mengisi otomatis tercatat <b>opted-in</b> (boleh dikirimi broadcast).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input readOnly value={optInUrl} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
            <CopyBtn value={optInUrl} />
            <a
              href={optInUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-slate-50"
            >
              <ExternalLink className="size-4" /> Buka
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Click-to-WA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="size-5 text-[#25d366]" /> Click-to-WhatsApp
          </CardTitle>
          <CardDescription>Buat tautan wa.me dengan pesan pembuka. Pasang di bio/iklan/website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wa" className="mb-1.5 block text-sm font-medium text-foreground">Nomor WhatsApp bisnis</label>
              <input id="wa" value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="6281234567890" className={inputCls} />
            </div>
            <div>
              <label htmlFor="msg" className="mb-1.5 block text-sm font-medium text-foreground">Pesan pembuka</label>
              <input id="msg" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Halo, saya mau tanya…" className={inputCls} />
            </div>
          </div>
          {waLink ? (
            <div className="flex gap-2">
              <input readOnly value={waLink} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <CopyBtn value={waLink} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Masukkan nomor untuk membuat tautan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
