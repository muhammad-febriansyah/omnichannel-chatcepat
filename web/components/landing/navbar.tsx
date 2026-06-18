"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/app/brand-logo";
import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
} from "@/components/ui/aceternity/resizable-navbar";

const NAV_ITEMS = [
  { name: "Fitur", link: "#fitur" },
  { name: "Cara Kerja", link: "#cara-kerja" },
  { name: "Harga", link: "#harga" },
  { name: "FAQ", link: "#faq" },
];

export function Navbar({ logoUrl, siteName }: { logoUrl?: string | null; siteName?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <ResizableNavbar>
      {/* Desktop */}
      <NavBody>
        <Link href="/" aria-label="ChatCepat beranda" className="relative z-20 shrink-0">
          <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="dark" size={28} />
        </Link>
        <NavItems items={NAV_ITEMS} />
        <div className="relative z-20 flex items-center gap-2">
          <Link href="/login" className="px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-brand-blue">
            Masuk
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-navy"
          >
            Coba Gratis
          </Link>
        </div>
      </NavBody>

      {/* Mobile */}
      <MobileNav>
        <MobileNavHeader>
          <Link href="/" aria-label="ChatCepat beranda" className="shrink-0">
            <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="dark" size={26} />
          </Link>
          <MobileNavToggle isOpen={open} onClick={() => setOpen((v) => !v)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {NAV_ITEMS.map((it) => (
            <a
              key={it.link}
              href={it.link}
              onClick={() => setOpen(false)}
              className="w-full rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {it.name}
            </a>
          ))}
          <div className="flex w-full gap-3 pt-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground"
            >
              Masuk
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full bg-brand-blue px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Coba Gratis
            </Link>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </ResizableNavbar>
  );
}
