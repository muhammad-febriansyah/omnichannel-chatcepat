"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, MessageSquareText, Zap, FileText } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate, createWaTemplate } from "@/lib/actions";

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
  const router = useRouter();
  const isEdit = mode === "edit";
  // HSM baru dikelola di api.co.id (immutable di Meta) → tidak bisa di-edit; edit hanya quick_reply lokal.
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "quick_reply");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category || HSM_CATEGORIES[1]);
  const [language, setLanguage] = useState(initial?.language || "id");
  const [body, setBody] = useState(initial?.body ?? "");
  const [footer, setFooter] = useState("");
  const [vars, setVars] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();

  // Jumlah placeholder {{n}} di body → minta contoh nilai (syarat api.co.id/Meta).
  const placeholders = useMemo(() => {
    const nums = new Set<number>();
    for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) nums.add(Number(m[1]));
    return [...nums].sort((a, b) => a - b);
  }, [body]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama template wajib diisi");
    if (!body.trim()) return gooeyToast.error("Isi template wajib diisi");

    if (kind === "hsm" && !isEdit) {
      // Validasi: nama HSM Meta = huruf kecil/angka/underscore.
      if (!/^[a-z0-9_]+$/.test(name.trim()))
        return gooeyToast.error("Nama HSM hanya huruf kecil, angka, underscore (mis. order_update)");
      const missing = placeholders.filter((n) => !(vars[n] && vars[n].trim()));
      if (missing.length) return gooeyToast.error(`Isi contoh nilai untuk variabel {{${missing[0]}}}`);
      const variables = placeholders.map((n) => vars[n].trim());
      start(async () => {
        try {
          const res = await createWaTemplate({
            templateName: name.trim(),
            category,
            language: language.trim() || "id",
            body: body.trim(),
            variables,
            footer: footer.trim() || undefined,
          });
          gooeyToast.success(`Template disubmit ke Meta — status ${res.status}. Tunggu approval.`);
          router.push("/templates");
        } catch (err) {
          gooeyToast.error(err instanceof Error ? err.message : "Gagal membuat template");
        }
      });
      return;
    }

    // quick_reply (lokal) atau edit quick_reply lama.
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
    { value: "hsm", label: "Template WhatsApp (HSM)", desc: "Disubmit ke Meta untuk approval", icon: FileText },
  ];

  return (
    <div className="w-full p-6">
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Template
      </Link>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isEdit ? "Edit Template" : "Template Baru"}</CardTitle>
            <CardDescription>Template WhatsApp (HSM) disubmit ke Meta; balasan cepat untuk agen.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {!isEdit && (
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
                          kind === k.value
                            ? "border-brand-blue bg-blue-50 dark:bg-blue-500/10"
                            : "border-border bg-card hover:bg-muted/50",
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
            )}

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
              {kind === "hsm" && (
                <p className="mt-1.5 text-xs text-muted-foreground">Huruf kecil, angka, underscore. Unik per bahasa.</p>
              )}
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
                  Pakai {"{{1}}"}, {"{{2}}"} untuk variabel. Akan disubmit ke Meta — status awal <b>PENDING</b>.
                </p>
              )}
            </div>

            {/* Contoh nilai variabel (wajib Meta) */}
            {kind === "hsm" && !isEdit && placeholders.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Contoh nilai variabel (untuk review Meta)</p>
                {placeholders.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground">{`{{${n}}}`}</span>
                    <input
                      value={vars[n] ?? ""}
                      onChange={(e) => setVars((p) => ({ ...p, [n]: e.target.value }))}
                      placeholder={n === 1 ? "Budi" : "INV-12345"}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                    />
                  </div>
                ))}
              </div>
            )}

            {kind === "hsm" && !isEdit && (
              <div>
                <label htmlFor="footer" className="mb-1.5 block text-sm font-medium text-foreground">
                  Footer <span className="text-muted-foreground">(opsional, maks 60)</span>
                </label>
                <input
                  id="footer"
                  value={footer}
                  maxLength={60}
                  onChange={(e) => setFooter(e.target.value)}
                  placeholder="ChatCepat"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <ActionLink href="/templates" variant="outline" className="px-5">
              Batal
            </ActionLink>
            <Button type="submit" size="lg" disabled={pending} className="px-5">
              <Save className="size-4" />{" "}
              {pending ? "Menyimpan…" : kind === "hsm" && !isEdit ? "Submit ke Meta" : "Simpan Template"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
