"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Settings, ChevronDown, PanelLeft, User, LogOut, Building2, Check } from "lucide-react";
import { logout, setActingTenant } from "@/lib/actions";
import { initials, roleLabel } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Session } from "@/lib/session";

export function Topbar({
  session,
  onToggleSidebar,
  tenants = [],
}: {
  session: Session;
  onToggleSidebar?: () => void;
  tenants?: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [pendingLogout, startLogout] = useTransition();
  const [pendingSwitch, startSwitch] = useTransition();
  const workspace = session.tenantName ?? "Workspace";
  // Label workspace di kartu profil: admin platform tanpa impersonasi = "Konsol Platform".
  const workspaceLabel =
    session.isPlatformAdmin && !session.impersonating ? "Konsol Platform" : workspace;

  function switchTenant(id: string) {
    if (id === session.actingTenantId) return;
    startSwitch(async () => {
      await setActingTenant(id);
      router.refresh();
    });
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      {/* left: toggle + search/switcher */}
      <button
        onClick={onToggleSidebar}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
        aria-label="Tampilkan / sembunyikan menu samping"
        title="Tampilkan / sembunyikan menu"
      >
        <PanelLeft className="size-[18px]" />
      </button>
      {session.isPlatformAdmin && session.impersonating ? (
        // Admin platform sedang impersonasi: ganti tenant yang sedang dikelola.
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pendingSwitch}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-background px-3 text-sm outline-none transition-colors hover:border-muted-foreground/40 hover:bg-card focus-visible:border-brand-blue data-[popup-open]:border-brand-blue disabled:opacity-60"
          >
            <Building2 className="size-4 shrink-0 text-brand-blue" />
            <span className="max-w-[180px] truncate font-medium text-foreground">
              {pendingSwitch ? "Beralih…" : (workspace ?? "Pilih tenant")}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
            <div className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kelola sebagai tenant
            </div>
            <DropdownMenuSeparator />
            {tenants.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)}>
                <span className="flex-1 truncate">{t.name}</span>
                {t.id === session.actingTenantId && <Check className="size-4 text-brand-blue" />}
              </DropdownMenuItem>
            ))}
            {tenants.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Belum ada tenant</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : session.isPlatformAdmin ? (
        // Konsol platform (bukan impersonasi): label statik, tanpa pilih tenant.
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-background px-3 text-sm">
          <Building2 className="size-4 shrink-0 text-brand-blue" />
          <span className="font-medium text-foreground">Konsol Platform</span>
        </div>
      ) : (
        <div className="flex h-10 w-full max-w-[420px] items-center gap-2 rounded-[10px] border border-transparent bg-background px-3 text-muted-foreground transition focus-within:border-brand-blue focus-within:bg-card focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]">
          <Search className="size-4 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            placeholder="Cari kontak, percakapan, atau pesan…"
            aria-label="Pencarian global"
          />
          <span className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground sm:inline">
            ⌘K
          </span>
        </div>
      )}

      {/* right */}
      <div className="ml-auto flex items-center gap-2">
        <button
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
          aria-label="Notifikasi"
        >
          <Bell className="size-[18px]" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-card bg-danger" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 flex h-10 items-center gap-2 rounded-[10px] border border-border bg-card py-1 pl-1 pr-2.5 outline-none transition-colors hover:border-muted-foreground/40 hover:bg-background focus-visible:border-brand-blue data-[popup-open]:border-brand-blue data-[popup-open]:bg-background">
            <span className="relative grid size-[30px] place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-bold tracking-wide text-white">
              {session.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- aset upload user
                <img src={session.avatarUrl} alt={session.name} className="size-full object-cover" />
              ) : (
                initials(session.name)
              )}
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-success" />
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="max-w-[120px] truncate text-[13px] font-semibold text-foreground">{session.name}</span>
              <span className="text-[11px] text-muted-foreground">{roleLabel(session.role)}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
              <span className="text-sm font-semibold text-foreground">{session.name}</span>
              <span className="truncate text-xs text-muted-foreground">{session.email}</span>
              <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                {workspaceLabel} · <span>{roleLabel(session.role)}</span>
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="size-4" /> Profil
            </DropdownMenuItem>
            {session.role !== "client" && (
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="size-4" /> Pengaturan
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pendingLogout}
              onClick={() => startLogout(() => logout())}
            >
              <LogOut className="size-4" /> {pendingLogout ? "Keluar…" : "Keluar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
