"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, AlertCircle, User, Building2, Inbox, Bot, ShieldCheck } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { register } from "@/lib/actions";
import { BrandShowcase } from "@/components/auth/showcase";
import { BrandLogo } from "@/components/app/brand-logo";

const TX = {
  ID: {
    headline: "Mulai Layani Pelanggan Hari Ini",
    sub: "Buat akun ChatCepat gratis dan satukan semua channel obrolan bisnis Anda dalam hitungan menit.",
    f1: "Gratis, tanpa kartu kredit",
    f2: "AI agent siap 24 jam",
    f3: "Data aman & terisolasi",
    trust: "Bergabung dengan 1.000+ UMKM Indonesia",
    title: "Buat Akun Gratis ",
    tsub: "Daftar dan mulai dalam hitungan menit",
    business: "Nama Bisnis",
    businessPh: "Toko Maju Jaya",
    name: "Nama Lengkap",
    namePh: "Nama Anda",
    email: "Email",
    emailPh: "nama@email.com",
    password: "Password",
    pwPh: "Minimal 6 karakter",
    submit: "Daftar Sekarang",
    or: "atau daftar dengan",
    google: "Daftar dengan Google",
    haveAccount: "Sudah punya akun?",
    signin: "Masuk",
    errBusiness: "Nama bisnis wajib diisi",
    errName: "Nama lengkap wajib diisi",
    errEmail: "Mohon masukkan email yang valid",
    errPw: "Password minimal 6 karakter",
  },
  EN: {
    headline: "Start Serving Customers Today",
    sub: "Create a free ChatCepat account and unify all your business chat channels in minutes.",
    f1: "Free, no credit card",
    f2: "24/7 AI agent",
    f3: "Secure, isolated data",
    trust: "Join 1,000+ Indonesian SMBs",
    title: "Create Free Account ",
    tsub: "Sign up and get started in minutes",
    business: "Business Name",
    businessPh: "Acme Store",
    name: "Full Name",
    namePh: "Your name",
    email: "Email",
    emailPh: "name@email.com",
    password: "Password",
    pwPh: "At least 6 characters",
    submit: "Sign Up Now",
    or: "or sign up with",
    google: "Sign up with Google",
    haveAccount: "Already have an account?",
    signin: "Sign in",
    errBusiness: "Business name is required",
    errName: "Full name is required",
    errEmail: "Please enter a valid email",
    errPw: "Password must be at least 6 characters",
  },
} as const;

type Errors = { business?: string; name?: string; email?: string; password?: string };

export default function RegisterForm({ logoUrl, siteName }: { logoUrl?: string | null; siteName?: string | null }) {
  const [lang, setLang] = useState<"ID" | "EN">("ID");
  const [show, setShow] = useState(false);
  const [business, setBusiness] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [shake, setShake] = useState(false);
  const [pending, start] = useTransition();
  const t = TX[lang];

  function validate() {
    const e: Errors = {};
    if (!business.trim()) e.business = t.errBusiness;
    if (!name.trim()) e.name = t.errName;
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
        await register({ business, name, email, password: pw });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal mendaftar";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  const features = [
    { icon: <Inbox className="size-4" strokeWidth={2.4} />, label: t.f1 },
    { icon: <Bot className="size-4" strokeWidth={2.4} />, label: t.f2 },
    { icon: <ShieldCheck className="size-4" strokeWidth={2.4} />, label: t.f3 },
  ];

  const fieldWrap = (invalid: boolean) =>
    `group relative flex items-center rounded-[10px] border-[1.5px] bg-card transition-shadow ${
      invalid
        ? "border-danger shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
        : "border-border hover:border-muted-foreground/40 focus-within:border-brand-blue focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
    }`;

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
            {t.title}
            <span className="inline-block origin-[70%_70%] animate-wave">🚀</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.tsub}</p>

          {/* Business name */}
          <div className="mt-7">
            <label htmlFor="business" className="mb-2 block text-[13px] font-medium text-foreground">
              {t.business}
            </label>
            <div className={fieldWrap(!!errors.business)}>
              <Building2 className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" />
              <input
                id="business"
                autoComplete="organization"
                placeholder={t.businessPh}
                value={business}
                onChange={(e) => {
                  setBusiness(e.target.value);
                  if (errors.business) setErrors((s) => ({ ...s, business: undefined }));
                }}
                aria-invalid={!!errors.business}
                className="h-12 flex-1 rounded-[10px] bg-transparent pl-11 pr-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            {errors.business && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {errors.business}
              </p>
            )}
          </div>

          {/* Full name */}
          <div className="mt-[18px]">
            <label htmlFor="name" className="mb-2 block text-[13px] font-medium text-foreground">
              {t.name}
            </label>
            <div className={fieldWrap(!!errors.name)}>
              <User className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" />
              <input
                id="name"
                autoComplete="name"
                placeholder={t.namePh}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((s) => ({ ...s, name: undefined }));
                }}
                aria-invalid={!!errors.name}
                className="h-12 flex-1 rounded-[10px] bg-transparent pl-11 pr-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            {errors.name && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="mt-[18px]">
            <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-foreground">
              {t.email}
            </label>
            <div className={fieldWrap(!!errors.email)}>
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
            <div className={fieldWrap(!!errors.password)}>
              <Lock className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" />
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
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
            {errors.password && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {errors.password}
              </p>
            )}
          </div>

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
            {t.haveAccount}{" "}
            <Link href="/login" className="font-semibold text-brand-blue hover:underline">
              {t.signin}
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
