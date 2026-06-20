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
  CreditCard,
  Settings,
  LifeBuoy,
  MessageCircle,
  LogOut,
  Lock,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Ability, type Role } from "@/lib/rbac";
import { planAllows, PLAN_LABEL, type SidebarStats, type TenantPlan } from "@/lib/plan";
import { CCLogo } from "@/components/app/charts";

type Item = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  dot?: boolean;
  ability?: Ability; // undefined = selalu tampil
  minPlan?: TenantPlan; // paket minimal; di bawahnya item dikunci (bukan disembunyikan)
  tenantOnly?: boolean; // hanya client; admin platform disembunyikan (mis. langganan/billing)
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Menu Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ability: "report.view" },
      { href: "/inbox", label: "Inbox", icon: Inbox, ability: "conversation.view_assigned" },
      { href: "/contacts", label: "Kontak", icon: Users, ability: "contact.view" },
      { href: "/broadcasts", label: "Broadcast", icon: Send, ability: "broadcast.manage", minPlan: "business" },
      { href: "/templates", label: "Template Pesan", icon: FileText, ability: "broadcast.manage" },
      { href: "/flows", label: "Otomasi", icon: Workflow, ability: "flow.manage", minPlan: "business" },
      { href: "/ai-agent", label: "AI Agent", icon: Sparkles, ability: "knowledge.manage", minPlan: "enterprise" },
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
      { href: "/billing", label: "Tagihan & Paket", icon: CreditCard, ability: "billing.tenant", tenantOnly: true },
      { href: "/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

// Section khusus admin platform (god-mode) — konsol platform, ditaruh paling atas.
const PLATFORM_SECTION: { title: string; items: Item[] } = {
  title: "Platform",
  items: [
    { href: "/admin", label: "Ringkasan & Tenant", icon: ShieldCheck },
    { href: "/admin/transactions", label: "Transaksi", icon: Receipt },
    { href: "/admin/plans", label: "Paket", icon: Tag },
  ],
};

export type SupportContact = { whatsapp?: string; phone?: string; email?: string };

export function Sidebar({
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
  // admin platform: default HANYA konsol platform (tracking tenant, paket). Menu
  // operasional omnichannel disembunyikan — itu ranah tenant. Tampil hanya saat
  // admin "masuk sebagai tenant" (impersonasi) untuk support.
  const baseSections = isPlatformAdmin
    ? impersonating
      ? SECTIONS
      : [PLATFORM_SECTION]
    : SECTIONS;
  // Filter per-role (hide), lalu tandai `locked` per-paket (tampil tapi terkunci).
  const sections = baseSections
    .map((sec) => ({
      ...sec,
      items: sec.items
        .filter((it) => !it.ability || can({ role }, it.ability))
        .filter((it) => !(isPlatformAdmin && it.tenantOnly)) // admin: sembunyikan menu langganan
        .map((it) => ({ ...it, locked: !isPlatformAdmin && it.minPlan ? !planAllows(stats.plan, it.minPlan) : false })),
    }))
    .filter((sec) => sec.items.length > 0);

  // Aktif = href dengan prefix-match terpanjang (hindari /settings ikut aktif di /settings/users).
  const activeHref = sections
    .flatMap((s) => s.items.map((it) => it.href))
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .reduce((best, href) => (href.length > best.length ? href : best), "");

  const channelConnected = stats.channelsConnected > 0;
  const [pendingLogout, startLogout] = useTransition();

  // Kontak admin dari web_settings tenant (DB) — WA → telepon → email.
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
        "flex h-screen shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-[72px] p-2.5" : "w-60 p-4",
      )}
    >
      {/* Brand — logo dari web_settings tenant; fallback CCLogo. Collapsed pakai ikon (logo landscape tak muat). */}
      <div className={cn("pt-1", collapsed ? "flex justify-center" : "px-2")}>
        {logoUrl && !collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element -- aset brand arbitrer (upload tenant)
          <img src={logoUrl} alt={siteName ?? "Logo"} className="h-8 w-auto max-w-full object-contain" />
        ) : (
          <CCLogo variant="dark" size={30} withWordmark={!collapsed} />
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
              const active = it.href === activeHref && !it.locked;
              const Icon = it.icon;

              // Terkunci: paket tenant di bawah minPlan. Tampil abu-abu, klik → /billing (upgrade).
              if (it.locked) {
                const upsell = `Fitur paket ${PLAN_LABEL[it.minPlan!]} — klik untuk upgrade`;
                return (
                  <Link
                    key={it.href}
                    href="/billing"
                    title={upsell}
                    aria-label={`${it.label} (terkunci, butuh paket ${PLAN_LABEL[it.minPlan!]})`}
                    className={cn(
                      "relative flex items-center rounded-lg text-[13.5px] font-medium text-muted-foreground/50 transition-colors hover:bg-slate-100 hover:text-muted-foreground",
                      collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                    )}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    <Lock className={cn("size-3.5 shrink-0", collapsed && "absolute right-1.5 top-1.5")} />
                  </Link>
                );
              }

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
      <div className="mt-auto flex flex-col gap-2">
        {/* Hubungi Admin */}
        {collapsed ? (
          <a
            href={supportHref}
            target={supportHref.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            title="Hubungi Admin"
            aria-label="Hubungi Admin"
            className="mx-auto grid size-9 place-items-center rounded-lg bg-blue-50 text-brand-blue transition-colors hover:bg-blue-100"
          >
            <LifeBuoy className="size-[18px]" />
          </a>
        ) : (
          <div className="rounded-xl border border-border bg-gradient-to-br from-blue-50 to-card p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <LifeBuoy className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-foreground">Butuh bantuan?</div>
                <div className="truncate text-[11px] text-muted-foreground">Tim admin siap membantu</div>
              </div>
            </div>
            <a
              href={supportHref}
              target={supportHref.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-blue text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              <MessageCircle className="size-3.5" /> Hubungi Admin
            </a>
          </div>
        )}

        {/* Keluar */}
        <button
          onClick={() => startLogout(() => logout())}
          disabled={pendingLogout}
          className={cn(
            "flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-danger disabled:opacity-50",
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
