"use client";

import Link from "next/link";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import {
  Inbox,
  Users,
  Send,
  Workflow,
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Plug,
  UserCog,
  Settings,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ElementType; badge?: number };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Menu Utama",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/contacts", label: "Kontak", icon: Users },
      { href: "/broadcasts", label: "Broadcast", icon: Send },
      { href: "/flows", label: "Otomasi", icon: Workflow },
      { href: "/ai-agent", label: "AI Agent", icon: Sparkles },
    ],
  },
  {
    title: "Analitik",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Laporan", icon: BarChart3 },
    ],
  },
  {
    title: "Pengaturan",
    items: [
      { href: "/channels", label: "Channel", icon: Plug },
      { href: "/settings/users", label: "Tim", icon: UserCog },
      { href: "/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [, startLogout] = useTransition();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-white">
          <MessageSquare className="size-4" />
        </div>
        <span className="text-base font-bold">
          <span className="text-brand-navy">Chat</span>
          <span className="text-brand-blue">Cepat</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {sec.title}
            </div>
            {sec.items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-brand-blue"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    <span className="rounded-full bg-brand-blue px-1.5 text-[10px] font-semibold text-white">
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={() => startLogout(() => logout())}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-slate-100 hover:text-danger"
        >
          <LogOut className="size-[18px]" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
