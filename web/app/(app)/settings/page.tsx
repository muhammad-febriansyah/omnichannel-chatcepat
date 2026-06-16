import Link from "next/link";
import { Clock, UserCog, Plug, Tag, Sparkles, ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/settings/business-hours", icon: Clock, title: "Jam Kerja", desc: "Jam operasional & pesan out-of-office", tone: "#3b82f6" },
  { href: "/settings/users", icon: UserCog, title: "Tim", desc: "Kelola anggota tim & role", tone: "#8b5cf6" },
  { href: "/channels", icon: Plug, title: "Channel", desc: "Hubungkan & kelola channel chat", tone: "#10b981" },
  { href: "/tags", icon: Tag, title: "Tag & Label", desc: "Segmentasi kontak", tone: "#f59e0b" },
  { href: "/ai-agent", icon: Sparkles, title: "AI Agent", desc: "Persona & knowledge base", tone: "#ec4899" },
];

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi workspace kamu.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-brand-blue/40 hover:shadow-sm"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${it.tone}1a`, color: it.tone }}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{it.title}</div>
                <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
