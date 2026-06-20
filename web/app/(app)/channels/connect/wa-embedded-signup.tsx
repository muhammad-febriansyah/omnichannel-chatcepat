"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { Loader2, ShieldCheck, MessageCircle } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { connectWhatsAppEmbedded } from "@/lib/actions";
import { ChannelIcon } from "@/components/app/channel-icon";

// FB JS SDK global (di-load via next/script).
declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (resp: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_WA_CONFIG_ID ?? "";

export function WaEmbeddedSignup() {
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [pending, start] = useTransition();
  // sessionInfo (waba_id, phone_number_id) datang via window 'message' event, terpisah dari code.
  const session = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  // Init FB SDK setelah script load.
  const initSdk = useCallback(() => {
    if (!window.FB || !APP_ID) return;
    window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
    setReady(true);
  }, []);

  useEffect(() => {
    window.fbAsyncInit = initSdk;
    // SDK mungkin sudah ter-load (navigasi balik) → init di microtask agar tak setState
    // sinkron di dalam body effect.
    if (window.FB) queueMicrotask(initSdk);
  }, [initSdk]);

  // Tangkap sessionInfo dari Embedded Signup (FINISH = sukses, CANCEL/ERROR = batal).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH") {
          session.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        } else if (data.event === "CANCEL" || data.event === "ERROR") {
          session.current = {};
        }
      } catch {
        /* pesan non-JSON dari FB → abaikan */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function launch() {
    if (!window.FB || !ready) {
      gooeyToast.error("SDK Facebook belum siap, tunggu sebentar");
      return;
    }
    if (!CONFIG_ID) {
      gooeyToast.error("Konfigurasi WhatsApp belum di-set (NEXT_PUBLIC_WA_CONFIG_ID)");
      return;
    }
    setLaunching(true);
    session.current = {};
    window.FB.login(
      (resp) => {
        setLaunching(false);
        const code = resp?.authResponse?.code;
        const { wabaId, phoneNumberId } = session.current;
        if (!code) {
          gooeyToast.error("Login WhatsApp dibatalkan");
          return;
        }
        if (!wabaId || !phoneNumberId) {
          gooeyToast.error("Nomor/WABA belum terpilih. Ulangi dan selesaikan langkahnya.");
          return;
        }
        start(async () => {
          try {
            await connectWhatsAppEmbedded({ code, wabaId, phoneNumberId });
            gooeyToast.success("WhatsApp terhubung");
            window.location.href = "/channels?connected=1";
          } catch (e) {
            gooeyToast.error(e instanceof Error ? e.message : "Gagal menghubungkan WhatsApp");
          }
        });
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  const busy = launching || pending;
  const steps = [
    "Klik tombol, login & pilih nomor WhatsApp Business",
    "Konfirmasi akun & beri izin ChatCepat",
    "Selesai — pesan masuk langsung ke inbox",
  ];

  return (
    <div className="space-y-4">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={initSdk}
      />

      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {i + 1}
            </span>
            <span className="leading-snug text-muted-foreground">{s}</span>
          </li>
        ))}
      </ol>

      <button
        onClick={launch}
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#25d366] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ebe5b] active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ChannelIcon type="wa_official" className="size-5" />}
        {busy ? "Menghubungkan…" : "Hubungkan WhatsApp"}
      </button>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-snug text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>Resmi via Meta WhatsApp Cloud API. Butuh akun WhatsApp Business & metode pembayaran aktif di Meta.</span>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageCircle className="size-3" />
        Gratis menerima & membalas pesan dalam 24 jam. Kirim template berbayar.
      </div>
    </div>
  );
}
