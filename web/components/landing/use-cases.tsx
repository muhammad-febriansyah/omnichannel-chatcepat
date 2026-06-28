import { ShoppingBag, UtensilsCrossed, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type UseCase = {
  icon: React.ReactNode;
  tone: string;
  industry: string;
  title: string;
  description: string;
  points: string[];
};

const CASES: UseCase[] = [
  {
    icon: <ShoppingBag className="size-5" />,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    industry: "E-commerce & Retail",
    title: "Jawab stok & ongkir otomatis, dorong checkout",
    description: "AI Agent menjawab pertanyaan produk, cek ketersediaan, dan arahkan pelanggan ke pembelian — 24 jam.",
    points: ["Cek stok & varian instan", "Konfirmasi order via chat", "Broadcast promo patuh consent"],
  },
  {
    icon: <UtensilsCrossed className="size-5" />,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    industry: "F&B & Kuliner",
    title: "Terima pesanan & reservasi tanpa antre balas",
    description: "Kelola order delivery, reservasi meja, dan pertanyaan menu dari semua channel dalam satu inbox.",
    points: ["Menu & harga otomatis", "Konfirmasi reservasi", "Reminder jam buka"],
  },
  {
    icon: <Briefcase className="size-5" />,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    industry: "Jasa & Klinik",
    title: "Kualifikasi lead & atur jadwal lebih cepat",
    description: "Flow otomatis menyaring kebutuhan calon klien lalu mengoper ke agen yang tepat saat dibutuhkan.",
    points: ["Kualifikasi lead otomatis", "Handover ke agen ahli", "Tindak lanjut terjadwal"],
  },
  {
    icon: <Building2 className="size-5" />,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    industry: "Agency & Tim Besar",
    title: "Kelola banyak brand dari satu dasbor",
    description: "Isolasi data per tenant, peran & izin granular, dan analitik per channel untuk tiap klien.",
    points: ["Multi-tenant aman", "Peran & izin granular", "Laporan per klien"],
  },
];

export function UseCases() {
  return (
    <section className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Use Case"
          title="Cocok untuk model bisnis Anda"
          description="Dari toko online sampai agency — ChatCepat menyesuaikan alur percakapan dengan cara Anda berjualan."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {CASES.map((c, i) => (
            <Reveal
              key={c.industry}
              delay={i * 0.06}
              className="group flex flex-col rounded-3xl border border-border bg-card p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex size-11 items-center justify-center rounded-2xl shadow-sm", c.tone)}>
                  {c.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.industry}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {c.points.map((p) => (
                  <li
                    key={p}
                    className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
