/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle */

const { useState, useEffect, useRef } = React;

/* ---------- Icons (Lucide-style, inline SVG) ---------- */
const Icon = ({ d, size = 18, stroke = "currentColor", strokeWidth = 2, fill = "none", children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const MailIcon = (p) => (
  <Icon {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);
const LockIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);
const EyeIcon = (p) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const EyeOffIcon = (p) => (
  <Icon {...p}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </Icon>
);
const CheckIcon = (p) => (<Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>);
const AlertIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </Icon>
);
const ZapIcon = (p) => (<Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>);
const UsersIcon = (p) => (
  <Icon {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
const InboxIcon = (p) => (
  <Icon {...p}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </Icon>
);

/* ---------- Brand bits ---------- */
const GoogleG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5c-.5.4 6.2-4.5 6.2-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

const ChannelLogos = {
  whatsapp: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366"/>
      <path fill="#fff" d="M22.6 9.4A9 9 0 0 0 8.2 20.2l-1.2 4.5 4.6-1.2a9 9 0 0 0 4.3 1.1h0a9 9 0 0 0 6.7-15.2zm-6.7 13.7a7.5 7.5 0 0 1-3.8-1l-.3-.2-2.7.7.7-2.6-.2-.3a7.5 7.5 0 1 1 6.3 3.4zm4.1-5.6c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1c-.1.2-.6.7-.7.9s-.3.1-.5 0a6.1 6.1 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c2.4 1 2.5.7 3 .7a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <defs>
        <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEDA77"/>
          <stop offset=".3" stopColor="#F58529"/>
          <stop offset=".6" stopColor="#DD2A7B"/>
          <stop offset="1" stopColor="#8134AF"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ig)"/>
      <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="16" cy="16" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="20.6" cy="11.4" r="1" fill="#fff"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1877F2"/>
      <path fill="#fff" d="M18.4 16.7H16v8h-3.4v-8H10.7v-3h1.9v-2.2c0-2.4 1-3.8 3.8-3.8h2.4v3h-1.5c-1 0-1 .4-1 1.2v1.8h2.5l-.4 3z"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#229ED9"/>
      <path fill="#fff" d="m23.5 9.6-2.7 12.7c-.2.9-.7 1.1-1.5.7L15 19.6l-2 2c-.2.2-.4.4-.8.4l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L9.3 16.9l-3.9-1.2c-.8-.3-.9-.8.2-1.2L22.4 8.5c.7-.3 1.3.2 1.1 1.1z"/>
    </svg>
  ),
};

/* ---------- Crescent Moon Mascot ---------- */
function Mascot({ size = 180 }) {
  return (
    <div className="mascot-wrap" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 200 200">
        <defs>
          <radialGradient id="moonBody" cx="0.35" cy="0.35" r="0.85">
            <stop offset="0" stopColor="#FFFFFF"/>
            <stop offset="0.55" stopColor="#F4F8FF"/>
            <stop offset="1" stopColor="#C7D6FF"/>
          </radialGradient>
          <radialGradient id="bubbleFill" cx="0.3" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#60A5FA"/>
            <stop offset="1" stopColor="#3B82F6"/>
          </radialGradient>
          <filter id="moonShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0b1648" floodOpacity="0.35"/>
          </filter>
        </defs>

        {/* Crescent body — moon with bite taken out */}
        <g filter="url(#moonShadow)">
          <path
            d="M 145 100
               A 55 55 0 1 1 90 45
               A 42 42 0 1 0 145 100 Z"
            fill="url(#moonBody)"
            stroke="#B8C8F0"
            strokeWidth="1"
          />
        </g>

        {/* Cheeks */}
        <ellipse cx="78" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65"/>
        <ellipse cx="120" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65"/>

        {/* Eyes */}
        <g fill="#1E2A78">
          <ellipse cx="86" cy="98" rx="3.2" ry="4.2"/>
          <ellipse cx="112" cy="98" rx="3.2" ry="4.2"/>
          <circle cx="87.2" cy="96.5" r="1.1" fill="#fff"/>
          <circle cx="113.2" cy="96.5" r="1.1" fill="#fff"/>
        </g>

        {/* Smile */}
        <path d="M 90 118 Q 99 126 108 118" fill="none" stroke="#1E2A78" strokeWidth="2.4" strokeLinecap="round"/>

        {/* Chat bubble held to the side */}
        <g transform="translate(132 50)">
          <path
            d="M 0 14 Q 0 0 14 0 L 42 0 Q 56 0 56 14 L 56 28 Q 56 42 42 42 L 22 42 L 12 52 L 14 42 Q 0 40 0 28 Z"
            fill="url(#bubbleFill)"
            stroke="#1E2A78"
            strokeOpacity="0.15"
          />
          {/* dots */}
          <circle cx="16" cy="21" r="3" fill="#fff"/>
          <circle cx="28" cy="21" r="3" fill="#fff"/>
          <circle cx="40" cy="21" r="3" fill="#fff"/>
        </g>

        {/* Tiny stars */}
        <g fill="#FFD66B">
          <path d="M40 60 l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z"/>
          <circle cx="30" cy="140" r="2"/>
          <circle cx="170" cy="160" r="1.6"/>
        </g>
      </svg>
    </div>
  );
}

/* ---------- Logo ---------- */
function ChatCepatLogo({ variant = "white", size = 36, withWordmark = true }) {
  const moonColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  const accent = variant === "white" ? "#60A5FA" : "#3B82F6";
  const wordColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  return (
    <div className="logo-mark" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M 36 24
             A 12 12 0 1 1 24 12
             A 9 9 0 1 0 36 24 Z"
          fill={moonColor}
        />
        <circle cx="32" cy="14" r="5" fill={accent}/>
        <circle cx="30" cy="14" r="1" fill={moonColor}/>
        <circle cx="32" cy="14" r="1" fill={moonColor}/>
        <circle cx="34" cy="14" r="1" fill={moonColor}/>
      </svg>
      {withWordmark && (
        <span style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: size * 0.5,
          letterSpacing: "-0.02em",
          color: wordColor,
        }}>
          Chat<span style={{ color: accent }}>Cepat</span>
        </span>
      )}
    </div>
  );
}

