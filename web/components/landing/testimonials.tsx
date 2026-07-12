import { InfiniteMovingCards, type MovingCard } from "@/components/ui/aceternity/infinite-moving-cards";
import { SectionHeading } from "./section-heading";

const TESTIMONIALS: MovingCard[] = [
  {
    quote:
      "Sejak pakai ChatCepat, balasan ke pelanggan WhatsApp jadi instan. Omzet toko online kami naik hampir 30% dalam dua bulan.",
    name: "Sari Wijaya",
    title: "Owner, Batik Nusantara",
  },
  {
    quote:
      "AI Agent-nya betul-betul paham produk kami. Pertanyaan stok dan ongkir terjawab otomatis, tim CS bisa fokus ke closing.",
    name: "Andi Pratama",
    title: "Head of Sales, GadgetKita",
  },
  {
    quote:
      "Dulu DM Instagram dan WhatsApp kami berantakan. Sekarang semua masuk satu inbox dan tidak ada chat yang terlewat lagi.",
    name: "Maya Kusuma",
    title: "Founder, Skincare Lokal",
  },
  {
    quote:
      "Sebagai agency, fitur multi-tenant sangat membantu. Kami kelola belasan klien dari satu dasbor dengan data yang rapi.",
    name: "Reza Mahendra",
    title: "Direktur, Digital Partner ID",
  },
  {
    quote:
      "Broadcast yang patuh consent bikin kami tenang. Kampanye promo tetap efektif tanpa khawatir nomor diblokir.",
    name: "Putri Anjani",
    title: "Marketing Lead, Kopi Senja",
  },
  {
    quote:
      "Setup-nya cepat, dalam sehari sudah jalan. Analitik waktu respons membantu kami memperbaiki layanan tiap minggu.",
    name: "Bagus Setiawan",
    title: "Operations, FurnitureHub",
  },
];

export function Testimonials() {
  return (
    <section className="border-y border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Testimoni"
          title="Dipercaya bisnis yang ingin tumbuh lebih cepat"
        />
      </div>
      <div className="mt-12">
        <InfiniteMovingCards items={TESTIMONIALS} direction="left" speed="slow" />
      </div>
    </section>
  );
}
