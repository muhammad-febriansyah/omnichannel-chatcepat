// Presentational chart + brand helpers matching web/chatcepat/dashboard template.
// Pure (no hooks) — safe in server components.
import { cleanIDR } from "@/lib/format";

export type ChannelKey = "whatsapp" | "instagram" | "messenger" | "telegram";

export const CHANNELS: Record<ChannelKey, { color: string; name: string; svg: React.ReactNode }> = {
  whatsapp: {
    color: "#25D366",
    name: "WhatsApp",
    svg: (
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path
          fill="#fff"
          d="M22.6 9.4A9 9 0 0 0 8.2 20.2l-1.2 4.5 4.6-1.2a9 9 0 0 0 4.3 1.1h0a9 9 0 0 0 6.7-15.2zm-2.6 8.1c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1c-.1.2-.6.7-.7.9s-.3.1-.5 0a6.1 6.1 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c2.4 1 2.5.7 3 .7a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3z"
        />
      </svg>
    ),
  },
  instagram: {
    color: "#DD2A7B",
    name: "Instagram",
    svg: (
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id="ig-ch" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#FCB045" />
            <stop offset=".5" stopColor="#FD1D1D" />
            <stop offset="1" stopColor="#833AB4" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#ig-ch)" />
        <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="20.6" cy="11.4" r="1" fill="#fff" />
      </svg>
    ),
  },
  messenger: {
    color: "#0084FF",
    name: "Messenger",
    svg: (
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#0084FF" />
        <path
          fill="#fff"
          d="M16 7C10.5 7 6 11 6 16c0 2.7 1.4 5.1 3.6 6.8V26l3.3-1.8c.9.3 1.9.4 3 .4 5.5 0 10-4 10-9s-4.4-9-9.9-9zm1 12.1-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z"
        />
      </svg>
    ),
  },
  telegram: {
    color: "#0088CC",
    name: "Telegram",
    svg: (
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#0088CC" />
        <path
          fill="#fff"
          d="m23.5 9.6-2.7 12.7c-.2.9-.7 1.1-1.5.7L15 19.6l-2 2c-.2.2-.4.4-.8.4l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L9.3 16.9l-3.9-1.2c-.8-.3-.9-.8.2-1.2L22.4 8.5c.7-.3 1.3.2 1.1 1.1z"
        />
      </svg>
    ),
  },
};

export function ChannelLogo({ ch, size = 16 }: { ch: ChannelKey; size?: number }) {
  return (
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      {CHANNELS[ch].svg}
    </span>
  );
}

/* Crescent-moon brand mark + wordmark */
export function CCLogo({
  variant = "dark",
  size = 32,
  withWordmark = true,
  wordmark,
}: {
  variant?: "white" | "dark";
  size?: number;
  withWordmark?: boolean;
  wordmark?: string; // override teks brand (nama tenant); kosong = "ChatCepat" platform
}) {
  const moon = variant === "white" ? "#FFFFFF" : "#1E2A78";
  const accent = variant === "white" ? "#60A5FA" : "#3B82F6";
  const word = variant === "white" ? "#FFFFFF" : "#1E2A78";
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path d="M 36 24 A 12 12 0 1 1 24 12 A 9 9 0 1 0 36 24 Z" fill={moon} />
        <circle cx="32" cy="14" r="5" fill={accent} />
        <circle cx="30" cy="14" r="1" fill={moon} />
        <circle cx="32" cy="14" r="1" fill={moon} />
        <circle cx="34" cy="14" r="1" fill={moon} />
      </svg>
      {withWordmark && (
        <span className="font-bold tracking-tight" style={{ fontSize: size * 0.5, color: word }}>
          {wordmark ? (
            wordmark
          ) : (
            <>
              Chat<span style={{ color: accent }}>Cepat</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/* Mini area sparkline */
export function Sparkline({
  data,
  color = "#3B82F6",
  w = 80,
  h = 28,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  const id = `sg-${color.replace("#", "")}-${data.join("")}`.replace(/\W/g, "");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Bar chart: message volume per channel */
export function ChannelVolumeChart({ data }: { data: { ch: ChannelKey; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  const yTicks = 5;
  const step = Math.ceil(max / yTicks / 500) * 500;
  const yMax = step * yTicks || 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:px-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">Volume Pesan per Channel</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">7 hari terakhir</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
          7 Hari
        </span>
      </div>
      <div className="grid h-60 grid-cols-[56px_1fr] gap-3">
        <div className="flex flex-col justify-between pr-1 text-right text-[11px] font-medium text-muted-foreground">
          {Array.from({ length: yTicks + 1 }).map((_, i) => (
            <span key={i}>{cleanIDR(yMax - i * step)}</span>
          ))}
        </div>
        <div className="relative">
          {Array.from({ length: yTicks + 1 }).map((_, i) => (
            <span
              key={i}
              className="absolute inset-x-0 h-px bg-border"
              style={{ top: `${(i / yTicks) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around px-2 pb-7">
            {data.map((d) => {
              const ch = CHANNELS[d.ch];
              const pct = (d.value / yMax) * 100;
              return (
                <div
                  key={d.ch}
                  className="group relative flex h-full max-w-[84px] flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <div className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-navy px-2 py-0.5 text-[11px] font-semibold text-white group-hover:block">
                    {cleanIDR(d.value)}
                  </div>
                  <div
                    className="w-14 rounded-t-lg transition group-hover:-translate-y-0.5 group-hover:brightness-110"
                    style={{ height: `${pct}%`, background: `linear-gradient(180deg, ${ch.color}, ${ch.color}CC)` }}
                  />
                  <div className="absolute -bottom-7 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    <ChannelLogo ch={d.ch} size={16} /> <span>{ch.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Donut: channel distribution */
export function ChannelDonut({ data }: { data: { ch: ChannelKey; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  // Precompute cumulative offset per slice (no mutation during render).
  const segments = data.map((d, i) => {
    const len = (d.value / total) * C;
    const offset = data.slice(0, i).reduce((a, b) => a + (b.value / total) * C, 0);
    return { ...d, len, offset };
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:px-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Distribusi Channel</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Total {cleanIDR(total)} pesan</p>
      </div>
      <div className="flex items-center gap-6">
        <svg width="180" height="180" viewBox="0 0 200 200" aria-hidden="true" className="shrink-0">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#F1F5F9" strokeWidth="22" />
          {segments.map((d) => (
            <circle
              key={d.ch}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={CHANNELS[d.ch].color}
              strokeWidth="22"
              strokeDasharray={`${d.len} ${C - d.len}`}
              strokeDashoffset={-d.offset}
              transform="rotate(-90 100 100)"
            />
          ))}
          <text x="100" y="96" textAnchor="middle" fontSize="14" fill="#64748B" fontWeight="500">
            Total
          </text>
          <text x="100" y="118" textAnchor="middle" fontSize="22" fill="#1E2A78" fontWeight="700">
            {cleanIDR(total)}
          </text>
        </svg>
        <ul className="flex-1 space-y-2.5">
          {data.map((d) => (
            <li key={d.ch} className="grid grid-cols-[22px_1fr_auto_auto] items-center gap-2.5 text-[13px]">
              <ChannelLogo ch={d.ch} size={16} />
              <span className="font-medium text-foreground">{CHANNELS[d.ch].name}</span>
              <span className="text-[12.5px] font-medium text-muted-foreground">{cleanIDR(d.value)}</span>
              <span className="min-w-[38px] rounded-md bg-muted px-1.5 py-0.5 text-center text-[12.5px] font-bold text-foreground">
                {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
