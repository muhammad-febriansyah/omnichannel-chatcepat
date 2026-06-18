"use client";

import { useState, useTransition } from "react";
import { Mail, Lock, Eye, EyeOff, Check, AlertCircle, Inbox, Users, Zap } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { login } from "@/lib/actions";

/* ---------- Brand mark (crescent moon + wordmark) ---------- */
function ChatCepatLogo({
  variant = "white",
  size = 40,
  withWordmark = true,
}: {
  variant?: "white" | "dark";
  size?: number;
  withWordmark?: boolean;
}) {
  const moonColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  const accent = variant === "white" ? "#60A5FA" : "#3B82F6";
  const wordColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path d="M 36 24 A 12 12 0 1 1 24 12 A 9 9 0 1 0 36 24 Z" fill={moonColor} />
        <circle cx="32" cy="14" r="5" fill={accent} />
        <circle cx="30" cy="14" r="1" fill={moonColor} />
        <circle cx="32" cy="14" r="1" fill={moonColor} />
        <circle cx="34" cy="14" r="1" fill={moonColor} />
      </svg>
      {withWordmark && (
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: size * 0.5, color: wordColor }}
        >
          Chat<span style={{ color: accent }}>Cepat</span>
        </span>
      )}
    </span>
  );
}

/* ---------- Crescent moon mascot ---------- */
function Mascot({ size = 180 }: { size?: number }) {
  return (
    <div className="size-full animate-float [filter:drop-shadow(0_18px_30px_rgba(11,22,72,0.35))]" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 200 200">
        <defs>
          <radialGradient id="moonBody" cx="0.35" cy="0.35" r="0.85">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#F4F8FF" />
            <stop offset="1" stopColor="#C7D6FF" />
          </radialGradient>
          <radialGradient id="bubbleFill" cx="0.3" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#60A5FA" />
            <stop offset="1" stopColor="#3B82F6" />
          </radialGradient>
          <filter id="moonShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0b1648" floodOpacity="0.35" />
          </filter>
        </defs>
        <g filter="url(#moonShadow)">
          <path
            d="M 145 100 A 55 55 0 1 1 90 45 A 42 42 0 1 0 145 100 Z"
            fill="url(#moonBody)"
            stroke="#B8C8F0"
            strokeWidth="1"
          />
        </g>
        <ellipse cx="78" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65" />
        <ellipse cx="120" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65" />
        <g fill="#1E2A78">
          <ellipse cx="86" cy="98" rx="3.2" ry="4.2" />
          <ellipse cx="112" cy="98" rx="3.2" ry="4.2" />
          <circle cx="87.2" cy="96.5" r="1.1" fill="#fff" />
          <circle cx="113.2" cy="96.5" r="1.1" fill="#fff" />
        </g>
        <path d="M 90 118 Q 99 126 108 118" fill="none" stroke="#1E2A78" strokeWidth="2.4" strokeLinecap="round" />
        <g transform="translate(132 50)">
          <path
            d="M 0 14 Q 0 0 14 0 L 42 0 Q 56 0 56 14 L 56 28 Q 56 42 42 42 L 22 42 L 12 52 L 14 42 Q 0 40 0 28 Z"
            fill="url(#bubbleFill)"
            stroke="#1E2A78"
            strokeOpacity="0.15"
          />
          <circle cx="16" cy="21" r="3" fill="#fff" />
          <circle cx="28" cy="21" r="3" fill="#fff" />
          <circle cx="40" cy="21" r="3" fill="#fff" />
        </g>
        <g fill="#FFD66B">
          <path d="M40 60 l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z" />
          <circle cx="30" cy="140" r="2" />
          <circle cx="170" cy="160" r="1.6" />
        </g>
      </svg>
    </div>
  );
}

/* ---------- Channel logos ---------- */
const ChannelLogos: Record<string, React.ReactNode> = {
  whatsapp: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M22.6 9.4A9 9 0 0 0 8.2 20.2l-1.2 4.5 4.6-1.2a9 9 0 0 0 4.3 1.1h0a9 9 0 0 0 6.7-15.2zm-6.7 13.7a7.5 7.5 0 0 1-3.8-1l-.3-.2-2.7.7.7-2.6-.2-.3a7.5 7.5 0 1 1 6.3 3.4zm4.1-5.6c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1c-.1.2-.6.7-.7.9s-.3.1-.5 0a6.1 6.1 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c2.4 1 2.5.7 3 .7a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3z"
      />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <defs>
        <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEDA77" />
          <stop offset=".3" stopColor="#F58529" />
          <stop offset=".6" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ig)" />
      <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="20.6" cy="11.4" r="1" fill="#fff" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1877F2" />
      <path
        fill="#fff"
        d="M18.4 16.7H16v8h-3.4v-8H10.7v-3h1.9v-2.2c0-2.4 1-3.8 3.8-3.8h2.4v3h-1.5c-1 0-1 .4-1 1.2v1.8h2.5l-.4 3z"
      />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#229ED9" />
      <path
        fill="#fff"
        d="m23.5 9.6-2.7 12.7c-.2.9-.7 1.1-1.5.7L15 19.6l-2 2c-.2.2-.4.4-.8.4l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L9.3 16.9l-3.9-1.2c-.8-.3-.9-.8.2-1.2L22.4 8.5c.7-.3 1.3.2 1.1 1.1z"
      />
    </svg>
  ),
};

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5c-.5.4 6.2-4.5 6.2-15.1 0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

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

