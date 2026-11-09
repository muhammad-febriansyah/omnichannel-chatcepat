"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Loader2, MessageSquareOff, MessageSquareText, Save, Sparkles } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChannelIcon } from "@/components/app/channel-icon";
import { CHANNEL_META, type ChannelType } from "@/lib/format";
import { setChannelAutoReply, setReplyFallback, type FallbackAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export type ReplyAccount = { id: string; name: string; type: string; status: string; autoReply: boolean };

const DEFAULT_TEXT = "Terima kasih, pesan Anda kami terima. Agen kami akan segera membalas.";

// AI answers are built as a flow (trigger Cadangan + AI Agent step). "ai" is only shown
// for workspaces that picked it before, so the saved state stays visible.
const FALLBACKS: { value: FallbackAction; label: string; hint: string; icon: React.ElementType }[] = [
  { value: "message", label: "Pesan tetap", hint: "Kirim satu pesan (sekali per percakapan), lalu CS melanjutkan.", icon: MessageSquareText },
  { value: "silent", label: "Diam", hint: "Tidak dibalas, tunggu CS di Inbox.", icon: MessageSquareOff },
  { value: "ai", label: "Dijawab AI (lama)", hint: "Pengaturan lama. Sebaiknya pakai flow Cadangan + AI Agent.", icon: Sparkles },
];

function AccountRow({ account }: { account: ReplyAccount }) {
  const [on, setOn] = useState(account.autoReply);
  const [pending, start] = useTransition();
  const meta = CHANNEL_META[account.type as ChannelType];

  function change(next: boolean) {
    setOn(next);
    start(async () => {
      try {
        await setChannelAutoReply(account.id, next);
        if (next && account.type === "wa_unofficial") {
          gooeyToast.warning("Balas otomatis aktif — nomor unofficial lebih rawan dibatasi WhatsApp.");
        } else {
          gooeyToast.success(next ? `Balas otomatis aktif di ${account.name}` : `Balas otomatis nonaktif di ${account.name}`);
        }
      } catch (e) {
        setOn(!next);
        gooeyToast.error(errorMessage(e) ?? "Gagal mengubah balas otomatis");
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: meta?.color ?? "#94a3b8" }}>
        <ChannelIcon type={account.type as ChannelType} className="size-4.5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{account.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {meta?.label ?? account.type}
          {account.status !== "connected" && " · belum terhubung"}
        </span>
      </span>
      <Switch checked={on} onCheckedChange={change} disabled={pending} aria-label={`Balas otomatis ${account.name}`} />
    </li>
  );
}

// Automation → Pengaturan: which accounts auto-reply, and what happens when no flow
// matches. Flows themselves decide everything else.
export function ReplySettings({
  accounts,
  fallbackAction,
  fallbackMessage,
}: {
  accounts: ReplyAccount[];
  fallbackAction: FallbackAction;
  fallbackMessage: string;
}) {
  const [action, setAction] = useState<FallbackAction>(fallbackAction);
  const [message, setMessage] = useState(fallbackMessage);
  const [saved, setSaved] = useState({ action: fallbackAction, message: fallbackMessage });
  const [pending, start] = useTransition();
  const changed = action !== saved.action || message.trim() !== saved.message.trim();

  function save() {
    start(async () => {
      try {
        await setReplyFallback({ action, message });
        setSaved({ action, message });
        gooeyToast.success("Pengaturan balasan disimpan");
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menyimpan pengaturan");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Bot className="size-4 text-violet-600" /> Balas otomatis per akun
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Akun yang dimatikan tidak menjalankan flow — semua pesan dibalas CS manual.</p>
        {accounts.length === 0 ? (
          <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            Belum ada channel.{" "}
            <Link href="/channels/connect" className="font-medium text-brand-blue hover:underline">
              Hubungkan channel
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold">Kalau tidak ada flow yang cocok</h2>
        <p className="mt-1 text-sm text-muted-foreground">Berlaku untuk semua akun di workspace ini.</p>
        <div
          className={cn("mt-3 grid gap-2", saved.action === "ai" ? "grid-cols-3" : "grid-cols-2")}
          role="radiogroup"
          aria-label="Kalau tidak ada flow yang cocok"
        >
          {FALLBACKS.filter((f) => f.value !== "ai" || saved.action === "ai").map((f) => {
            const Icon = f.icon;
            const on = action === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAction(f.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                  on ? "border-brand-blue bg-blue-50 text-brand-blue ring-2 ring-brand-blue/10 dark:bg-blue-500/10" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{FALLBACKS.find((f) => f.value === action)?.hint}</p>

        <Link
          href="/flows?tab=template&kat=ai"
          className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50 p-3 text-xs text-violet-900 transition hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-200"
        >
          <Sparkles className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Ingin semua pertanyaan dijawab AI? Buat flow dari template <b>CS AI 24 Jam</b> (pemicu Cadangan + AI Agent).
          </span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>

        {action !== "silent" && (
          <label className="mt-3 block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              {action === "ai" ? "Pesan cadangan (kalau AI tidak bisa menjawab)" : "Isi pesan"}
            </span>
            <Textarea value={message} maxLength={500} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder={DEFAULT_TEXT} />
          </label>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={pending || !changed}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </section>
    </div>
  );
}
