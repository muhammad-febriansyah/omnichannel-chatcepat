import { Inbox, Bot, Workflow, Megaphone, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
  grad: string; // gradient pastel (light + dark-safe)
  iconColor: string;
  span?: string;
};

const FEATURES: Feature[] = [
  {
    title: "Inbox Omnichannel",
    description:
      "WhatsApp, Instagram, Facebook, dan Telegram dalam satu kotak masuk. Tim Anda tidak perlu lagi buka banyak aplikasi.",
    icon: <Inbox className="size-5" />,
    grad: "from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10",
    iconColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    span: "lg:col-span-2",
  },
  {
    title: "AI Agent + RAG",
    description: "Agen AI yang membaca basis pengetahuan produk Anda dan menjawab pelanggan secara akurat, 24 jam.",
    icon: <Bot className="size-5" />,
    grad: "from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10",
    iconColor: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    title: "Flow Otomasi",
    description: "Rancang alur percakapan tanpa coding: salam otomatis, kualifikasi lead, hingga eskalasi ke agen.",
    icon: <Workflow className="size-5" />,
    grad: "from-sky-50 to-blue-50 dark:from-sky-500/10 dark:to-blue-500/10",
    iconColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    title: "Broadcast Patuh Consent",
    description: "Kirim kampanye ke kontak yang sudah opt-in dengan personalisasi, penjadwalan, dan pelacakan.",
    icon: <Megaphone className="size-5" />,
    grad: "from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10",
    iconColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Analitik Real-time",
    description: "Pantau volume pesan, waktu respons, dan performa channel lewat dasbor yang jelas dan langsung.",
    icon: <BarChart3 className="size-5" />,
    grad: "from-rose-50 to-pink-50 dark:from-rose-500/10 dark:to-pink-500/10",
    iconColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    span: "lg:col-span-2",
  },
  {
    title: "Multi-tenant & Tim",
    description: "Kelola banyak akun, peran, dan izin dengan isolasi data per tenant. Aman untuk agency & tim besar.",
    icon: <Users className="size-5" />,
    grad: "from-cyan-50 to-emerald-50 dark:from-cyan-500/10 dark:to-emerald-500/10",
    iconColor: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
];

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Fitur"
          title="Semua yang Anda butuhkan untuk melayani & berjualan"
          description="Dari inbox terpadu sampai AI yang menutup penjualan — ChatCepat menyatukannya dalam satu platform."
        />
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 0.06}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl",
                f.grad,
                f.span,
              )}
            >
              <div className={cn("inline-flex size-11 items-center justify-center rounded-2xl shadow-sm", f.iconColor)}>
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{f.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              {/* glow lembut saat hover */}
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/40 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-white/5" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
