/* Shared brand visuals for auth pages (login + register). */
import { BrandLogo } from "@/components/app/brand-logo";

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

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5c-.5.4 6.2-4.5 6.2-15.1 0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const AVATARS = [
  { c: "#fbbf24", l: "A" },
  { c: "#f472b6", l: "B" },
  { c: "#34d399", l: "S" },
  { c: "#a78bfa", l: "D" },
  { c: "#fb7185", l: "R" },
];

const BUBBLES = [
  "left-[6%] top-[18%] h-[50px] w-[72px] [--r:-8deg] [animation-duration:8s]",
  "left-[14%] top-[70%] h-[40px] w-[56px] [--r:6deg] [animation-direction:reverse] [animation-duration:9s]",
  "right-[12%] top-[12%] h-[60px] w-[88px] [--r:10deg] [animation-duration:10s]",
  "right-[22%] top-[78%] h-[44px] w-[60px] [--r:-12deg] [animation-direction:reverse] [animation-duration:11s]",
];

/* Left brand pane shared by login + register. */
export function BrandShowcase({
  headline,
  sub,
  features,
  trust,
  logoUrl,
  siteName,
}: {
  headline: string;
  sub: string;
  features: { icon: React.ReactNode; label: string }[];
  trust: string;
  logoUrl?: string | null;
  siteName?: string | null;
}) {
  return (
    <aside className="relative hidden flex-col overflow-hidden p-12 text-white lg:grid lg:grid-rows-[auto_1fr_auto] bg-[linear-gradient(135deg,var(--color-brand-navy)_0%,var(--color-brand-blue)_50%,var(--color-brand-light)_100%)]">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4),transparent_70%)] blur-[60px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.45),transparent_70%)] blur-[60px]" />
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className={`pointer-events-none absolute z-[2] animate-drift rounded-[28px_28px_28px_6px] border border-white/12 bg-white/8 backdrop-blur-md ${b}`}
        />
      ))}

      <div className="relative z-[3]">
        <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="white" size={40} />
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

        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight">{headline}</h1>
        <p className="mt-3.5 max-w-[440px] text-pretty text-base leading-relaxed text-white/80">{sub}</p>

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
        <span>{trust}</span>
      </div>
    </aside>
  );
}
