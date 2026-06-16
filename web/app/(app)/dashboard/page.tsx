import { sql } from "drizzle-orm";
import { MessageSquare, Inbox, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { cleanIDR } from "@/lib/format";

async function counts(tenantId: string | null) {
  if (!tenantId) return { conversations: 0, open: 0, contacts: 0, broadcasts: 0 };
  try {
    const one = async (q: string) => {
      const r = await db.execute(sql.raw(q));
      // postgres-js returns rows array
      const rows = r as unknown as Array<{ n: number }>;
      return Number(rows[0]?.n ?? 0);
    };
    const t = `'${tenantId}'`;
    return {
      conversations: await one(`select count(*)::int n from conversations where tenant_id=${t}`),
      open: await one(`select count(*)::int n from conversations where tenant_id=${t} and status='open'`),
      contacts: await one(`select count(*)::int n from contacts where tenant_id=${t}`),
      broadcasts: await one(`select count(*)::int n from broadcasts where tenant_id=${t}`),
    };
  } catch {
    return { conversations: 0, open: 0, contacts: 0, broadcasts: 0 };
  }
}

const VOLUME = [
  { label: "WhatsApp", v: 68, color: "#25d366" },
  { label: "Instagram", v: 42, color: "#dd2a7b" },
  { label: "Messenger", v: 28, color: "#0084ff" },
  { label: "Telegram", v: 19, color: "#0088cc" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ background: `${tone}1a`, color: tone }}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-xs text-success">
        <TrendingUp className="size-3.5" /> {sub}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const c = await counts(session.tenantId);
  const max = Math.max(...VOLUME.map((x) => x.v));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Halo, {session.name} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan aktivitas {session.tenantName ?? "workspace"} hari ini.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Total Percakapan" value={cleanIDR(c.conversations)} sub="aktif bulan ini" tone="#3b82f6" />
        <StatCard icon={Inbox} label="Inbox Terbuka" value={cleanIDR(c.open)} sub="perlu ditangani" tone="#f59e0b" />
        <StatCard icon={Clock} label="Total Kontak" value={cleanIDR(c.contacts)} sub="opted-in tumbuh" tone="#8b5cf6" />
        <StatCard icon={CheckCircle2} label="Broadcast" value={cleanIDR(c.broadcasts)} sub="terkirim patuh" tone="#10b981" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Volume per Channel</h2>
          <div className="space-y-3">
            {VOLUME.map((x) => (
              <div key={x.label} className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted-foreground">{x.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(x.v / max) * 100}%`, background: x.color }} />
                </div>
                <span className="w-8 text-right text-sm font-semibold">{x.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Aktivitas Terbaru</h2>
          <ul className="space-y-3 text-sm">
            {[
              { t: "AI agent membalas 12 percakapan", c: "#3b82f6" },
              { t: "Broadcast 'Promo' terkirim ke 230 kontak", c: "#10b981" },
              { t: "3 channel terhubung sehat", c: "#8b5cf6" },
              { t: "5 kontak baru via click-to-WhatsApp", c: "#f59e0b" },
            ].map((a, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="size-2 rounded-full" style={{ background: a.c }} />
                <span className="text-foreground">{a.t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
