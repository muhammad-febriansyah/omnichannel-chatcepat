"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Smartphone,
  MoreVertical,
  Link2,
  ScanLine,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { attachWaDevice } from "@/lib/actions";

type State = "connecting" | "qr" | "paired" | "error";

const STEPS = [
  { icon: Smartphone, title: "Buka WhatsApp di HP", desc: "Gunakan nomor yang ingin disambungkan ke ChatCepat." },
  { icon: MoreVertical, title: "Menu → Perangkat Tertaut", desc: "Ketuk titik tiga (Android) atau Setelan (iPhone), lalu pilih Perangkat Tertaut." },
  { icon: Link2, title: "Tautkan Perangkat", desc: "Ketuk tombol “Tautkan Perangkat”. Kamera HP akan terbuka." },
  { icon: ScanLine, title: "Scan QR di samping", desc: "Arahkan kamera ke QR. Sesi tersambung otomatis setelah scan berhasil." },
];

export function Pairing({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("connecting");
  const [qr, setQr] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/channels/${channelId}/pair`);

    es.addEventListener("qr", (e) => {
      setQr((e as MessageEvent).data);
      setState("qr");
    });

    es.addEventListener("paired", (e) => {
      es.close();
      setState("paired");
      const jid = (e as MessageEvent).data;
      attachWaDevice(channelId, jid)
        .then(() => {
          gooeyToast.success("WhatsApp tersambung");
          router.push("/channels");
        })
        .catch(() => {
          setErr("Gagal menyimpan device. Coba ulangi pairing.");
          setState("error");
        });
    });

    // Menangkap event `error` dari server (data terisi) maupun putus koneksi native.
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      es.close();
      setErr(data || "Koneksi pairing terputus. Coba lagi.");
      setState("error");
    });

    return () => es.close();
  }, [channelId, router]);

  return (
    <div className="w-full p-6 sm:p-8">
      <Link
        href="/channels"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Channel
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Smartphone className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pairing WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sambungkan nomor WhatsApp ke ChatCepat dengan memindai QR. Ikuti langkah di bawah.
          </p>
        </div>
      </div>

      {/* Konten: tutorial (kiri) + QR (kanan) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tutorial bernomor */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cara menyambungkan</h2>
          <ol className="mt-5 space-y-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue">
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Icon className="size-4 text-muted-foreground" /> {s.title}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Aman: ChatCepat hanya menautkan perangkat seperti WhatsApp Web. Kami tidak menyimpan password atau PIN kamu.
            </span>
          </div>
        </div>

        {/* Panel QR / status */}
        <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-card p-6 sm:p-8">
          {state === "connecting" && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-9 animate-spin text-brand-blue" />
              <span className="text-sm font-medium">Menyiapkan sesi…</span>
              <span className="text-xs text-muted-foreground/70">Tunggu beberapa detik</span>
            </div>
          )}

          {state === "qr" && (
            <div className="flex flex-col items-center gap-5">
              <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-border">
                <QRCode value={qr} size={232} />
              </div>
              <div className="flex items-center gap-2 rounded-full bg-brand-blue/10 px-3 py-1.5 text-xs font-medium text-brand-blue">
                <ScanLine className="size-3.5" /> Siap dipindai — QR berganti otomatis sebelum kedaluwarsa
              </div>
            </div>
          )}

          {state === "paired" && (
            <div className="flex flex-col items-center gap-3 text-emerald-600">
              <CheckCircle2 className="size-10" />
              <span className="text-base font-semibold">Tersambung!</span>
              <span className="text-sm text-muted-foreground">Mengalihkan ke daftar channel…</span>
            </div>
          )}

          {state === "error" && (
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-danger dark:bg-red-500/10">
                <AlertCircle className="size-6" />
              </span>
              <span className="text-sm font-medium text-foreground">{err}</span>
              <button
                onClick={() => location.reload()}
                className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <RefreshCw className="size-4" /> Coba lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
