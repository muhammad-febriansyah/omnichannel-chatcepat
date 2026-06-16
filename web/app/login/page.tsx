"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, MessageSquare, Check } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // TODO(08): auth nyata (JWT httpOnly cookie). Sekarang dev → langsung masuk.
    gooeyToast.success("Selamat datang!");
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand showcase */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-navy to-brand-blue p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <MessageSquare className="size-5" />
          </div>
          <span className="text-lg font-bold">ChatCepat</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Satu inbox untuk semua channel chat bisnis.
          </h1>
          <p className="mt-3 max-w-md text-white/80">
            WhatsApp, Instagram, Messenger, Telegram — dengan AI sales agent & broadcast yang patuh aturan.
          </p>
          <ul className="mt-6 space-y-2.5">
            {["Balas otomatis cerdas (AI agent)", "Broadcast compliant (opt-in wajib)", "Kolaborasi tim real-time"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                    <Check className="size-3" />
                  </span>
                  {f}
                </li>
              ),
            )}
          </ul>
        </div>
        <p className="text-sm text-white/60">Dipercaya 1.000+ UMKM Indonesia</p>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-white">
                <MessageSquare className="size-5" />
              </div>
              <span className="text-lg font-bold">ChatCepat</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold">Masuk 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">Masuk ke workspace kamu.</p>

          <label className="mt-6 block text-sm font-medium">Email</label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@bisnis.com"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
          </div>

          <label className="mt-4 block text-sm font-medium">Password</label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-10 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <button
            type="submit"
            className="mt-6 h-11 w-full rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-sm font-semibold text-white transition hover:opacity-95"
          >
            Masuk
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Belum punya akun? <span className="font-medium text-brand-blue">Daftar gratis</span>
          </p>
        </form>
      </div>
    </div>
  );
}