/* ---------- Brand Showcase (Left side) ---------- */
function BrandShowcase({ gradientStops, lang }) {
  const t = lang === "EN" ? {
    headline: "One Inbox for All Your Customers",
    sub: "Manage WhatsApp, Instagram, Facebook, and Telegram from one easy-to-use platform.",
    f1: "Multi-channel messaging",
    f2: "Real-time team collaboration",
    f3: "Automation & chatbot",
    trust: "Trusted by 1,000+ Indonesian SMBs",
  } : {
    headline: "Satu Inbox untuk Semua Pelanggan",
    sub: "Kelola WhatsApp, Instagram, Facebook, dan Telegram dari satu platform yang mudah digunakan.",
    f1: "Multi-channel messaging",
    f2: "Tim kolaborasi real-time",
    f3: "Otomasi & chatbot",
    trust: "Dipercaya oleh 1.000+ UMKM Indonesia",
  };

  const features = [
    { icon: <InboxIcon size={16} stroke="#1E2A78" strokeWidth={2.4}/>, label: t.f1 },
    { icon: <UsersIcon size={16} stroke="#1E2A78" strokeWidth={2.4}/>, label: t.f2 },
    { icon: <ZapIcon size={16} stroke="#1E2A78" strokeWidth={2.4}/>, label: t.f3 },
  ];

  const avatarColors = ["#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb7185"];

  return (
    <aside className="brand-showcase" style={{
      background: `linear-gradient(135deg, ${gradientStops[0]} 0%, ${gradientStops[1]} 50%, ${gradientStops[2]} 100%)`,
    }}>
      {/* glow orbs */}
      <div className="orb orb-tl" />
      <div className="orb orb-br" />
      {/* floating bubbles */}
      <div className="float-bubble fb1" />
      <div className="float-bubble fb2" />
      <div className="float-bubble fb3" />
      <div className="float-bubble fb4" />

      {/* logo top-left */}
      <div className="brand-logo-top">
        <ChatCepatLogo variant="white" size={40}/>
      </div>

      {/* center content */}
      <div className="brand-center">
        <div className="mascot-stage">
          <Mascot size={180}/>
          {/* orbit chips */}
          <div className="chip chip-wa">{ChannelLogos.whatsapp}</div>
          <div className="chip chip-ig">{ChannelLogos.instagram}</div>
          <div className="chip chip-fb">{ChannelLogos.facebook}</div>
          <div className="chip chip-tg">{ChannelLogos.telegram}</div>
        </div>

        <h1 className="brand-headline">{t.headline}</h1>
        <p className="brand-sub">{t.sub}</p>

        <ul className="feature-list">
          {features.map((f, i) => (
            <li key={i}>
              <span className="feat-tick">{f.icon}</span>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* trust */}
      <div className="trust-row">
        <div className="avatars">
          {avatarColors.map((c, i) => (
            <span key={i} className="avatar" style={{ background: c }}>
              {["A","B","S","D","R"][i]}
            </span>
          ))}
        </div>
        <span className="trust-text">{t.trust}</span>
      </div>
    </aside>
  );
}

/* ---------- Form (Right side) ---------- */
function LoginForm({ lang, setLang, primaryGradient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const formRef = useRef(null);

  const t = lang === "EN" ? {
    welcome: "Welcome Back ",
    sub: "Sign in to your ChatCepat account",
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
    err_email: "Please enter a valid email",
    err_pw: "Password must be at least 6 characters",
    success: "Signed in successfully",
  } : {
    welcome: "Selamat Datang Kembali ",
    sub: "Masuk ke akun ChatCepat Anda",
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
    err_email: "Mohon masukkan email yang valid",
    err_pw: "Password minimal 6 karakter",
    success: "Berhasil masuk",
  };

  function validate() {
    const e = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t.err_email;
    if (!password || password.length < 6) e.password = t.err_pw;
    return e;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setStatus("loading");
    setTimeout(() => {
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1400);
  }

  return (
    <section className="form-pane">
      {/* lang switcher */}
      <div className="lang-switcher" role="tablist" aria-label="Language">
        <button
          role="tab"
          aria-selected={lang === "ID"}
          className={lang === "ID" ? "lang on" : "lang"}
          onClick={() => setLang("ID")}
        >ID</button>
        <span className="lang-sep">/</span>
        <button
          role="tab"
          aria-selected={lang === "EN"}
          className={lang === "EN" ? "lang on" : "lang"}
          onClick={() => setLang("EN")}
        >EN</button>
      </div>

      {/* mobile gradient header */}
      <div className="mobile-brand-header">
        <ChatCepatLogo variant="white" size={36}/>
      </div>

      <form
        ref={formRef}
        className={`login-form ${shake ? "shake" : ""}`}
        onSubmit={onSubmit}
        noValidate
      >
        <div className="form-logo-row">
          <ChatCepatLogo variant="dark" size={40} withWordmark={false}/>
        </div>

        <h2 className="form-title">{t.welcome}<span className="wave">👋</span></h2>
        <p className="form-sub">{t.sub}</p>

        <div className="field-block" style={{ marginTop: 32 }}>
          <label htmlFor="email" className="field-label">{t.email}</label>
          <div className={`input-wrap ${errors.email ? "err" : ""}`}>
            <span className="input-icon left"><MailIcon stroke="#64748B"/></span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t.emailPh}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({...s, email: undefined})); }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-err" : undefined}
            />
          </div>
          {errors.email && (
            <p id="email-err" className="field-error" role="alert">
              <AlertIcon size={14} stroke="#EF4444"/> {errors.email}
            </p>
          )}
        </div>

        <div className="field-block">
          <label htmlFor="password" className="field-label">{t.password}</label>
          <div className={`input-wrap ${errors.password ? "err" : ""}`}>
            <span className="input-icon left"><LockIcon stroke="#64748B"/></span>
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t.pwPh}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(s => ({...s, password: undefined})); }}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "pw-err" : undefined}
            />
            <button
              type="button"
              className="input-icon right pw-toggle"
              onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPw ? <EyeOffIcon stroke="#64748B"/> : <EyeIcon stroke="#64748B"/>}
            </button>
          </div>
          {errors.password ? (
            <p id="pw-err" className="field-error" role="alert">
              <AlertIcon size={14} stroke="#EF4444"/> {errors.password}
            </p>
          ) : (
            <div className="forgot-row">
              <a href="#" className="forgot-link">{t.forgot}</a>
            </div>
          )}
        </div>

        <label className="remember-row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className="checkbox-box" aria-hidden="true">
            <CheckIcon size={12} stroke="#fff" strokeWidth={3}/>
          </span>
          <span className="remember-label">{t.remember}</span>
        </label>

        <button
          type="submit"
          className={`btn-primary ${status === "loading" ? "loading" : ""} ${status === "success" ? "ok" : ""}`}
          style={{ background: status === "success"
            ? "linear-gradient(135deg,#10B981 0%, #34D399 100%)"
            : primaryGradient }}
          disabled={status !== "idle"}
        >
          {status === "loading" && <span className="spinner" aria-hidden="true"/>}
          {status === "success" && <CheckIcon size={20} stroke="#fff" strokeWidth={3}/>}
          {status === "idle" && <span>{t.submit}</span>}
          {status === "success" && <span style={{ marginLeft: 8 }}>{t.success}</span>}
        </button>

        <div className="divider"><span>{t.or}</span></div>

        <button type="button" className="btn-google">
          <GoogleG/> <span>{t.google}</span>
        </button>

        <p className="footer-cta">
          {t.noAccount} <a href="#" className="cta-link">{t.signup}</a>
        </p>
      </form>
    </section>
  );
}

