import { Search, Bell, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { Session } from "@/lib/session";

export function Topbar({ session }: { session: Session }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          placeholder="Cari percakapan, kontak…"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-100">
          <Bell className="size-[18px]" />
        </button>
        <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-100">
          <HelpCircle className="size-[18px]" />
        </button>
        <div className="ml-2 flex items-center gap-2.5 pl-2">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{session.name}</div>
            <div className="text-xs capitalize text-muted-foreground">
              {session.tenantName ?? session.role}
            </div>
          </div>
          <Avatar className="size-9">
            <AvatarFallback className="bg-gradient-to-br from-brand-navy to-brand-blue text-xs font-semibold text-white">
              {initials(session.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
