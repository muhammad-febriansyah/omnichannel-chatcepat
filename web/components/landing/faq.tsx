import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

const FAQS = [
  {
    q: "Channel apa saja yang didukung ChatCepat?",
    a: "ChatCepat mendukung WhatsApp, Instagram, Facebook Messenger, dan Telegram dalam satu inbox terpadu. Semua percakapan dari channel ini bisa Anda kelola dari satu layar.",
  },
  {
    q: "Bagaimana cara kerja AI Agent-nya?",
    a: "AI Agent membaca basis pengetahuan produk Anda (teknologi RAG) lalu menjawab pertanyaan pelanggan secara akurat dan otomatis. Anda bisa mengatur nada bicara dan kapan AI harus mengoper percakapan ke agen manusia.",
  },
  {
    q: "Apakah ada paket gratis untuk mencoba?",
    a: "Ya, Anda bisa mulai mencoba ChatCepat secara gratis tanpa perlu kartu kredit. Naikkan ke paket berbayar kapan saja saat bisnis Anda membutuhkan kuota dan fitur lebih.",
  },
  {
    q: "Apakah data pelanggan saya aman?",
    a: "Keamanan dan isolasi data adalah prioritas kami. Setiap akun memiliki isolasi data per tenant, kredensial channel disimpan terenkripsi, dan akses diatur lewat peran serta izin yang granular.",
  },
  {
    q: "Apakah broadcast saya berisiko membuat nomor diblokir?",
    a: "Kami menerapkan kebijakan broadcast yang patuh consent: pesan hanya dapat dikirim ke kontak yang sudah opt-in. Ini menjaga reputasi nomor Anda sekaligus mematuhi aturan platform.",
  },
  {
    q: "Berapa lama proses setup awal?",
    a: "Sebagian besar bisnis bisa terhubung dan mulai melayani pelanggan di hari yang sama. Panduan onboarding kami memandu Anda menyambungkan channel dan mengatur AI tanpa perlu tim IT.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Pertanyaan yang sering diajukan" />
        <Reveal className="mt-10">
          <Accordion
            multiple={false}
            className="overflow-hidden rounded-3xl border border-border bg-card/60 px-5 shadow-sm sm:px-7"
          >
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="gap-4 py-5 text-sm font-semibold text-foreground hover:no-underline sm:text-base">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pr-8 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
