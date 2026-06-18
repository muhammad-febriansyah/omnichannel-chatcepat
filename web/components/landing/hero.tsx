"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, Check, Star, Zap } from "lucide-react";
import { ChannelLogo, type ChannelKey } from "@/components/app/charts";

const TABS: { ch: ChannelKey; label: string }[] = [
  { ch: "whatsapp", label: "WhatsApp" },
  { ch: "instagram", label: "Instagram" },
  { ch: "messenger", label: "Messenger" },
  { ch: "telegram", label: "Telegram" },
];

// Channel orbs yang "mengalir" masuk ke satu inbox — metafora omnichannel.
const ORBS: { ch: ChannelKey; pos: string; delay: number }[] = [
  { ch: "whatsapp", pos: "-left-5 top-6", delay: 0 },
  { ch: "instagram", pos: "-right-6 top-24", delay: 0.4 },
  { ch: "messenger", pos: "-left-7 bottom-28", delay: 0.8 },
  { ch: "telegram", pos: "-right-4 bottom-10", delay: 1.2 },
];

const ease = [0.21, 0.47, 0.32, 0.98] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const float = reduce
    ? {}
    : { animate: { y: [0, -8, 0] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <section className="relative overflow-hidden">
      {/* ambient gradient blobs + grid — vibe terang lembut */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] size-[520px] rounded-full bg-brand-blue/15 blur-[120px]" />
        <div className="absolute left-[-10%] top-40 size-[420px] rounded-full bg-violet-400/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,42,120,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,42,120,0.04)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:pb-28">
        {/* LEFT — copy */}
        <div className="min-w-0 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            AI Sales Agent · Official Partner Meta
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease }}
            className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Semua channel chat,{" "}
            <span className="bg-gradient-to-r from-brand-navy via-brand-blue to-brand-light bg-clip-text text-transparent">
              satu inbox
            </span>
            , dibalas{" "}
            <span className="bg-gradient-to-r from-brand-navy via-brand-blue to-brand-light bg-clip-text text-transparent">
              AI Agent
            </span>{" "}
            otomatis.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
          >
            WhatsApp, Instagram, Facebook &amp; Telegram dalam satu layar. AI Agent paham produk
            Anda dan menutup penjualan 24 jam — tim lebih ringan, respons lebih cepat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
          >
            <Link
              href="/login"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-navy/25 transition hover:bg-brand-navy/90 sm:w-auto"
            >
              Coba Gratis
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#cara-kerja"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted sm:w-auto"
            >
              Lihat Cara Kerja
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:justify-start"
          >
            {["Tanpa kartu kredit", "Setup 5 menit", "Patuh consent"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-500" /> {t}
              </span>
            ))}
          </motion.div>

          {/* social proof */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <div className="flex -space-x-2.5">
              {["DA", "SR", "MF", "NK", "YP"].map((n, i) => (
                <span
                  key={n}
                  className="inline-flex size-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-brand-navy to-brand-blue text-[10px] font-bold text-white shadow-sm"
                  style={{ zIndex: 5 - i }}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="text-center sm:text-left">
              <span className="flex items-center justify-center gap-0.5 sm:justify-start">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">500+ bisnis</span> mempercayakan chat-nya
              </span>
            </div>
          </motion.div>
        </div>

        {/* RIGHT — product chat mockup */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease }}
          className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none"
        >
          {/* glow di belakang kartu */}
          <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-blue/20 via-violet-400/10 to-emerald-400/15 blur-2xl" />

          {/* floating channel orbs — semua channel mengalir ke satu inbox */}
          {ORBS.map((o) => (
            <motion.div
              key={o.ch}
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + o.delay * 0.2, ease }}
              className={`absolute ${o.pos} z-10 hidden lg:block`}
            >
              <motion.span
                {...float}
                transition={{ ...(float.transition ?? {}), delay: o.delay }}
                className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card shadow-xl ring-1 ring-black/5"
              >
                <ChannelLogo ch={o.ch} size={24} />
              </motion.span>
            </motion.div>
          ))}

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
            {/* tabs channel */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/40 px-3 py-2.5">
              {TABS.map((t, i) => (
                <span
                  key={t.ch}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    i === 0 ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground"
                  }`}
                >
                  <ChannelLogo ch={t.ch} size={14} /> {t.label}
                </span>
              ))}
            </div>

            {/* chat thread — staggered reveal */}
            <div className="space-y-3 bg-background/40 p-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-bold text-white">
                    BS
                  </span>
                  Budi Santoso
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> AI aktif
                </span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7, ease }}
                className="max-w-[82%] rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm"
              >
                Halo, masih ready stok yang warna navy? 🙏
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.95, ease }}
                className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-gradient-to-br from-brand-blue to-brand-light px-3.5 py-2 text-sm text-white shadow-md"
              >
                <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                  <Bot className="size-3" /> AI Agent
                </span>
                Halo Kak Budi! Navy masih ready 12 pcs. Mau dikirim ke alamat yang sama? 😊
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.2, ease }}
                className="max-w-[70%] rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm"
              >
                Iya kak, langsung order 2 ya
              </motion.div>

              {/* AI typing indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.45 }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-2xl rounded-br-sm bg-muted px-3 py-2.5"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-muted-foreground/60"
                    animate={reduce ? {} : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* floating stat badge — auto-reply */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="absolute -bottom-5 -left-4 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl sm:flex"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Bot className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-foreground">92%</span>
              <span className="block text-[11px] text-muted-foreground">balasan otomatis</span>
            </span>
          </motion.div>

          {/* floating stat badge — response time */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="absolute -right-4 -top-5 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl sm:flex"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-blue/15 text-brand-blue">
              <Zap className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-foreground">&lt; 3 dtk</span>
              <span className="block text-[11px] text-muted-foreground">rata-rata balas</span>
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
