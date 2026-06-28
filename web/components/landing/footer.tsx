import Link from "next/link";
import { AtSign, Send, Mail } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produk",
    links: [
      { label: "Fitur", href: "#fitur" },
      { label: "Cara Kerja", href: "#cara-kerja" },
      { label: "Harga", href: "#harga" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Tentang Kami", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Karier", href: "/careers" },
      { label: "Kontak", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Kebijakan Privasi", href: "/privacy" },
      { label: "Syarat & Ketentuan", href: "/terms" },
      { label: "Kebijakan Cookie", href: "/cookies" },
    ],
  },
];

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com", icon: AtSign },
  { label: "Telegram", href: "https://telegram.org", icon: Send },
  { label: "Email", href: "mailto:halo@chatcepat.id", icon: Mail },
];

export function Footer({ logoUrl, siteName }: { logoUrl?: string | null; siteName?: string | null }) {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="dark" size={30} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Platform omnichannel chat dan AI sales untuk bisnis Indonesia. Satu inbox, balasan
              otomatis, penjualan lebih cepat.
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">© 2026 ChatCepat. Semua hak dilindungi.</p>
          <p className="text-xs text-muted-foreground">Dibuat untuk bisnis Indonesia.</p>
        </div>
      </div>
    </footer>
  );
}
