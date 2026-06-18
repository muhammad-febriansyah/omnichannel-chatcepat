import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

const ROWS: { label: string; manual: boolean; chatcepat: boolean }[] = [
  { label: "Semua channel dalam satu inbox", manual: false, chatcepat: true },
  { label: "Balasan otomatis 24 jam (AI Agent)", manual: false, chatcepat: true },
  { label: "Respons di bawah 3 detik", manual: false, chatcepat: true },
  { label: "Flow otomatisasi tanpa coding", manual: false, chatcepat: true },
  { label: "Broadcast patuh consent + pelacakan", manual: false, chatcepat: true },
  { label: "Analitik & laporan real-time", manual: false, chatcepat: true },
  { label: "Isolasi data per tenant & izin granular", manual: false, chatcepat: true },
  { label: "Skalabel saat chat melonjak", manual: false, chatcepat: true },
];

function Cell({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      <Check className="size-4" strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
      <X className="size-4" strokeWidth={3} />
    </span>
  );
}

export function Comparison() {
  return (
    <section className="scroll-mt-24 border-y border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Perbandingan"
          title="ChatCepat vs cara manual"
          description="Lihat bedanya mengelola chat dengan tim manual versus platform omnichannel + AI."
        />

        <Reveal className="mt-12 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* header */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border bg-muted/40 px-5 py-4 sm:px-7">
            <span className="text-sm font-semibold text-foreground">Kapabilitas</span>
            <span className="w-20 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:w-28">
              CS Manual
            </span>
            <span className="w-20 text-center text-xs font-semibold uppercase tracking-wider text-brand-blue sm:w-28">
              ChatCepat
            </span>
          </div>

          {ROWS.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-0 sm:px-7"
            >
              <span className="text-sm text-foreground">{r.label}</span>
              <span className="flex w-20 justify-center sm:w-28">
                <Cell ok={r.manual} />
              </span>
              <span className="flex w-20 justify-center sm:w-28">
                <Cell ok={r.chatcepat} />
              </span>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-navy/25 transition hover:bg-brand-navy/90 sm:w-auto"
          >
            Beralih ke ChatCepat
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="text-xs text-muted-foreground">Gratis dicoba · tanpa kartu kredit</span>
        </Reveal>
      </div>
    </section>
  );
}
