import { Inbox, Bot, Workflow, Megaphone, BarChart3, Users, ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  accent: string; // top accent bar + glow tint
  highlights: string[];
};

const FEATURES: Feature[] = [
  {
    title: "Inbox Omnichannel",
    description: "WhatsApp, Instagram, Facebook, dan Telegram dalam satu kotak masuk.",
    icon: <Inbox className="size-5" />,
    iconColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    accent: "from-emerald-400 to-teal-400",
    highlights: ["Satu antrian untuk semua channel", "Tidak perlu pindah aplikasi"],
  },
  {
    title: "AI Agent + RAG",
    description: "Agen AI yang membaca basis pengetahuan produk Anda dan menjawab akurat, 24 jam.",
    icon: <Bot className="size-5" />,
    iconColor: "bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-violet-500/20",
    accent: "from-violet-400 to-indigo-400",
    highlights: ["Jawaban dari knowledge base", "Eskalasi mulus ke agen"],
  },
  {
    title: "Flow Otomasi",
    description: "Rancang alur percakapan tanpa coding, dari salam otomatis hingga eskalasi.",
    icon: <Workflow className="size-5" />,
    iconColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/20",
    accent: "from-sky-400 to-blue-400",
    highlights: ["Builder visual drag-and-drop", "Kualifikasi lead otomatis"],
  },
  {
    title: "Broadcast Patuh Consent",
    description: "Kirim kampanye ke kontak yang sudah opt-in dengan personalisasi penuh.",
    icon: <Megaphone className="size-5" />,
    iconColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    accent: "from-amber-400 to-orange-400",
    highlights: ["Penjadwalan & pelacakan", "Hanya kontak opt-in"],
  },
  {
    title: "Analitik Real-time",
    description: "Pantau volume pesan, waktu respons, dan performa channel secara langsung.",
    icon: <BarChart3 className="size-5" />,
    iconColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/20",
    accent: "from-rose-400 to-pink-400",
    highlights: ["Dasbor jelas & langsung", "Metrik per channel"],
  },
  {
    title: "Multi-tenant & Tim",
    description: "Kelola banyak akun, peran, dan izin dengan isolasi data per tenant.",
    icon: <Users className="size-5" />,
    iconColor: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20",
    accent: "from-cyan-400 to-emerald-400",
    highlights: ["Role & izin granular", "Aman untuk agency"],
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
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 0.06}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-7 transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl"
            >
              {/* top accent bar */}
              <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-70", f.accent)} />

              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-2xl shadow-sm ring-1",
                    f.iconColor,
                  )}
                >
                  {f.icon}
                </div>
                <ArrowUpRight className="size-5 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </div>

              <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>

              <ul className="mt-5 space-y-2 border-t border-border/60 pt-4">
                {f.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check className="size-4 shrink-0 text-emerald-500" />
                    {h}
                  </li>
                ))}
              </ul>

              {/* glow lembut saat hover */}
              <div
                className={cn(
                  "pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-20",
                  f.accent,
                )}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