/* ---------- App root ---------- */
function App() {
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "gradient": ["#1E2A78", "#3B82F6", "#60A5FA"],
    "ctaGradient": ["#1E2A78", "#3B82F6"],
    "split": "60-40",
    "showBubbles": true,
    "lang": "ID"
  }/*EDITMODE-END*/);

  const [lang, setLang] = useState(t.lang);
  useEffect(() => { setLang(t.lang); }, [t.lang]);

  const splitVar = t.split === "50-50" ? "1fr 1fr" : "60fr 40fr";

  return (
    <>
      <style>{`
        :root {
          --split-grid: ${splitVar};
          --bubbles: ${t.showBubbles ? 1 : 0};
        }
      `}</style>

      <main className="page" data-screen-label="Login">
        <BrandShowcase
          gradientStops={t.gradient}
          lang={lang}
        />
        <LoginForm
          lang={lang}
          setLang={(l) => { setLang(l); setTweak("lang", l); }}
          primaryGradient={`linear-gradient(135deg, ${t.ctaGradient[0]} 0%, ${t.ctaGradient[1]} 100%)`}
        />
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout">
          <TweakRadio
            label="Split ratio"
            value={t.split}
            onChange={(v) => setTweak("split", v)}
            options={[
              { value: "60-40", label: "60 / 40" },
              { value: "50-50", label: "50 / 50" },
            ]}
          />
          <TweakToggle
            label="Floating chat bubbles"
            value={t.showBubbles}
            onChange={(v) => setTweak("showBubbles", v)}
          />
        </TweakSection>

        <TweakSection title="Brand gradient (left panel)">
          <TweakColor
            label="Palette"
            value={t.gradient}
            onChange={(v) => setTweak("gradient", v)}
            options={[
              ["#1E2A78", "#3B82F6", "#60A5FA"],
              ["#0F172A", "#1E40AF", "#3B82F6"],
              ["#312E81", "#6366F1", "#A78BFA"],
              ["#0E7490", "#0891B2", "#22D3EE"],
            ]}
          />
        </TweakSection>

        <TweakSection title="Primary button">
          <TweakColor
            label="CTA gradient"
            value={t.ctaGradient}
            onChange={(v) => setTweak("ctaGradient", v)}
            options={[
              ["#1E2A78", "#3B82F6"],
              ["#3B82F6", "#60A5FA"],
              ["#1E40AF", "#2563EB"],
              ["#1E2A78", "#1E2A78"],
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