const AVATARS = [
  { c: "#fbbf24", l: "A" },
  { c: "#f472b6", l: "B" },
  { c: "#34d399", l: "S" },
  { c: "#a78bfa", l: "D" },
  { c: "#fb7185", l: "R" },
];

export default function LoginPage() {
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

  const bubbles = [
    "left-[6%] top-[18%] h-[50px] w-[72px] [--r:-8deg] [animation-duration:8s]",
    "left-[14%] top-[70%] h-[40px] w-[56px] [--r:6deg] [animation-direction:reverse] [animation-duration:9s]",
    "right-[12%] top-[12%] h-[60px] w-[88px] [--r:10deg] [animation-duration:10s]",
    "right-[22%] top-[78%] h-[44px] w-[60px] [--r:-12deg] [animation-direction:reverse] [animation-duration:11s]",
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[60fr_40fr]">
      {/* ====== LEFT — Brand showcase ====== */}
      <aside className="relative hidden flex-col overflow-hidden p-12 text-white lg:grid lg:grid-rows-[auto_1fr_auto] bg-[linear-gradient(135deg,var(--color-brand-navy)_0%,var(--color-brand-blue)_50%,var(--color-brand-light)_100%)]">
        {/* glow orbs */}
        <div className="pointer-events-none absolute -left-32 -top-32 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4),transparent_70%)] blur-[60px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.45),transparent_70%)] blur-[60px]" />
        {/* floating bubbles */}
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={`pointer-events-none absolute z-[2] animate-drift rounded-[28px_28px_28px_6px] border border-white/12 bg-white/8 backdrop-blur-md ${b}`}
          />
        ))}

        <div className="relative z-[3]">
          <ChatCepatLogo variant="white" size={40} />
        </div>

        <div className="relative z-[3] max-w-[480px] self-center justify-self-center">
          <div className="relative mb-7 size-[220px]">
            <Mascot size={180} />
            <span className="absolute -right-2 top-2.5 grid size-11 animate-bob place-items-center rounded-[14px] bg-white/95 shadow-[0_10px_22px_rgba(11,22,72,0.28)]">
              {ChannelLogos.whatsapp}
            </span>
            <span className="absolute -right-7 top-20 grid size-11 animate-bob place-items-center rounded-[14px] bg-white/95 shadow-[0_10px_22px_rgba(11,22,72,0.28)] [animation-delay:0.6s]">
              {ChannelLogos.instagram}
            </span>
            <span className="absolute bottom-6 right-1 grid size-11 animate-bob place-items-center rounded-[14px] bg-white/95 shadow-[0_10px_22px_rgba(11,22,72,0.28)] [animation-delay:1.2s]">
              {ChannelLogos.facebook}
            </span>
            <span className="absolute -left-4 bottom-10 grid size-11 animate-bob place-items-center rounded-[14px] bg-white/95 shadow-[0_10px_22px_rgba(11,22,72,0.28)] [animation-delay:1.8s]">
              {ChannelLogos.telegram}
            </span>
          </div>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight">
            {t.headline}
          </h1>
          <p className="mt-3.5 max-w-[440px] text-pretty text-base leading-relaxed text-white/80">
            {t.sub}
          </p>

          <ul className="mt-7 grid gap-3">
            {features.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-[15px] font-medium text-white/95">
                <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-white/95 text-brand-navy">
                  {f.icon}
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-[3] flex items-center gap-3.5 text-[13px] font-medium text-white/90">
          <div className="flex">
            {AVATARS.map((a, i) => (
              <span
                key={a.l}
                className="grid size-7 place-items-center rounded-full border-2 border-white/90 text-[11px] font-semibold text-white shadow-[0_2px_6px_rgba(11,22,72,0.25)]"
                style={{ background: a.c, marginLeft: i === 0 ? 0 : -8 }}
              >
                {a.l}
              </span>
            ))}
          </div>
          <span>{t.trust}</span>
        </div>
      </aside>

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
          <ChatCepatLogo variant="white" size={36} />
        </div>

        <form
          onSubmit={submit}
          noValidate
          className={`w-full max-w-[400px] p-7 sm:p-10 lg:p-0 ${shake ? "animate-shake" : ""}`}
        >
          <div className="mb-6 hidden lg:block">
            <ChatCepatLogo variant="dark" size={40} withWordmark={false} />
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

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            {t.or}
          </div>

          {/* Google */}
          <button
            type="button"
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-border bg-card text-sm font-semibold text-foreground transition hover:border-brand-blue hover:shadow-[0_6px_16px_rgba(59,130,246,0.12)]"
          >
            <GoogleG /> {t.google}
          </button>

          {/* Demo hint */}
          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
            Demo: <span className="font-medium text-foreground">admin@chatcepat.id</span> /{" "}
            <span className="font-medium text-foreground">admin123</span>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.noAccount}{" "}
            <span className="cursor-pointer font-semibold text-brand-blue hover:underline">{t.signup}</span>
          </p>
        </form>
      </section>
    </div>
  );
}
