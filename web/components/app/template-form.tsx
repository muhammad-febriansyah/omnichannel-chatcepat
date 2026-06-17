"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Save, MessageSquareText, Zap, FileText } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate } from "@/lib/actions";

type Kind = "quick_reply" | "hsm";

const HSM_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];

export function TemplateForm({
  mode,
  templateId,
  initial,
}: {
  mode: "create" | "edit";
  templateId?: string;
  initial?: { name: string; kind: Kind; category: string; language: string; body: string };
}) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "quick_reply");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category || HSM_CATEGORIES[1]);
  const [language, setLanguage] = useState(initial?.language || "id");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pending, start] = useTransition();
  const isEdit = mode === "edit";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama template wajib diisi");
    if (!body.trim()) return gooeyToast.error("Isi template wajib diisi");
    const input = { name, kind, category, language, body };
    start(async () => {
      try {
        if (isEdit && templateId) await updateTemplate(templateId, input);
        else await createTemplate(input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan template";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  const kinds: { value: Kind; label: string; desc: string; icon: typeof Zap }[] = [
    { value: "quick_reply", label: "Balasan Cepat", desc: "Canned reply internal, langsung pakai", icon: Zap },
    { value: "hsm", label: "Template WhatsApp (HSM)", desc: "Perlu approval Meta sebelum broadcast", icon: FileText },
  ];

  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Template
      </Link>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isEdit ? "Edit Template" : "Template Baru"}</CardTitle>
            <CardDescription>Template WhatsApp (HSM) untuk broadcast & balasan cepat untuk agen.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Jenis</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {kinds.map((k) => {
                  const Icon = k.icon;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        kind === k.value ? "border-brand-blue bg-blue-50" : "border-border bg-card hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-brand-blue" />
                        <span className="text-sm font-semibold">{k.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{k.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama Template</label>
              <div className="relative">
                <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "hsm" ? "order_confirmation" : "Salam pembuka"}
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
            </div>

            {kind === "hsm" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">Kategori</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                  >
                    {HSM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-foreground">Bahasa</label>
                  <input
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="id / en_US"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-foreground">Isi Pesan</label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder={kind === "hsm" ? "Halo {{1}}, pesanan {{2}} sudah kami proses." : "Halo! Ada yang bisa kami bantu?"}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
              />
              {kind === "hsm" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Pakai {"{{1}}"}, {"{{2}}"} untuk variabel. Status awal <b>draft</b> — perlu approval Meta.
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <Link href="/templates" className="flex h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50">
              Batal
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Template"}
            </button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
