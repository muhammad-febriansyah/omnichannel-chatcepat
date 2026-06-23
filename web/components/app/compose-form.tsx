"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, Phone, User, Radio, Info } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CHANNEL_META, type ChannelType } from "@/lib/format";
import { startConversation } from "@/lib/actions";

export type ComposeChannel = { id: string; name: string; type: string; status: string };
export type ComposeTemplate = { name: string; body: string; language: string };

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

export function ComposeForm({
  channels,
  templates,
}: {
  channels: ComposeChannel[];
  templates: ComposeTemplate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [msgType, setMsgType] = useState<"text" | "template">("text");
  const [templateName, setTemplateName] = useState(templates[0]?.name ?? "");

  const selected = channels.find((c) => c.id === channelId);
  const isWaOfficial = selected?.type === "wa_official";
  const tpl = templates.find((t) => t.name === templateName);
  const hasTemplates = templates.length > 0;

  // WA official: pesan pertama ke nomor baru WAJIB template (api.co.id auto-buat customer).
  // Teks bebas hanya jalan kalau nomor pernah chat <24 jam (customer sudah ada).
  const showTemplateToggle = isWaOfficial && hasTemplates;
  // Tanpa template approved, wa_official tak bisa memulai percakapan baru sama sekali.
  const blockedNoTemplate = isWaOfficial && !hasTemplates;

  // Saat pindah ke channel wa_official, default ke template (cara aman first-contact).
  useEffect(() => {
    if (isWaOfficial && hasTemplates) setMsgType("template");
    else if (!isWaOfficial) setMsgType("text");
  }, [isWaOfficial, hasTemplates]);

  function submit() {
    const digits = phone.replace(/\D/g, "");
    if (!channelId) return gooeyToast.error("Pilih channel pengirim");
    if (!digits) return gooeyToast.error("Nomor telepon wajib diisi");
    if (blockedNoTemplate)
      return gooeyToast.error("WhatsApp resmi butuh template approved untuk pesan pertama");
    if (msgType === "text" && !body.trim()) return gooeyToast.error("Pesan tidak boleh kosong");
    if (msgType === "template" && !templateName) return gooeyToast.error("Pilih template");

    start(async () => {
      try {
        const { conversationId } = await startConversation({
          channelId,
          phone: digits,
          name: name.trim() || undefined,
          type: msgType,
          body: msgType === "text" ? body.trim() : undefined,
          templateName: msgType === "template" ? templateName : undefined,
          templateLang: tpl?.language,
        });
        gooeyToast.success("Percakapan dimulai");
        router.push(`/inbox/${conversationId}`);
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Gagal memulai percakapan");
      }
    });
  }

  return (
    <div className="w-full p-6">
      <Link
        href="/inbox"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Inbox
      </Link>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Pesan Baru</CardTitle>
          <CardDescription>Mulai percakapan baru ke satu nomor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {channels.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>Belum ada channel terhubung. Hubungkan WhatsApp/Telegram di menu Channel dulu.</span>
            </div>
          ) : (
            <>
              {/* Channel pengirim */}
              <div>
                <label htmlFor="channel" className="mb-1.5 block text-sm font-medium text-foreground">
                  Kirim dari Channel
                </label>
                <div className="relative">
                  <Radio className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="channel"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {CHANNEL_META[c.type as ChannelType]?.label ?? c.type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nomor tujuan + nama */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
                    Nomor Tujuan
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="628123456789"
                      inputMode="tel"
                      className={inputCls}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Format internasional, mis. 628xxx.</p>
                </div>
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                    Nama <span className="text-muted-foreground">(opsional)</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Budi Santoso"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* WA official tanpa template approved → tak bisa memulai percakapan baru */}
              {blockedNoTemplate && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    WhatsApp resmi butuh <b>template (HSM) approved</b> untuk pesan pertama ke nomor baru
                    (api.co.id membuat customer otomatis lewat template). Buat dulu di menu{" "}
                    <b>Template Pesan</b>, atau pakai channel <b>WhatsApp unofficial</b> untuk teks bebas.
                  </span>
                </div>
              )}

              {/* Tipe pesan untuk WA official (ada template) */}
              {showTemplateToggle && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-brand-navy dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    WhatsApp resmi: pesan pertama ke nomor baru wajib <b>template (HSM)</b>. Teks bebas hanya
                    terkirim bila nomor sudah pernah chat dalam 24 jam terakhir.
                  </span>
                </div>
              )}
              {showTemplateToggle && (
                <div className="flex gap-2">
                  {(["template", "text"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMsgType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        msgType === t
                          ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t === "text" ? "Teks bebas" : "Template HSM"}
                    </button>
                  ))}
                </div>
              )}

              {/* Body / template */}
              {blockedNoTemplate ? null : msgType === "template" && showTemplateToggle ? (
                <div>
                  <label htmlFor="template" className="mb-1.5 block text-sm font-medium text-foreground">
                    Template
                  </label>
                  <select
                    id="template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                  >
                    {templates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {tpl && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      {tpl.body}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-foreground">
                    Pesan
                  </label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    placeholder="Tulis pesan pertama…"
                    className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link
            href="/inbox"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Batal
          </Link>
          <Button onClick={submit} disabled={pending || channels.length === 0 || blockedNoTemplate}>
            <Send className="size-4" /> {pending ? "Mengirim…" : "Kirim Pesan"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
