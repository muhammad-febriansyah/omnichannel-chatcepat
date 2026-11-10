"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorMessage } from "@/lib/action-error";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  MessageSquareText,
  Zap,
  FileText,
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  CornerUpLeft,
  ExternalLink,
  Phone,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { WaTemplatePreview } from "@/components/app/wa-template-preview";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate, createWaTemplate, uploadWaTemplateSample } from "@/lib/actions";

type Kind = "quick_reply" | "hsm";
type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type Btn =
  | { id: number; type: "QUICK_REPLY"; text: string }
  | { id: number; type: "URL"; text: string; url: string }
  | { id: number; type: "PHONE_NUMBER"; text: string; phone: string };

const HSM_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const HEADER_OPTS: { value: HeaderFormat; label: string; accept?: string }[] = [
  { value: "NONE", label: "Tanpa" },
  { value: "TEXT", label: "Teks" },
  { value: "IMAGE", label: "Gambar", accept: "image/jpeg,image/png" },
  { value: "VIDEO", label: "Video", accept: "video/mp4" },
  { value: "DOCUMENT", label: "Dokumen", accept: "application/pdf" },
];

const inputCls =
  "h-11 w-full text-sm";

let btnSeq = 0;

export function TemplateForm({
  mode,
  templateId,
  initial,
  waChannels = [],
}: {
  mode: "create" | "edit";
  templateId?: string;
  initial?: { name: string; kind: Kind; category: string; language: string; body: string };
  // Channel WA Official terhubung — template HSM dibuat di WABA channel terpilih.
  waChannels?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  // HSM dikelola di Meta (immutable setelah submit) → tidak bisa di-edit; edit hanya quick_reply lokal.
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "quick_reply");
  const [waChannelId, setWaChannelId] = useState(waChannels[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category || "MARKETING");
  const [language, setLanguage] = useState(initial?.language || "id");
  const [body, setBody] = useState(initial?.body ?? "");
  const [footer, setFooter] = useState("");
  const [vars, setVars] = useState<Record<number, string>>({});
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [buttons, setButtons] = useState<Btn[]>([]);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const isHsm = kind === "hsm" && !isEdit;

  // Jumlah placeholder {{n}} di body → minta contoh nilai (syarat review Meta).
  const placeholders = useMemo(() => {
    const nums = new Set<number>();
    for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) nums.add(Number(m[1]));
    return [...nums].sort((a, b) => a - b);
  }, [body]);

  const previewBody = useMemo(
    () => body.replace(/\{\{(\d+)\}\}/g, (all, n) => vars[Number(n)]?.trim() || all),
    [body, vars],
  );

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!waChannelId) return gooeyToast.error("Pilih channel WhatsApp Official dulu");
    setUploading(true);
    setHeaderHandle("");
    if (file.type.startsWith("image/")) setHeaderPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.set("file", file);
      const { handle } = await uploadWaTemplateSample(waChannelId, fd);
      setHeaderHandle(handle);
      gooeyToast.success("Contoh media terunggah ke Meta");
    } catch (err) {
      setHeaderPreview(null);
      gooeyToast.error(errorMessage(err) ?? "Gagal mengunggah media");
    } finally {
      setUploading(false);
    }
  }

  function addButton(type: Btn["type"]) {
    btnSeq += 1;
    const id = btnSeq;
    setButtons((bs) => [
      ...bs,
      type === "URL"
        ? { id, type, text: "", url: "https://" }
        : type === "PHONE_NUMBER"
          ? { id, type, text: "Hubungi kami", phone: "" }
          : { id, type, text: "" },
    ]);
  }
  const quickCount = buttons.filter((b) => b.type === "QUICK_REPLY").length;
  const urlCount = buttons.filter((b) => b.type === "URL").length;
  const phoneCount = buttons.filter((b) => b.type === "PHONE_NUMBER").length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama template wajib diisi");
    if (!body.trim()) return gooeyToast.error("Isi template wajib diisi");

    if (isHsm) {
      // Validasi: nama HSM Meta = huruf kecil/angka/underscore.
      if (!/^[a-z0-9_]+$/.test(name.trim()))
        return gooeyToast.error("Nama HSM hanya huruf kecil, angka, underscore (mis. order_update)");
      if (!waChannelId) return gooeyToast.error("Pilih channel WhatsApp Official");
      const missing = placeholders.filter((n) => !(vars[n] && vars[n].trim()));
      if (missing.length) return gooeyToast.error(`Isi contoh nilai untuk variabel {{${missing[0]}}}`);
      if (headerFormat === "TEXT" && !headerText.trim()) return gooeyToast.error("Isi teks header");
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && !headerHandle)
        return gooeyToast.error("Unggah contoh media header dulu");
      if (buttons.some((b) => !b.text.trim())) return gooeyToast.error("Setiap tombol wajib punya teks");
      const variables = placeholders.map((n) => vars[n].trim());
      start(async () => {
        try {
          const res = await createWaTemplate({
            channelId: waChannelId,
            templateName: name.trim(),
            category,
            language: language.trim() || "id",
            body: body.trim(),
            variables,
            footer: footer.trim() || undefined,
            header:
              headerFormat === "NONE"
                ? undefined
                : { format: headerFormat, text: headerText.trim() || undefined, handle: headerHandle || undefined },
            buttons: buttons.map((b) =>
              b.type === "URL"
                ? { type: "URL" as const, text: b.text.trim(), url: b.url.trim() }
                : b.type === "PHONE_NUMBER"
                  ? { type: "PHONE_NUMBER" as const, text: b.text.trim(), phone: b.phone.trim() }
                  : { type: "QUICK_REPLY" as const, text: b.text.trim() },
            ),
          });
          gooeyToast.success(`Template disubmit ke Meta — status ${res.status}. Tunggu approval.`);
          router.push("/templates");
        } catch (err) {
          gooeyToast.error(errorMessage(err) ?? "Gagal membuat template");
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
        const msg = errorMessage(err) ?? "Gagal menyimpan template";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  const kinds: { value: Kind; label: string; desc: string; icon: typeof Zap }[] = [
    { value: "quick_reply", label: "Balasan Cepat", desc: "Canned reply internal, langsung pakai", icon: Zap },
    { value: "hsm", label: "Template WhatsApp (HSM)", desc: "Gambar, tombol, variabel — disubmit ke Meta", icon: FileText },
  ];
  const headerAccept = HEADER_OPTS.find((o) => o.value === headerFormat)?.accept;

  return (
    <div className="w-full p-6">
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Template
      </Link>

      <form onSubmit={submit}>
        <div className={cn("grid gap-6", isHsm && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{isEdit ? "Edit Template" : "Template Baru"}</CardTitle>
              <CardDescription>
                {isHsm
                  ? "Template WhatsApp bisa memuat gambar, variabel, dan tombol yang bisa diklik pelanggan."
                  : "Simpan balasan cepat untuk membantu agen menjawab pelanggan."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {!isEdit && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Jenis</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {kinds.filter((k) => waChannels.length > 0 || k.value === "quick_reply").map((k) => {
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
                  {waChannels.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Hubungkan channel WhatsApp Official untuk membuat template WhatsApp.
                    </p>
                  )}
                </div>
              )}

              {isHsm && (
                <section className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Akun & identitas</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="waChannel" className="mb-1.5 block text-sm font-medium">Channel WhatsApp Official</label>
                      <NativeSelect id="waChannel" value={waChannelId} onChange={(e) => setWaChannelId(e.target.value)} className={inputCls}>
                        {waChannels.map((c) => (
                          <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="category" className="mb-1.5 block text-sm font-medium">Kategori</label>
                        <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                          {HSM_CATEGORIES.map((c) => (
                            <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                      <div>
                        <label htmlFor="language" className="mb-1.5 block text-sm font-medium">Bahasa</label>
                        <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="id / en_US" className={inputCls} />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama Template</label>
                <div className="relative">
                  <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(isHsm ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") : e.target.value)}
                    placeholder={isHsm ? "undangan_event_nov" : "Salam pembuka"}
                    className={cn(inputCls, "pl-10")}
                  />
                </div>
                {isHsm && <p className="mt-1.5 text-xs text-muted-foreground">Huruf kecil, angka, underscore. Unik per bahasa.</p>}
              </div>

              {isHsm && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Header</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {HEADER_OPTS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setHeaderFormat(o.value);
                          setHeaderHandle("");
                          setHeaderPreview(null);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          headerFormat === o.value
                            ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10"
                            : "border-transparent bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {headerFormat === "TEXT" && (
                    <Input value={headerText} maxLength={60} onChange={(e) => setHeaderText(e.target.value)} placeholder="Judul pesan (maks 60)" className={inputCls} />
                  )}
                  {headerAccept && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
                      <input ref={fileRef} type="file" accept={headerAccept} className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
                      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                        {uploading ? "Mengunggah…" : "Unggah contoh"}
                      </Button>
                      {headerHandle ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" /> Contoh siap untuk review Meta
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Contoh dipakai Meta untuk review. Saat broadcast, media bisa diganti.</span>
                      )}
                    </div>
                  )}
                </section>
              )}

              <div>
                <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-foreground">Isi Pesan</label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder={isHsm ? "Hai {{1}}, undangan Masterclass {{2}} sudah dibuka. Pilih cara ikut di bawah ya 👇" : "Halo! Ada yang bisa kami bantu?"}
                  className="w-full p-3 text-sm"
                />
                {isHsm && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Pakai {"{{1}}"}, {"{{2}}"} untuk variabel (mis. nama pelanggan). Format: *tebal*, _miring_.
                  </p>
                )}
              </div>

              {isHsm && placeholders.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-foreground">Contoh nilai variabel (untuk review Meta)</p>
                  {placeholders.map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground">{`{{${n}}}`}</span>
                      <Input
                        value={vars[n] ?? ""}
                        onChange={(e) => setVars((p) => ({ ...p, [n]: e.target.value }))}
                        placeholder={n === 1 ? "Budi" : "19 November"}
                        className="h-9 w-full text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {isHsm && (
                <div>
                  <label htmlFor="footer" className="mb-1.5 block text-sm font-medium text-foreground">
                    Footer <span className="text-muted-foreground">(opsional, maks 60)</span>
                  </label>
                  <Input id="footer" value={footer} maxLength={60} onChange={(e) => setFooter(e.target.value)} placeholder="Balas STOP untuk berhenti" className={inputCls} />
                </div>
              )}

              {isHsm && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tombol</h3>
                    <span className="text-[11px] text-muted-foreground">{buttons.length}/10</span>
                  </div>
                  {buttons.length === 0 && (
                    <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                      Tambahkan tombol <b>Balas cepat</b> (mis. “Mau Daftar Offline”). Saat pelanggan klik, ChatCepat menjalankan flow
                      dengan pemicu <b>Klik tombol</b> yang labelnya sama, dan mencatat kliknya di laporan broadcast.
                    </p>
                  )}
                  {buttons.map((b, i) => {
                    const Icon = b.type === "URL" ? ExternalLink : b.type === "PHONE_NUMBER" ? Phone : CornerUpLeft;
                    const update = (patch: Partial<Btn>) =>
                      setButtons((bs) => bs.map((x, j) => (j === i ? ({ ...x, ...patch } as Btn) : x)));
                    return (
                      <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <Icon className="size-4" />
                        </span>
                        <Input
                          value={b.text}
                          maxLength={25}
                          onChange={(e) => update({ text: e.target.value })}
                          placeholder={b.type === "QUICK_REPLY" ? "Teks tombol (maks 25)" : "Label tombol"}
                          className="h-9 min-w-[140px] flex-1 text-sm"
                        />
                        {b.type === "URL" && (
                          <Input value={b.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" className="h-9 min-w-[160px] flex-1 text-sm" />
                        )}
                        {b.type === "PHONE_NUMBER" && (
                          <Input value={b.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+62812…" className="h-9 min-w-[140px] flex-1 text-sm" />
                        )}
                        <button type="button" aria-label="Hapus tombol" onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={buttons.length >= 10 || quickCount >= 10} onClick={() => addButton("QUICK_REPLY")}>
                      <Plus className="size-3.5" /> Balas cepat
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={buttons.length >= 10 || urlCount >= 2} onClick={() => addButton("URL")}>
                      <Plus className="size-3.5" /> Link
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={buttons.length >= 10 || phoneCount >= 1} onClick={() => addButton("PHONE_NUMBER")}>
                      <Plus className="size-3.5" /> Telepon
                    </Button>
                  </div>
                </section>
              )}
            </CardContent>

            <CardFooter className="justify-end gap-2 border-t border-border">
              <ActionLink href="/templates" variant="outline" className="px-5">
                Batal
              </ActionLink>
              <Button type="submit" size="lg" disabled={pending || uploading} className="px-5">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {pending ? "Menyimpan…" : isHsm ? "Submit ke Meta" : "Simpan Template"}
              </Button>
            </CardFooter>
          </Card>

          {isHsm && (
            <div className="xl:sticky xl:top-6 xl:self-start">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pratinjau</p>
              <WaTemplatePreview
                headerFormat={headerFormat}
                headerText={headerText}
                mediaUrl={headerPreview}
                body={previewBody}
                footer={footer}
                buttons={buttons.map((b) => ({ type: b.type, text: b.text }))}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Template baru berstatus <b>Menunggu Meta</b>. Biasanya disetujui dalam beberapa menit sampai 24 jam.
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
