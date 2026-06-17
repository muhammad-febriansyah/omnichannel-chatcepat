"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { attachWaDevice } from "@/lib/actions";

type State = "connecting" | "qr" | "paired" | "error";

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
    <div className="mx-auto max-w-md p-6">
      <Link
        href="/channels"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Pairing WhatsApp</h1>
      <p className="text-sm text-muted-foreground">
        Buka WhatsApp di HP → Perangkat Tertaut → Tautkan perangkat, lalu scan QR di bawah.
      </p>

      <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
        {state === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <span className="text-sm">Menyiapkan sesi…</span>
          </div>
        )}

        {state === "qr" && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg bg-white p-4">
              <QRCode value={qr} size={220} />
            </div>
            <p className="text-xs text-muted-foreground">
              QR berganti otomatis sebelum kedaluwarsa.
            </p>
          </div>
        )}

        {state === "paired" && (
          <div className="flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 className="size-8" />
            <span className="text-sm">Tersambung! Mengalihkan…</span>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 text-center text-red-600">
            <AlertCircle className="size-8" />
            <span className="text-sm">{err}</span>
            <button
              onClick={() => location.reload()}
              className="mt-1 h-9 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Coba lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
