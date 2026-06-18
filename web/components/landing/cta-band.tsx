import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function CtaBand() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-brand-navy px-6 py-14 text-center shadow-xl sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(50% 60% at 20% 10%, rgba(96,165,250,0.35), transparent 60%), radial-gradient(50% 60% at 90% 90%, rgba(59,130,246,0.30), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Mulai layani pelanggan lebih cepat hari ini
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80">
              Satukan semua channel, aktifkan AI Agent, dan biarkan ChatCepat membantu tim Anda
              menutup lebih banyak penjualan.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-white/90 sm:w-auto"
              >
                Coba Gratis <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Masuk ke Akun
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
