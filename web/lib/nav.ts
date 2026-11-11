// Single source of the app navigation: used by the sidebar and the ⌘K menu search.
import {
  Inbox,
  Users,
  Workflow,
  Package,
  FileText,
  LayoutDashboard,
  BarChart3,
  Plug,
  UserCog,
  Tag,
  CreditCard,
  Settings,
  ShieldCheck,
  Receipt,
  Users2,
  TrendingUp,
  Activity,
  Bot,
  Sparkles,
  Gift,
} from "lucide-react";
import { can, type Ability, type Role } from "@/lib/rbac";
import { planAllows, type TenantPlan } from "@/lib/plan";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  keywords?: string; // extra words for menu search
  dot?: boolean; // channel status dot
  ability?: Ability; // undefined = always visible
  minPlan?: TenantPlan; // below this plan the item is shown locked (not hidden)
  tenantOnly?: boolean; // hidden for the platform admin (e.g. subscription)
  hideForClient?: boolean; // hidden for clients; admin (impersonating) still sees it
};

export type NavSection = { id: string; title: string; items: NavItem[] };

export const TENANT_SECTIONS: NavSection[] = [
  {
    id: "overview",
    title: "Ringkasan",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ability: "report.view", keywords: "beranda statistik" },
      { href: "/inbox", label: "Inbox", icon: Inbox, ability: "conversation.view_assigned", keywords: "chat percakapan pesan" },
    ],
  },
  {
    id: "customers",
    title: "Pelanggan",
    items: [
      { href: "/contacts", label: "Kontak", icon: Users, ability: "contact.view", keywords: "pelanggan customer" },
      { href: "/tags", label: "Tag & Label", icon: Tag, ability: "contact.manage", hideForClient: true, keywords: "segmen" },
    ],
  },
  {
    id: "sales",
    title: "Penjualan",
    items: [{ href: "/products", label: "Produk", icon: Package, ability: "product.manage", keywords: "katalog harga" }],
  },
  {
    id: "automation",
    title: "Otomasi & Marketing",
    items: [
      { href: "/flows", label: "Automation", icon: Workflow, ability: "flow.manage", keywords: "flow bot alur chatbot menu knowledge promo broadcast blast kampanye" },
      // AI is configured inside the flow AI Agent step; this page stays for the platform admin only.
      { href: "/ai-agent", label: "Asisten AI", icon: Sparkles, ability: "knowledge.manage", hideForClient: true, keywords: "ai agent bot prompt persona customer service cs sales gaya bahasa" },
      { href: "/templates", label: "Template Pesan", icon: FileText, ability: "broadcast.manage", keywords: "hsm balasan cepat" },
      // Browser-based social automation: internal tool, hidden from clients (FB/IG replies run through flows).
      { href: "/automation", label: "Otomasi Sosial", icon: Bot, ability: "flow.manage", hideForClient: true, keywords: "instagram facebook komentar dm" },
    ],
  },
  {
    id: "analytics",
    title: "Analitik",
    // Sold as the "Laporan" plan feature: visible to clients, the page shows a plan
    // lock when their plan does not include it.
    items: [{ href: "/reports", label: "Laporan", icon: BarChart3, ability: "report.view" }],
  },
  {
    id: "settings",
    title: "Pengaturan",
    items: [
      { href: "/channels", label: "Channel", icon: Plug, dot: true, ability: "channel.view", keywords: "whatsapp instagram telegram koneksi" },
      { href: "/settings/users", label: "Tim", icon: UserCog, ability: "user.manage", hideForClient: true, keywords: "agen anggota" },
      { href: "/billing", label: "Tagihan & Paket", icon: CreditCard, ability: "billing.tenant", tenantOnly: true, keywords: "langganan bayar upgrade" },
      { href: "/referral", label: "Referral", icon: Gift, ability: "billing.tenant", tenantOnly: true, keywords: "komisi affiliate ajak teman kode" },
      { href: "/settings", label: "Pengaturan", icon: Settings, hideForClient: true },
    ],
  },
];

// Platform console (super admin) — shown instead of tenant menus unless impersonating.
export const PLATFORM_SECTIONS: NavSection[] = [
  {
    id: "platform",
    title: "Platform",
    items: [
      { href: "/admin", label: "Ringkasan & Tenant", icon: ShieldCheck, keywords: "tenant" },
      { href: "/admin/analytics", label: "Analitik", icon: TrendingUp },
      { href: "/admin/transactions", label: "Transaksi", icon: Receipt, keywords: "pembayaran order" },
      { href: "/admin/referrals", label: "Referral", icon: Gift, keywords: "komisi affiliate pencairan penarikan payout" },
      { href: "/admin/users", label: "Pengguna", icon: Users2 },
      { href: "/admin/activity", label: "Aktivitas", icon: Activity, keywords: "audit log" },
      { href: "/admin/plans", label: "Paket", icon: Tag, keywords: "harga langganan fitur node token" },
      { href: "/admin/ai", label: "AI & Token", icon: Sparkles, keywords: "model provider api key openai anthropic claude top-up potongan" },
      { href: "/admin/settings", label: "Pengaturan", icon: Settings, keywords: "branding" },
    ],
  },
];

export type ResolvedNavItem = NavItem & { locked: boolean };
export type ResolvedNavSection = { id: string; title: string; items: ResolvedNavItem[] };

// Sections visible to this user: role filter (hide) then plan lock (shown, locked).
export function navFor({
  role,
  plan,
  impersonating,
}: {
  role: Role;
  plan: TenantPlan;
  impersonating: boolean;
}): ResolvedNavSection[] {
  const isPlatformAdmin = role === "admin";
  // Platform admin sees only the console; tenant menus appear while impersonating.
  const base = isPlatformAdmin && !impersonating ? PLATFORM_SECTIONS : TENANT_SECTIONS;
  return base
    .map((sec) => ({
      ...sec,
      items: sec.items
        .filter((it) => !it.ability || can({ role }, it.ability))
        .filter((it) => !(isPlatformAdmin && it.tenantOnly))
        .filter((it) => !(it.hideForClient && !isPlatformAdmin))
        .map((it) => ({ ...it, locked: !isPlatformAdmin && it.minPlan ? !planAllows(plan, it.minPlan) : false })),
    }))
    .filter((sec) => sec.items.length > 0);
}

// Longest prefix match, so /settings isn't active on /settings/users.
export function activeHref(sections: ResolvedNavSection[], pathname: string): string {
  return sections
    .flatMap((s) => s.items.map((it) => it.href))
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .reduce((best, href) => (href.length > best.length ? href : best), "");
}
