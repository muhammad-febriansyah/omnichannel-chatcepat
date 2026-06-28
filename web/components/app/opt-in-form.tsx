"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, User, Phone, Send } from "lucide-react";
import { createOptIn } from "@/lib/actions";

export function OptInForm({ slug, workspaceName }: { slug: string; workspaceName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) return setError("Nomor telepon wajib diisi");
    if (!consent) return setError("Centang persetujuan untuk melanjutkan");
    start(async () => {
      try {
        await createOptIn(slug, { name, phone });
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengirim");
      }
    });
  }

  const inputCls =
    "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-brand-navy outline-none transition-shadow focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-foreground";

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-success dark:bg-emerald-500/10">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-brand-navy dark:text-foreground">Terima kasih! 🎉</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kamu berhasil berlangganan update dari <b>{workspaceName}</b>. Sampai jumpa di WhatsApp!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-brand-navy dark:text-foreground">Nama</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-brand-navy dark:text-foreground">Nomor WhatsApp</label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0812xxxxxxx" className={inputCls} />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="peer absolute size-0 opacity-0" />
        <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border-[1.5px] border-muted-foreground/40 bg-background transition-colors peer-checked:border-brand-blue peer-checked:bg-brand-blue">
          <CheckCircle2 className="size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
        Saya setuju dihubungi oleh <b className="font-semibold text-brand-navy dark:text-foreground">&nbsp;{workspaceName}&nbsp;</b> via WhatsApp untuk update & promo.
      </label>

      {error && <p className="text-xs font-medium text-danger">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        <Send className="size-4" /> {pending ? "Mengirim…" : "Berlangganan"}
      </button>
    </form>
  );
}
