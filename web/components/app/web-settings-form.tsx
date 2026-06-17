"use client";

import { useRef, useState, useTransition } from "react";
import {
  Save,
  Globe,
  Image as ImageIcon,
  Search,
  Share2,
  Phone,
  Link2,
  Music2,
  MessageCircle,
  Mail,
  MapPin,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveWebSettings } from "@/lib/actions";
import type { WebSettings } from "@/lib/web-settings";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Picker gambar: pilih file → unggah ke /api/upload → simpan URL hasil. Tanpa input URL.
function ImageUpload({
  label,
  hint,
  value,
  accept,
  preview,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  accept: string;
  preview: "logo" | "icon";
  onChange: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file sama lagi
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah");
      onChange(data.url as string);
      gooeyToast.success("Gambar terunggah");
    } catch (err) {
      gooeyToast.error(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <input ref={ref} type="file" accept={accept} onChange={onFile} className="hidden" />
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50 ${
            preview === "logo" ? "h-12 w-20" : "size-12"
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- aset brand arbitrer
            <img src={value} alt={label} className="size-full object-contain p-1" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-card disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Mengunggah…" : value ? "Ganti" : "Unggah"}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="Hapus gambar"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </Field>
  );
}

const SOCIALS: { key: keyof WebSettings["social"]; label: string; icon: React.ElementType; ph: string }[] = [
  { key: "instagram", label: "Instagram", icon: Link2, ph: "https://instagram.com/…" },
  { key: "facebook", label: "Facebook", icon: Link2, ph: "https://facebook.com/…" },
  { key: "twitter", label: "X / Twitter", icon: Link2, ph: "https://x.com/…" },
  { key: "tiktok", label: "TikTok", icon: Music2, ph: "https://tiktok.com/@…" },
  { key: "youtube", label: "YouTube", icon: Link2, ph: "https://youtube.com/@…" },
  { key: "linkedin", label: "LinkedIn", icon: Link2, ph: "https://linkedin.com/company/…" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, ph: "628xxxxxxxxxx" },
];

export function WebSettingsForm({ initial }: { initial: WebSettings }) {
  const [v, setV] = useState<WebSettings>(initial);
  const [pending, start] = useTransition();

  const set = (patch: Partial<WebSettings>) => setV((s) => ({ ...s, ...patch }));
  const setSeo = (patch: Partial<WebSettings["seo"]>) => setV((s) => ({ ...s, seo: { ...s.seo, ...patch } }));
  const setSocial = (patch: Partial<WebSettings["social"]>) => setV((s) => ({ ...s, social: { ...s.social, ...patch } }));
  const setContact = (patch: Partial<WebSettings["contact"]>) => setV((s) => ({ ...s, contact: { ...s.contact, ...patch } }));

  function submit() {
    start(async () => {
      try {
        await saveWebSettings(v);
        gooeyToast.success("Pengaturan website tersimpan");
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Gagal menyimpan");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Identitas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Globe className="size-5 text-brand-blue" /> Identitas Situs</CardTitle>
          <CardDescription>Nama, tagline, dan deskripsi singkat workspace kamu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Situs"><input value={v.siteName} onChange={(e) => set({ siteName: e.target.value })} className={inputCls} /></Field>
            <Field label="Tagline"><input value={v.tagline} onChange={(e) => set({ tagline: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Deskripsi">
            <textarea value={v.description} onChange={(e) => set({ description: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10" />
          </Field>
        </CardContent>
      </Card>

      {/* Brand */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="size-5 text-brand-blue" /> Logo &amp; Favicon</CardTitle>
          <CardDescription>Unggah aset brand. Tampil di login, form opt-in, dan tab browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload
              label="Logo"
              hint="Rasio landscape, PNG/SVG transparan. Maks 2 MB."
              value={v.logoUrl}
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              preview="logo"
              onChange={(url) => set({ logoUrl: url })}
            />
            <ImageUpload
              label="Favicon"
              hint="Ukuran kecil, .ico / .png 32×32. Maks 2 MB."
              value={v.faviconUrl}
              accept="image/x-icon,image/vnd.microsoft.icon,image/png"
              preview="icon"
              onChange={(url) => set({ faviconUrl: url })}
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Search className="size-5 text-brand-blue" /> SEO &amp; Meta</CardTitle>
          <CardDescription>Judul, deskripsi, dan gambar share (Open Graph).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Meta Title"><input value={v.seo.title} onChange={(e) => setSeo({ title: e.target.value })} className={inputCls} /></Field>
          <Field label="Meta Description" hint="±150–160 karakter ideal.">
            <textarea value={v.seo.description} onChange={(e) => setSeo({ description: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Keywords" hint="Pisahkan dengan koma."><input value={v.seo.keywords} onChange={(e) => setSeo({ keywords: e.target.value })} className={inputCls} /></Field>
            <ImageUpload
              label="OG Image"
              hint="Gambar share sosmed, ideal 1200×630. Maks 2 MB."
              value={v.seo.ogImage}
              accept="image/png,image/jpeg,image/webp"
              preview="logo"
              onChange={(url) => setSeo({ ogImage: url })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sosmed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Share2 className="size-5 text-brand-blue" /> Sosial Media</CardTitle>
          <CardDescription>Tautan akun resmi (kosongkan jika tidak ada).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map(({ key, label, icon: Icon, ph }) => (
            <div key={key} className="relative">
              <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={v.social[key]}
                onChange={(e) => setSocial({ [key]: e.target.value })}
                placeholder={`${label} — ${ph}`}
                className={`${inputCls} pl-10`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Kontak */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Phone className="size-5 text-brand-blue" /> Kontak</CardTitle>
          <CardDescription>Info kontak publik (footer, halaman opt-in).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={v.contact.email} onChange={(e) => setContact({ email: e.target.value })} className={`${inputCls} pl-10`} />
              </div>
            </Field>
            <Field label="Telepon">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={v.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} className={`${inputCls} pl-10`} />
              </div>
            </Field>
          </div>
          <Field label="Alamat">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={v.contact.address} onChange={(e) => setContact({ address: e.target.value })} className={`${inputCls} pl-10`} />
            </div>
          </Field>
        </CardContent>
        <CardFooter className="justify-end border-t border-border">
          <button
            onClick={submit}
            disabled={pending}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Pengaturan"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
