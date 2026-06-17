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
  FileText,
  LayoutDashboard,
  BarChart3,
  Plug,
  UserCog,
  Tag,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Ability, type Role } from "@/lib/rbac";
import { cleanIDR } from "@/lib/format";
import { PLAN_LABEL, type SidebarStats } from "@/lib/plan";
import { CCLogo } from "@/components/app/charts";

type Item = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  dot?: boolean;
  ability?: Ability; // undefined = selalu tampil
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Menu Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ability: "report.view" },
      { href: "/inbox", label: "Inbox", icon: Inbox, ability: "conversation.view_assigned" },
      { href: "/contacts", label: "Kontak", icon: Users, ability: "contact.view" },
      { href: "/broadcasts", label: "Broadcast", icon: Send, ability: "broadcast.manage" },
      { href: "/templates", label: "Template Pesan", icon: FileText, ability: "broadcast.manage" },
      { href: "/flows", label: "Otomasi", icon: Workflow, ability: "flow.manage" },
      { href: "/ai-agent", label: "AI Agent", icon: Sparkles, ability: "knowledge.manage" },
    ],
  },
  {
    title: "Analitik",
    items: [{ href: "/reports", label: "Laporan", icon: BarChart3, ability: "report.view" }],
  },
  {
    title: "Pengaturan",
    items: [
      { href: "/channels", label: "Channel", icon: Plug, dot: true, ability: "channel.view" },
      { href: "/tags", label: "Tag & Label", icon: Tag, ability: "contact.manage" },
      { href: "/settings/users", label: "Tim", icon: UserCog, ability: "user.manage" },
      { href: "/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

export function Sidebar({
  workspaceName,
  collapsed = false,
  role,
  stats,
}: {
  workspaceName?: string;
  collapsed?: boolean;
  role: Role;
  stats: SidebarStats;
}) {
  const pathname = usePathname();
  const sections = SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => !it.ability || can({ role }, it.ability)),
  })).filter((sec) => sec.items.length > 0);

  // Aktif = href dengan prefix-match terpanjang (hindari /settings ikut aktif di /settings/users).
  const activeHref = sections
    .flatMap((s) => s.items.map((it) => it.href))
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .reduce((best, href) => (href.length > best.length ? href : best), "");

  const channelConnected = stats.channelsConnected > 0;
  const channelText =
    stats.channelsTotal === 0
      ? "Belum ada channel"
      : `${stats.channelsConnected}/${stats.channelsTotal} channel terhubung`;
  const usagePct = stats.quota ? Math.min(100, (stats.messagesSent / stats.quota) * 100) : 0;
  const usageText = stats.quota
    ? `${cleanIDR(stats.messagesSent)} / ${cleanIDR(stats.quota)}`
    : `${cleanIDR(stats.messagesSent)} / ∞`;
  const canUpgrade = stats.plan !== "enterprise";
  const [pendingLogout, startLogout] = useTransition();
  const name = workspaceName ?? "Workspace";
  const mono = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-[72px] p-2.5" : "w-60 p-4",
      )}
    >
      {/* Brand */}
      <div className={cn("pt-1", collapsed ? "flex justify-center" : "px-2")}>
        <CCLogo variant="dark" size={30} withWordmark={!collapsed} />
      </div>

      {/* Workspace card */}
      <div
        className={cn(
          "flex items-center rounded-[10px] bg-gradient-to-br from-blue-50 to-blue-100",
          collapsed ? "justify-center p-1.5" : "gap-2.5 p-2.5",
        )}
        title={collapsed ? name : undefined}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-navy to-brand-blue text-[13px] font-bold tracking-wide text-white">
          {mono}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-brand-navy">{name}</span>
              <span className="rounded-full bg-brand-navy px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                {PLAN_LABEL[stats.plan]}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{channelText}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-2">
        {sections.map((sec) => (
          <div key={sec.title} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {sec.title}
              </div>
            )}
            {sec.items.map((it) => {
              const active = it.href === activeHref;
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  title={collapsed ? it.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-lg text-[13.5px] font-medium transition-colors",
                    collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-blue-100 font-semibold text-brand-navy before:absolute before:inset-y-2 before:-left-1 before:w-[3px] before:rounded-r before:bg-brand-blue"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                  {!collapsed && it.badge ? (
                    <span className="min-w-5 rounded-full bg-brand-blue px-1.5 text-center text-[11px] font-bold text-white">
                      {it.badge}
                    </span>
                  ) : null}
                  {it.dot ? (
                    <span
                      title={channelConnected ? `${stats.channelsConnected} channel aktif` : "Belum ada channel aktif"}
                      className={cn(
                        "size-2 rounded-full",
                        channelConnected
                          ? "bg-success shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                          : "bg-muted-foreground/40",
                        collapsed && "absolute right-1.5 top-1.5",
                      )}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2.5">
        {!collapsed && (
          <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50 to-card p-3">
            <div className="flex justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">Pesan terkirim</span>
              <span className="font-semibold text-brand-navy">{usageText}</span>
            </div>
            {stats.quota ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    usagePct >= 90
                      ? "bg-gradient-to-r from-warning to-danger"
                      : "bg-gradient-to-r from-brand-blue to-brand-light",
                  )}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            ) : null}
            {canUpgrade ? (
              <button className="rounded-lg border-[1.5px] border-brand-blue bg-card py-1.5 text-[11.5px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">
                Upgrade Paket
              </button>
            ) : null}
          </div>
        )}
        <div className={cn("flex justify-center gap-1.5", collapsed && "flex-col items-center")}>
          <button
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
            title="Bantuan"
            aria-label="Bantuan"
          >
            <HelpCircle className="size-[18px]" />
          </button>
          <button
            onClick={() => startLogout(() => logout())}
            disabled={pendingLogout}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-danger disabled:opacity-50"
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
