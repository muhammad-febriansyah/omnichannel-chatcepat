"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { Sidebar, type SupportContact } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { stopImpersonation } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/session";
import type { SidebarStats } from "@/lib/plan";

export function AppShell({
  session,
  workspaceName,
  stats,
  support,
  logoUrl,
  siteName,
  tenants,
  children,
}: {
  session: Session;
  workspaceName?: string;
  stats: SidebarStats;
  support?: SupportContact;
  logoUrl?: string;
  siteName?: string;
  tenants?: { id: string; name: string; slug: string }[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Tutup drawer mobile saat pindah halaman (sinkron UI drawer ke perubahan route).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((c) => !c);
    } else {
      setMobileOpen((o) => !o);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: static di desktop, drawer overlay di mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Sidebar workspaceName={workspaceName} collapsed={collapsed} role={session.role} stats={stats} support={support} logoUrl={logoUrl} siteName={siteName} impersonating={session.impersonating} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {session.impersonating && (
          <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
            <span className="flex items-center gap-2">
              <Eye className="size-4" />
              Mode tenant: <span className="font-semibold">{session.tenantName ?? "—"}</span>
            </span>
            <form action={stopImpersonation}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30"
              >
                <LogOut className="size-3.5" /> Keluar mode tenant
              </button>
            </form>
          </div>
        )}
        <Topbar session={session} onToggleSidebar={toggle} tenants={tenants} />
        <Breadcrumbs />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
