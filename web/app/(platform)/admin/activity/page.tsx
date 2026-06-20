import { Building2, UserPlus, Receipt, Activity } from "lucide-react";
import { requireSession } from "@/lib/session";
import { timeAgo } from "@/lib/format";
import { getRecentActivity, type ActivityItem } from "@/lib/platform-stats";

const ICON: Record<ActivityItem["kind"], { icon: typeof Activity; tone: string }> = {
  tenant: { icon: Building2, tone: "#3b82f6" },
  user: { icon: UserPlus, tone: "#10b981" },
  order: { icon: Receipt, tone: "#8b5cf6" },
};

export default async function PlatformActivityPage() {
  await requireSession();
  const items = await getRecentActivity(50);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-brand-navy">
          <Activity className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aktivitas Terkini</h1>
          <p className="text-sm text-muted-foreground">Tenant baru, pengguna baru, dan transaksi.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Belum ada aktivitas.
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((it, i) => {
            const { icon: Icon, tone } = ICON[it.kind];
            return (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${tone}1a`, color: tone }}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(it.at)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Catatan: ini ringkasan dari data yang ada. Jejak audit penuh (login admin, suspend, ubah paket)
        memerlukan tabel audit khusus.
      </p>
    </div>
  );
}
