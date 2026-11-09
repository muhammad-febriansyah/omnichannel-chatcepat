"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, MessageCircle, LogOut, Lock, ChevronDown, Building2, ShieldCheck } from "lucide-react";
import { logout } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { type Role } from "@/lib/rbac";
import { PLAN_LABEL, type SidebarStats } from "@/lib/plan";
import { navFor, activeHref as findActive } from "@/lib/nav";
import { BrandLogo } from "@/components/app/brand-logo";

export type SupportContact = { whatsapp?: string; phone?: string; email?: string };

const COLLAPSED_KEY = "cc.sidebar.closedSections";

function readClosed(): string[] {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function Sidebar({
  workspaceName,
  collapsed = false,
  role,
  stats,
  support,
  logoUrl,
  siteName,
  impersonating = false,
}: {
  workspaceName?: string;
  collapsed?: boolean;
  role: Role;
  stats: SidebarStats;
  support?: SupportContact;
  logoUrl?: string;
  siteName?: string;
  impersonating?: boolean;
}) {
  const pathname = usePathname();
  const isPlatformAdmin = role === "admin";
  const sections = navFor({ role, plan: stats.plan, impersonating });
  const active = findActive(sections, pathname);
  const showPlatformCard = isPlatformAdmin && !impersonating;

  // Section collapse state is a per-viewer convenience; storage may be unavailable.
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosed(readClosed());
  }, []);
  function toggleSection(id: string) {
    setClosed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked — keep in memory only */
      }
      return next;
    });
  }

  const channelConnected = stats.channelsConnected > 0;
  const [pendingLogout, startLogout] = useTransition();

  // Admin contact from tenant web_settings — WA → phone → email.
  const supportWa = support?.whatsapp?.replace(/[^0-9]/g, "");
  const supportPhone = support?.phone?.replace(/[^0-9+]/g, "");
  const supportHref = supportWa
    ? `https://wa.me/${supportWa}`
    : supportPhone
      ? `tel:${supportPhone}`
      : support?.email
        ? `mailto:${support.email}`
        : "#";

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "px-5")}>
        <BrandLogo logoUrl={logoUrl} siteName={siteName} variant="dark" size={28} withWordmark={!collapsed} />
      </div>

      {/* Workspace card */}
      <div className={cn("shrink-0", collapsed ? "px-2.5 pb-2" : "px-3 pb-3")}>
        {collapsed ? (
          <div
            title={showPlatformCard ? "Konsol Platform" : workspaceName}
            className="mx-auto grid size-10 place-items-center rounded-xl bg-blue-50 text-brand-blue dark:bg-blue-500/10"
          >
            {showPlatformCard ? <ShieldCheck className="size-[18px]" /> : <Building2 className="size-[18px]" />}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-gradient-to-br from-blue-50/80 to-card px-3 py-2.5 dark:from-blue-500/10">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-blue text-white shadow-sm">
              {showPlatformCard ? <ShieldCheck className="size-[18px]" /> : <Building2 className="size-[18px]" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">
                {showPlatformCard ? "Konsol Platform" : workspaceName || "Workspace"}
              </div>
              {showPlatformCard ? (
                <div className="truncate text-[11px] text-muted-foreground">Super admin</div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", channelConnected ? "bg-success" : "bg-muted-foreground/40")} />
                  <span className="truncate">
                    {stats.channelsConnected} channel aktif · {PLAN_LABEL[stats.plan]}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3", collapsed ? "px-2.5" : "px-3")}>
        {sections.map((sec) => {
          const isClosed = !collapsed && closed.includes(sec.id) && !sec.items.some((it) => it.href === active);
          return (
            <div key={sec.id} className="flex flex-col">
              {collapsed ? (
                <div className="mx-auto my-2 h-px w-6 bg-border first:hidden" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleSection(sec.id)}
                  aria-expanded={!isClosed}
                  className="flex items-center justify-between px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 transition-colors hover:text-foreground"
                >
                  {sec.title}
                  <ChevronDown className={cn("size-3.5 transition-transform", isClosed && "-rotate-90")} />
                </button>
              )}
              {!isClosed && (
                <div className="flex flex-col gap-0.5">
                  {sec.items.map((it) => {
                    const Icon = it.icon;
                    if (it.locked) {
                      const plan = PLAN_LABEL[it.minPlan!];
                      return (
                        <Link
                          key={it.href}
                          href="/billing"
                          title={`Fitur paket ${plan} — klik untuk upgrade`}
                          aria-label={`${it.label} (terkunci, butuh paket ${plan})`}
                          className={cn(
                            "relative flex items-center rounded-xl text-[13.5px] font-medium text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground",
                            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                          )}
                        >
                          <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                          {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                          <Lock className={cn("size-3.5 shrink-0", collapsed && "absolute right-1.5 top-1.5")} />
                        </Link>
                      );
                    }
                    const isActive = it.href === active;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        title={collapsed ? it.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative flex items-center rounded-xl text-[13.5px] font-medium transition-colors",
                          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-brand-blue font-semibold text-white shadow-[0_6px_16px_-6px_rgba(59,130,246,0.6)]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.8} />
                        {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                        {it.dot ? (
                          <span
                            title={channelConnected ? `${stats.channelsConnected} channel aktif` : "Belum ada channel aktif"}
                            className={cn(
                              "size-2 rounded-full",
                              channelConnected
                                ? isActive
                                  ? "bg-white"
                                  : "bg-success shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                : "bg-muted-foreground/40",
                              collapsed && "absolute right-1.5 top-1.5",
                            )}
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("flex shrink-0 flex-col gap-2 border-t border-border", collapsed ? "p-2.5" : "p-3")}>
        {collapsed ? (
          <a
            href={supportHref}
            target={supportHref.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            title="Hubungi Admin"
            aria-label="Hubungi Admin"
            className="mx-auto grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <LifeBuoy className="size-[18px]" />
          </a>
        ) : (
          <a
            href={supportHref}
            target={supportHref.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 transition-colors hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
              <MessageCircle className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-foreground">Butuh bantuan?</span>
              <span className="block truncate text-[11px] text-muted-foreground">Chat dengan tim admin</span>
            </span>
          </a>
        )}

        <button
          onClick={() => startLogout(() => logout())}
          disabled={pendingLogout}
          className={cn(
            "flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-danger disabled:opacity-50 dark:hover:bg-red-500/10",
            collapsed ? "mx-auto size-9 justify-center" : "h-9 gap-2 px-3 text-[13px] font-medium",
          )}
          title="Keluar"
          aria-label="Keluar"
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>{pendingLogout ? "Keluar…" : "Keluar"}</span>}
        </button>
      </div>
    </aside>
  );
}
