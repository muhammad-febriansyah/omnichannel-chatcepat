"use client";

import { errorMessage } from "@/lib/action-error";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, CircleDashed, FileClock, Loader2, Megaphone, Rocket, Save, Users, X, XCircle, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flowBroadcastInfo, flowTriggerClashes, type FlowClash } from "@/lib/actions";
import { formatWib } from "@/lib/broadcast-flow";
import type { FlowBroadcastInfo, FlowBroadcastResult } from "@/lib/flow-broadcast";
import type { TriggerKind } from "@/lib/flow-graph";

export type SaveSummary = {
  id: string;
  name: string;
  trigger: TriggerKind;
  keywords: string[];
  tags: string[];
  scheduleAt: string | null;
  steps: number;
  aiNodes: number;
};

type Phase = "confirm" | "saving" | "done" | "error";
type StepState = "wait" | "run" | "ok" | "fail";

const TRIGGER_TEXT: Record<TriggerKind, string> = {
  keyword: "Keyword",
  button: "Tombol broadcast",
  welcome: "Awal percakapan",
  fallback: "Pesan tak dikenali",
  comment: "Semua komentar FB/IG",
  broadcast: "Broadcast terjadwal",
};

// Keeps the loading state on screen long enough to read (fast saves would just flash).
const MIN_STEP_MS = 450;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function StepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
          state === "ok" && "bg-emerald-500 text-white",
          state === "run" && "bg-blue-50 text-brand-blue dark:bg-blue-500/15",
          state === "fail" && "bg-red-500 text-white",
          state === "wait" && "bg-muted text-muted-foreground",
        )}
      >
        {state === "ok" ? (
          <Check className="size-3.5" />
        ) : state === "run" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : state === "fail" ? (
          <X className="size-3.5" />
        ) : (
          <CircleDashed className="size-3.5" />
        )}
      </span>
      <span className={cn("text-sm", state === "wait" ? "text-muted-foreground" : "font-medium")}>{label}</span>
    </li>
  );
}

