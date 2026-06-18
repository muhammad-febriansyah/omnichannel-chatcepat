import { Store, ShoppingBag, Sparkles, Briefcase, Coffee, Sofa, Gem, Smartphone } from "lucide-react";
import { ChannelLogo, type ChannelKey } from "@/components/app/charts";
import { LogoMarquee, type MarqueeLogo } from "@/components/ui/aceternity/logo-marquee";
import { Reveal } from "./reveal";

const CHANNELS: { ch: ChannelKey; label: string }[] = [
  { ch: "whatsapp", label: "WhatsApp" },
  { ch: "instagram", label: "Instagram" },
  { ch: "messenger", label: "Messenger" },
  { ch: "telegram", label: "Telegram" },
];

// Wordmark pelanggan (placeholder) — tukar dengan logo asli saat tersedia.
const BRANDS: MarqueeLogo[] = [
  { name: "Batik Nusantara", icon: <Gem className="size-4 text-rose-500" /> },
  { name: "GadgetKita", icon: <Smartphone className="size-4 text-sky-500" /> },
  { name: "Skincare Lokal", icon: <Sparkles className="size-4 text-violet-500" /> },
  { name: "Digital Partner ID", icon: <Briefcase className="size-4 text-indigo-500" /> },
  { name: "Kopi Senja", icon: <Coffee className="size-4 text-amber-600" /> },
  { name: "FurnitureHub", icon: <Sofa className="size-4 text-emerald-600" /> },
  { name: "Toko Makmur", icon: <Store className="size-4 text-cyan-600" /> },
  { name: "Pasar Online", icon: <ShoppingBag className="size-4 text-orange-500" /> },
];

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Satu platform untuk semua channel chat favorit pelanggan Anda
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {CHANNELS.map(({ ch, label }) => (
              <div
                key={ch}
                className="inline-flex items-center gap-2.5 text-sm font-semibold text-foreground"
              >
                <ChannelLogo ch={ch} size={26} />
                {label}
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Logo wall pelanggan — marquee tak terbatas */}
      <Reveal className="border-t border-border py-8">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Dipercaya 500+ bisnis yang tumbuh bersama ChatCepat
        </p>
        <LogoMarquee items={BRANDS} speed="normal" />
      </Reveal>
    </section>
  );
}
