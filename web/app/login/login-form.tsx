"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Check, AlertCircle, Inbox, Users, Zap } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { login } from "@/lib/actions";
import { BrandShowcase } from "@/components/auth/showcase";
import { BrandLogo } from "@/components/app/brand-logo";

const TX = {
  ID: {
    headline: "Satu Inbox untuk Semua Pelanggan",
    sub: "Kelola WhatsApp, Instagram, Facebook, dan Telegram dari satu platform yang mudah digunakan.",
    f1: "Multi-channel messaging",
    f2: "Tim kolaborasi real-time",
    f3: "Otomasi & chatbot",
    trust: "Dipercaya oleh 1.000+ UMKM Indonesia",
    welcome: "Selamat Datang Kembali ",
    wsub: "Masuk ke akun ChatCepat Anda",
    email: "Email",
    emailPh: "nama@email.com",
    password: "Password",
    pwPh: "Masukkan password Anda",
    forgot: "Lupa password?",
    remember: "Ingat saya selama 30 hari",
    submit: "Masuk",
    or: "atau lanjutkan dengan",
    google: "Masuk dengan Google",
    noAccount: "Belum punya akun?",
    signup: "Daftar gratis",
    errEmail: "Mohon masukkan email yang valid",
    errPw: "Password minimal 6 karakter",
  },
  EN: {
    headline: "One Inbox for All Your Customers",
    sub: "Manage WhatsApp, Instagram, Facebook, and Telegram from one easy-to-use platform.",
    f1: "Multi-channel messaging",
    f2: "Real-time team collaboration",
    f3: "Automation & chatbot",
    trust: "Trusted by 1,000+ Indonesian SMBs",
    welcome: "Welcome Back ",
    wsub: "Sign in to your ChatCepat account",
    email: "Email",
    emailPh: "name@email.com",
    password: "Password",
    pwPh: "Enter your password",
    forgot: "Forgot password?",
    remember: "Remember me for 30 days",
    submit: "Sign In",
    or: "or continue with",
    google: "Sign in with Google",
    noAccount: "Don't have an account?",
    signup: "Sign up free",
    errEmail: "Please enter a valid email",
    errPw: "Password must be at least 6 characters",
  },
} as const;

export default function LoginForm({ logoUrl, siteName }: { logoUrl?: string | null; siteName?: string | null }) {
  const [lang, setLang] = useState<"ID" | "EN">("ID");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [shake, setShake] = useState(false);
  const [pending, start] = useTransition();
  const t = TX[lang];

  function validate() {
    const e: { email?: string; password?: string } = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t.errEmail;
    if (!pw || pw.length < 6) e.password = t.errPw;
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    start(async () => {
      try {
        await login(email, pw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal masuk";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  const features = [
    { icon: <Inbox className="size-4" strokeWidth={2.4} />, label: t.f1 },
    { icon: <Users className="size-4" strokeWidth={2.4} />, label: t.f2 },
    { icon: <Zap className="size-4" strokeWidth={2.4} />, label: t.f3 },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[60fr_40fr]">
      <BrandShowcase
        headline={t.headline}
        sub={t.sub}
        features={features}
        trust={t.trust}
        logoUrl={logoUrl}
        siteName={siteName}
      />

      {/* ====== RIGHT — Form pane ====== */}
      <section className="relative grid place-items-center bg-card">
        {/* lang switcher */}
        <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1">
          {(["ID", "EN"] as const).map((l, i) => (
            <span key={l} className="inline-flex items-center">
              {i === 1 && <span className="px-0.5 text-border">/</span>}
              <button
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors ${
                  lang === l ? "bg-brand-navy text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            </span>
          ))}
        </div>

        {/* mobile gradient header */}
        <div className="flex w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-brand-navy)_0%,var(--color-brand-blue)_60%,var(--color-brand-light)_100%)] px-6 py-8 lg:hidden">
          <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="white" size={36} />
        </div>

        <form
          onSubmit={submit}
          noValidate
          className={`w-full max-w-[400px] p-7 sm:p-10 lg:p-0 ${shake ? "animate-shake" : ""}`}
        >
          <div className="mb-6 hidden lg:block">
            <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="dark" size={40} withWordmark={false} />
          </div>

          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
            {t.welcome}
            <span className="inline-block origin-[70%_70%] animate-wave">👋</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.wsub}</p>

          {/* Email */}
          <div className="mt-8">
            <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-foreground">
              {t.email}
            </label>
            <div
              className={`group relative flex items-center rounded-[10px] border-[1.5px] bg-card transition-shadow ${
                errors.email
                  ? "border-danger shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                  : "border-border hover:border-muted-foreground/40 focus-within:border-brand-blue focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
              }`}
            >
              <Mail className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t.emailPh}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
                }}
                aria-invalid={!!errors.email}
                className="h-12 flex-1 rounded-[10px] bg-transparent pl-11 pr-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            {errors.email && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mt-[18px]">
            <label htmlFor="password" className="mb-2 block text-[13px] font-medium text-foreground">
              {t.password}
            </label>
            <div
              className={`group relative flex items-center rounded-[10px] border-[1.5px] bg-card transition-shadow ${
                errors.password
                  ? "border-danger shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                  : "border-border hover:border-muted-foreground/40 focus-within:border-brand-blue focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
              }`}
            >
              <Lock className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" />
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t.pwPh}
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
                }}
                aria-invalid={!!errors.password}
                className="h-12 flex-1 rounded-[10px] bg-transparent pl-11 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-2 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
            {errors.password ? (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {errors.password}
              </p>
            ) : (
              <div className="mt-2 text-right">
                <span className="cursor-pointer text-[13px] font-medium text-brand-blue hover:underline">
                  {t.forgot}
                </span>
              </div>
            )}
          </div>

          {/* Remember */}
          <label className="mt-4 flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="peer absolute size-0 opacity-0"
            />
            <span className="grid size-[18px] shrink-0 place-items-center rounded-md border-[1.5px] border-muted-foreground/40 bg-card transition-colors peer-checked:border-brand-blue peer-checked:bg-brand-blue peer-focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.3)]">
              <Check className="size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} />
            </span>
            {t.remember}
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,var(--color-brand-navy)_0%,var(--color-brand-blue)_100%)] text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(59,130,246,0.28)] transition hover:-translate-y-px hover:shadow-[0_14px_26px_rgba(59,130,246,0.34)] active:translate-y-0 disabled:cursor-progress disabled:opacity-90"
          >
            {pending ? (
              <span className="size-[18px] animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
            ) : (
              t.submit
            )}
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.noAccount}{" "}
            <Link href="/register" className="font-semibold text-brand-blue hover:underline">
              {t.signup}
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
