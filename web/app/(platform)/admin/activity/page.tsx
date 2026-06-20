import {
  Activity,
  Power,
  PowerOff,
  LogIn,
  Package,
  Trash2,
  Settings,
  PencilLine,
} from "lucide-react";
import { requireSession } from "@/lib/session";
import { timeAgo } from "@/lib/format";
import { listAuditLogs, type AuditRow } from "@/lib/platform-stats";

// Meta per action: label Indonesia + ikon + warna.
const ACTION_META: Record<string, { label: string; icon: typeof Activity; tone: string }> = {
  "tenant.suspend": { label: "Suspend tenant", icon: PowerOff, tone: "#ef4444" },
  "tenant.activate": { label: "Aktifkan tenant", icon: Power, tone: "#10b981" },
  "impersonate.start": { label: "Masuk sebagai tenant", icon: LogIn, tone: "#3b82f6" },
  "plan.create": { label: "Buat paket", icon: Package, tone: "#8b5cf6" },
  "plan.update": { label: "Ubah paket", icon: PencilLine, tone: "#f59e0b" },
  "plan.delete": { label: "Hapus paket", icon: Trash2, tone: "#ef4444" },
  "platform.settings_update": { label: "Ubah pengaturan platform", icon: Settings, tone: "#6366f1" },
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export default async function PlatformActivityPage() {
  await requireSession();
  const logs = await listAuditLogs(100);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-brand-navy">
          <Activity className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
          <p className="text-sm text-muted-foreground">Jejak aksi penting admin platform.</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Belum ada aktivitas tercatat. Aksi admin (suspend, impersonasi, ubah paket) akan muncul di sini.
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {logs.map((it: AuditRow) => {
            const meta = ACTION_META[it.action] ?? {
              label: it.action,
              icon: Activity,
              tone: "#64748b",
            };
            const Icon = meta.icon;
            const target = it.targetLabel ?? it.tenantName ?? it.targetType ?? "";
            return (
              <li key={it.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${meta.tone}1a`, color: meta.tone }}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {meta.label}
                    {target && <span className="text-muted-foreground"> · {target}</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {it.actorEmail ?? "sistem"}
                    {it.ip && ` · ${it.ip}`} · {fmtTime(it.createdAt)}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(it.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
