"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Building2, MessagesSquare, Bot, Timer } from "lucide-react";
import { Reveal } from "./reveal";

type Stat = {
  icon: React.ReactNode;
  prefix?: string;
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
};

const STATS: Stat[] = [
  { icon: <Building2 className="size-5" />, value: 500, suffix: "+", label: "Bisnis aktif" },
  { icon: <MessagesSquare className="size-5" />, value: 1.2, decimals: 1, suffix: "jt+", label: "Pesan / bulan" },
  { icon: <Bot className="size-5" />, value: 92, suffix: "%", label: "Balasan otomatis" },
  { icon: <Timer className="size-5" />, prefix: "<", value: 3, suffix: " dtk", label: "Rata-rata balas" },
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
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 bg-card px-4 py-8 text-center sm:py-10">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue dark:text-brand-light">
                {s.icon}
              </span>
              <span className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <Counter to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
              </span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
