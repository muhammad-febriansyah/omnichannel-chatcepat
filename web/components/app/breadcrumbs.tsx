"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";

// Label per segment route. Segmen tak dikenal: id (uuid/angka) → "Detail", lainnya Title Case.
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inbox: "Inbox",
  contacts: "Kontak",
  broadcasts: "Broadcast",
  templates: "Template Pesan",
  flows: "Otomasi",
  "ai-agent": "AI Agent",
  reports: "Laporan",
  channels: "Channel",
  tags: "Tag & Label",
  settings: "Pengaturan",
  users: "Tim",
  "business-hours": "Jam Operasional",
  web: "Website",
  new: "Baru",
  edit: "Edit",
  delete: "Hapus",
  connect: "Hubungkan",
  pair: "Pairing",
  import: "Impor",
  acquire: "Akuisisi",
};

function labelFor(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  if (/^[0-9a-f]{8}-/i.test(seg) || /^\d+$/.test(seg) || seg.length >= 16) return "Detail";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelFor(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-6 py-2.5 text-[13px]"
    >
      <Link
        href="/dashboard"
        className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Beranda"
      >
        <Home className="size-3.5" />
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-muted-foreground/40" />
          {c.last ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link href={c.href} className="text-muted-foreground transition-colors hover:text-foreground">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
