"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { unstable_rethrow } from "next/navigation";
import { Loader2, ShieldCheck, MessageCircle, KeyRound } from "lucide-react";
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
const GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v23.0";

// Event FINISH (sessionInfo) bisa tiba sesudah callback FB.login → tunggu sebentar.
async function waitForSession(
  ref: { current: { wabaId?: string; phoneNumberId?: string } },
  ms = 4000,
): Promise<{ wabaId?: string; phoneNumberId?: string }> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (ref.current.wabaId && ref.current.phoneNumberId) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return ref.current;
}

export function WaEmbeddedSignup() {
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [pending, start] = useTransition();
  // PIN verifikasi dua langkah (6 digit). Wajib bila nomor belum ter-register di Cloud API.
  const [pin, setPin] = useState("");
  // sessionInfo (waba_id, phone_number_id) datang via window 'message' event, terpisah dari code.
  const session = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  // Init FB SDK setelah script load.
  const initSdk = useCallback(() => {
    if (!window.FB || !APP_ID) return;
    window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
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
    if (pin && !/^\d{6}$/.test(pin)) {
      gooeyToast.error("PIN harus 6 digit angka");
      return;
    }
    setLaunching(true);
    session.current = {};
    window.FB.login(
      (resp) => {
        setLaunching(false);
        const code = resp?.authResponse?.code;
        if (!code) {
          gooeyToast.error("Login WhatsApp dibatalkan");
          return;
        }
        start(async () => {
          const { wabaId, phoneNumberId } = await waitForSession(session);
          if (!wabaId || !phoneNumberId) {
            gooeyToast.error("Nomor/WABA belum terpilih. Ulangi dan selesaikan langkahnya.");
            return;
          }
          try {
            await connectWhatsAppEmbedded({ code, wabaId, phoneNumberId, pin: pin || undefined });
            gooeyToast.success("WhatsApp terhubung");
            window.location.href = "/channels?connected=1";
          } catch (e) {
            // redirect() (mis. dari requireSession) melempar NEXT_REDIRECT → biar Next handle.
            unstable_rethrow(e);
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

      <div>
        <label htmlFor="wa-pin" className="mb-1.5 block text-sm font-medium">
          PIN verifikasi dua langkah <span className="text-muted-foreground">(untuk nomor baru)</span>
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="wa-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="6 digit"
            className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 font-mono text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Nomor yang belum aktif di Cloud API akan didaftarkan dengan PIN ini. Kalau nomor sudah punya PIN, isi PIN yang sama.
        </p>
      </div>

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
