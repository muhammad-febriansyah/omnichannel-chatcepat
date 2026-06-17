"use client";

import { useState, useTransition } from "react";
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
          <CardDescription>URL aset brand. Tampil di login, form opt-in, dan tab browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo (URL)" hint="Rasio landscape, PNG/SVG transparan.">
              <input value={v.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="/logo.png" className={`${inputCls} font-mono text-xs`} />
              {v.logoUrl && (
                <div className="mt-2 flex h-12 items-center rounded-lg border border-border bg-slate-50 px-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL eksternal arbitrer */}
                  <img src={v.logoUrl} alt="logo" className="h-7 w-auto object-contain" />
                </div>
              )}
            </Field>
            <Field label="Favicon (URL)" hint="Ukuran kecil, .ico / .png 32×32.">
              <input value={v.faviconUrl} onChange={(e) => set({ faviconUrl: e.target.value })} placeholder="/favicon.ico" className={`${inputCls} font-mono text-xs`} />
              {v.faviconUrl && (
                <div className="mt-2 flex h-12 items-center gap-2 rounded-lg border border-border bg-slate-50 px-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL eksternal arbitrer */}
                  <img src={v.faviconUrl} alt="favicon" className="size-6 object-contain" />
                  <span className="text-xs text-muted-foreground">pratinjau</span>
                </div>
              )}
            </Field>
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
            <Field label="OG Image (URL)"><input value={v.seo.ogImage} onChange={(e) => setSeo({ ogImage: e.target.value })} className={`${inputCls} font-mono text-xs`} /></Field>
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
