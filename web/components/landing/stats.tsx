"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Building2, MessagesSquare, Bot, Timer } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type Stat = {
  icon: React.ReactNode;
  prefix?: string;
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
  hint: string;
};

const STATS: Stat[] = [
  { icon: <Building2 className="size-5" />, value: 500, suffix: "+", label: "Bisnis aktif", hint: "Tumbuh tiap bulan" },
  { icon: <MessagesSquare className="size-5" />, value: 1.2, decimals: 1, suffix: "jt+", label: "Pesan / bulan", hint: "Diproses otomatis" },
  { icon: <Bot className="size-5" />, value: 92, suffix: "%", label: "Balasan otomatis", hint: "Tanpa campur tangan" },
  { icon: <Timer className="size-5" />, prefix: "<", value: 3, suffix: " dtk", label: "Rata-rata balas", hint: "Respons real-time" },
];

function Counter({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    let started: number | null = null;
    const dur = 1500;
    const tick = (t: number) => {
      if (started === null) started = t;
      const p = Math.min((t - started) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  const display = n.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="relative py-16 sm:py-24">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/10 blur-[120px] dark:bg-brand-blue/15" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Statistik"
          title="Angka yang berbicara sendiri"
          description="Performa nyata dari bisnis yang melayani pelanggan lewat ChatCepat."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card/80 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-blue/40 hover:shadow-lg hover:shadow-brand-blue/10 sm:p-8">
                {/* hover sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue/15 to-brand-light/10 text-brand-blue ring-1 ring-inset ring-brand-blue/10 transition-transform duration-300 group-hover:scale-110 dark:text-brand-light">
                  {s.icon}
                </span>
                <span className="mt-4 block bg-gradient-to-br from-brand-navy to-brand-blue bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-brand-light sm:text-5xl">
                  <Counter to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
                </span>
                <span className="mt-2 block text-sm font-semibold text-foreground">{s.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{s.hint}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
