import { Plug, Settings2, MessageSquareReply } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

const STEPS = [
  {
    icon: <Plug className="size-6" />,
    title: "Hubungkan Channel",
    description:
      "Sambungkan WhatsApp, Instagram, Facebook, dan Telegram dalam hitungan menit lewat panduan onboarding.",
  },
  {
    icon: <Settings2 className="size-6" />,
    title: "Atur AI & Flow",
    description:
      "Isi basis pengetahuan produk, tentukan nada bicara AI Agent, dan rancang flow otomatisasi sesuai kebutuhan.",
  },
  {
    icon: <MessageSquareReply className="size-6" />,
    title: "Balas Otomatis",
    description:
      "Biarkan AI menjawab pertanyaan umum dan mengkualifikasi lead. Agen manusia masuk hanya saat dibutuhkan.",
  },
];

export function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 border-y border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Cara Kerja"
          title="Siap dalam 3 langkah sederhana"
          description="Tanpa perlu tim IT. Anda bisa langsung melayani pelanggan di hari yang sama."
        />
        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1} className="group relative text-center">
              <div className="relative mx-auto inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-background text-brand-blue shadow-sm transition-transform duration-300 group-hover:-translate-y-1 dark:text-brand-light">
                {s.icon}
                <span className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white shadow-md ring-4 ring-card/40 dark:bg-brand-blue">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {s.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
