"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">{q}</span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Pertanyaan yang sering diajukan" />
        <Reveal className="mt-10">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