export function SaveFlowDialog({
  open,
  onOpenChange,
  summary,
  initialActivate,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SaveSummary;
  initialActivate: boolean;
  onSave: (activate: boolean) => Promise<FlowBroadcastResult>;
}) {
  const isBroadcast = summary.trigger === "broadcast";
  const [phase, setPhase] = useState<Phase>("confirm");
  const [activate, setActivate] = useState(initialActivate);
  const [steps, setSteps] = useState<StepState[]>(["wait", "wait", "wait"]);
  const [error, setError] = useState("");
  const [clashes, setClashes] = useState<FlowClash[] | null>(null);
  const [bc, setBc] = useState<FlowBroadcastInfo | null>(null);
  const [result, setResult] = useState<FlowBroadcastResult | null>(null);
  const tagKey = summary.tags.join("|");

  useEffect(() => {
    if (!open || !isBroadcast) return;
    let alive = true;
    flowBroadcastInfo(summary.id, tagKey ? tagKey.split("|") : [])
      .then((i) => alive && setBc(i))
      .catch(() => alive && setBc({ recipients: 0, pending: null, sent: null }));
    return () => {
      alive = false;
    };
  }, [open, isBroadcast, summary.id, tagKey]);

  // Mounted fresh for every save (keyed by the builder), so state starts from props.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    flowTriggerClashes(summary.id, summary.trigger, summary.keywords)
      .then((c) => alive && setClashes(c))
      .catch(() => alive && setClashes([]));
    return () => {
      alive = false;
    };
  }, [open, summary.id, summary.trigger, summary.keywords]);

  const busy = phase === "saving";
  const labels = [
    "Memeriksa sambungan langkah",
    "Menyimpan flow",
    activate ? (isBroadcast ? (bc?.sent ? "Mengaktifkan balasan broadcast" : "Menjadwalkan broadcast") : "Mengaktifkan pemicu") : "Menandai sebagai draft",
  ];

  async function run() {
    setPhase("saving");
    setError("");
    setSteps(["run", "wait", "wait"]);
    await wait(MIN_STEP_MS);
    setSteps(["ok", "run", "wait"]);
    try {
      const [res] = await Promise.all([onSave(activate), wait(MIN_STEP_MS)]);
      setResult(res);
      setSteps(["ok", "ok", "run"]);
      await wait(MIN_STEP_MS);
      setSteps(["ok", "ok", "ok"]);
      setPhase("done");
      await wait(900);
      onOpenChange(false);
    } catch (e) {
      setSteps(["ok", "fail", "wait"]);
      setError(errorMessage(e) ?? "Gagal menyimpan flow");
      setPhase("error");
    }
  }

  const triggerText =
    summary.keywords.length && (summary.trigger === "keyword" || summary.trigger === "button" || summary.trigger === "comment")
      ? summary.keywords.slice(0, 4).join(", ") + (summary.keywords.length > 4 ? ` +${summary.keywords.length - 4}` : "")
      : TRIGGER_TEXT[summary.trigger];
  const when = summary.scheduleAt ? formatWib(summary.scheduleAt) : "Segera setelah disimpan";
  const doneText = !activate
    ? result?.state === "cancelled"
      ? "Jadwal broadcast dibatalkan. Aktifkan lagi kapan saja."
      : "Aktifkan kapan saja saat flow siap."
    : result?.state === "scheduled" || result?.state === "updated"
      ? `Broadcast ${result.state === "updated" ? "dijadwalkan ulang" : "dijadwalkan"}: ${formatWib(result.scheduledAt)}. Pantau di tab Riwayat Broadcast.`
      : result?.state === "sent"
        ? "Broadcast tidak dikirim ulang. Balasan & klik tombol tetap diproses flow ini."
        : "Flow sudah siap membalas pelanggan.";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="gap-5 sm:max-w-md">
        {phase === "confirm" ? (
          <>
            <AlertDialogHeader>
              <span className="mb-1 grid size-11 place-items-center rounded-xl bg-blue-50 text-brand-blue dark:bg-blue-500/15">
                <Save className="size-5" />
              </span>
              <AlertDialogTitle>Simpan flow?</AlertDialogTitle>
              <AlertDialogDescription>
                {isBroadcast
                  ? "Periksa penerima dan waktu kirim. Pesan hanya dikirim ke kontak yang sudah opt-in."
                  : "Periksa ringkasan di bawah sebelum flow dipakai untuk membalas pelanggan."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/30 p-3.5 text-sm">
              <dt className="text-muted-foreground">Nama</dt>
              <dd className="truncate font-medium">{summary.name}</dd>
              <dt className="text-muted-foreground">Pemicu</dt>
              <dd className="flex min-w-0 items-center gap-1.5 font-medium">
                <Zap className="size-3.5 shrink-0 text-amber-500" />
                <span className="truncate">{triggerText}</span>
              </dd>
              {isBroadcast && (
                <>
                  <dt className="text-muted-foreground">Penerima</dt>
                  <dd className="flex min-w-0 items-center gap-1.5 font-medium">
                    <Users className="size-3.5 shrink-0 text-brand-blue" />
                    <span className="truncate">
                      {bc ? `${bc.recipients.toLocaleString("id-ID")} kontak opt-in` : "…"}
                      {summary.tags.length > 0 && <span className="text-muted-foreground"> · #{summary.tags.join(", #")}</span>}
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Kirim</dt>
                  <dd className="flex min-w-0 items-center gap-1.5 font-medium">
                    <CalendarClock className="size-3.5 shrink-0 text-violet-600" />
                    <span className="truncate">{bc?.sent && !bc.pending ? "Sudah terkirim" : when}</span>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Langkah</dt>
              <dd className="font-medium">
                {summary.steps} langkah{summary.aiNodes > 0 && <span className="text-muted-foreground"> · {summary.aiNodes} AI</span>}
              </dd>
            </dl>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Status setelah disimpan">
              {[
                isBroadcast
                  ? { value: true, icon: Megaphone, title: summary.scheduleAt ? "Jadwalkan" : "Kirim", desc: summary.scheduleAt ? "Terkirim sesuai jadwal" : "Mulai kirim sebentar lagi" }
                  : { value: true, icon: Rocket, title: "Aktifkan", desc: "Langsung membalas pelanggan" },
                { value: false, icon: FileClock, title: "Simpan draft", desc: "Belum dipakai, bisa diedit" },
              ].map((o) => (
                <button
                  key={o.title}
                  type="button"
                  role="radio"
                  aria-checked={activate === o.value}
                  onClick={() => setActivate(o.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                    activate === o.value
                      ? o.value
                        ? "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-500/10 dark:bg-emerald-500/10"
                        : "border-brand-blue bg-blue-50 ring-4 ring-brand-blue/10 dark:bg-blue-500/10"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <o.icon className={cn("size-4", activate === o.value ? (o.value ? "text-emerald-600" : "text-brand-blue") : "text-muted-foreground")} />
                  <span className="text-sm font-semibold">{o.title}</span>
                  <span className="text-xs text-muted-foreground">{o.desc}</span>
                </button>
              ))}
            </div>

            {isBroadcast && activate && bc?.sent && !bc.pending && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Broadcast ini sudah dikirim ({bc.sent.sent.toLocaleString("id-ID")}/{bc.sent.total.toLocaleString("id-ID")} kontak). Menyimpan tidak
                  mengirim ulang — perubahan langkah berlaku untuk balasan berikutnya. Untuk kirim lagi, buat flow broadcast baru.
                </span>
              </div>
            )}
            {isBroadcast && activate && bc?.recipients === 0 && !bc.sent && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Belum ada kontak opt-in yang cocok. Broadcast tetap dijadwalkan dan dikirim ke kontak yang cocok saat waktunya tiba.
              </div>
            )}
            {isBroadcast && !activate && bc?.pending && (
              <p className="text-xs text-muted-foreground">Menyimpan sebagai draft membatalkan jadwal broadcast yang belum terkirim.</p>
            )}

            {!isBroadcast && activate && clashes === null && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Mengecek flow lain yang aktif…
              </p>
            )}
            {!isBroadcast && activate && clashes && clashes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-3.5" /> Pemicu bentrok dengan flow aktif
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {clashes.map((c) => (
                    <li key={c.name}>
                      <b>{c.name}</b> {c.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5">Pelanggan hanya akan masuk ke salah satu flow. Ubah keyword atau nonaktifkan flow lain.</p>
              </div>
            )}

            <AlertDialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="size-4" /> Batal
              </Button>
              <Button onClick={run} className={cn(activate && "bg-emerald-600 hover:bg-emerald-600/90")}>
                {activate ? isBroadcast ? <Megaphone className="size-4" /> : <Rocket className="size-4" /> : <Save className="size-4" />}
                {activate ? (isBroadcast ? (bc?.sent && !bc.pending ? "Simpan" : summary.scheduleAt ? "Simpan & jadwalkan" : "Simpan & kirim") : "Simpan & aktifkan") : "Simpan draft"}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader className="items-center text-center sm:text-center">
              <span
                className={cn(
                  "mb-1 grid size-14 place-items-center rounded-full transition-colors",
                  phase === "done" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
                  phase === "error" && "bg-red-100 text-red-600 dark:bg-red-500/15",
                  phase === "saving" && "bg-blue-50 text-brand-blue dark:bg-blue-500/15",
                )}
              >
                {phase === "done" ? (
                  <CheckCircle2 className="size-7" />
                ) : phase === "error" ? (
                  <XCircle className="size-7" />
                ) : (
                  <Loader2 className="size-7 animate-spin" />
                )}
              </span>
              <AlertDialogTitle>
                {phase === "done" ? (activate ? "Flow aktif!" : "Draft tersimpan") : phase === "error" ? "Gagal menyimpan" : activate ? "Mengaktifkan flow…" : "Menyimpan draft…"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {phase === "done"
                  ? doneText
                  : phase === "error"
                    ? error
                    : "Mohon tunggu, jangan tutup halaman ini."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ol className="mx-auto w-full max-w-xs rounded-xl border border-border bg-muted/30 px-3.5 py-2">
              {labels.map((l, i) => (
                <StepRow key={l} label={l} state={steps[i]} />
              ))}
            </ol>

            {phase === "error" && (
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  <X className="size-4" /> Tutup
                </Button>
                <Button onClick={run}>
                  <Save className="size-4" /> Coba lagi
                </Button>
              </AlertDialogFooter>
            )}
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
