import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Building2, ShieldCheck, Tags, LogOut } from "lucide-react";
import { requireSession } from "@/lib/session";
import { logout } from "@/lib/actions";
import { initials } from "@/lib/format";
import { CCLogo } from "@/components/app/charts";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Hanya super_admin. Role tenant dilempar ke panel-nya (middleware juga enforce).
  if (session.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar platform (navy, beda dari panel tenant) */}
      <aside className="flex h-screen w-60 shrink-0 flex-col gap-4 border-r border-white/10 bg-brand-navy p-4 text-white">
        <div className="px-2 pt-1">
          <CCLogo variant="white" size={30} />
        </div>
        <div className="flex items-center gap-2.5 rounded-[10px] bg-white/10 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/15">
            <ShieldCheck className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">Platform</div>
            <div className="text-[11px] text-white/60">Konsol Super Admin</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg bg-white/15 px-3 py-2.5 text-[13.5px] font-semibold"
          >
            <LayoutDashboard className="size-5 shrink-0" strokeWidth={1.75} /> Ringkasan
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Building2 className="size-5 shrink-0" strokeWidth={1.75} /> Tenant
          </Link>
          <Link
            href="/admin/plans"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Tags className="size-5 shrink-0" strokeWidth={1.75} /> Paket
          </Link>
        </nav>

        <form action={logout} className="mt-auto">
          <div className="flex items-center gap-2.5 rounded-[10px] bg-white/5 p-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-brand-light text-xs font-bold">
              {initials(session.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{session.name}</div>
              <div className="text-[11px] text-white/60">Super Admin</div>
            </div>
            <button
              type="submit"
              aria-label="Keluar"
              title="Keluar"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </form>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
