import Link from "next/link";
import type { ElementType } from "react";
import { AlertTriangle, CalendarClock, Clock3, Hourglass, PlugZap, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ActionItem, NearLimit } from "@/lib/platform-subscriptions";

const DAY = 86_400_000;

// "3 hari lagi", "hari ini", "2 hari lalu" (relative to now, WIB calendar days).
function relDay(iso: string | null, now: number, past = "lalu", future = "lagi"): string {
  if (!iso) return "";
  const wibDay = (t: number) => Math.floor((t + 7 * 3600_000) / DAY);
  const diff = wibDay(new Date(iso).getTime()) - wibDay(now);
  if (diff === 0) return "hari ini";
  return diff > 0 ? `${diff} hari ${future}` : `${-diff} hari ${past}`;
}

function Group({
  icon: Icon,
  title,
  hint,
  tone,
  count,
  children,
}: {
  icon: ElementType;
  title: string;
  hint: string;
  tone: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${tone}14`, color: tone }}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant={count ? "default" : "secondary"} className="tabular-nums">
              {count}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </header>
      {count === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Tidak ada</p>
      ) : (
        <ul className="-mx-1 max-h-64 space-y-0.5 overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}

function ItemRow({ item, when }: { item: ActionItem; when: string }) {
  return (
    <li>
      <Link
        href={`/admin/tenants/${item.tenantId}`}
        className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-muted"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{item.tenant}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{when}</span>
      </Link>
    </li>
  );
}

export function AdminActionList({
  expiring,
  trialsEnding,
  channelIssues,
  pendingOrders,
  nearLimit,
  now,
}: {
  now: number; // server time of the data, so day counts don't depend on render time
  expiring: ActionItem[];
  trialsEnding: ActionItem[];
  channelIssues: ActionItem[];
  pendingOrders: ActionItem[];
  nearLimit: NearLimit[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Group icon={CalendarClock} title="Paket akan/baru habis" hint="±7 hari · ingatkan perpanjang" tone="#F59E0B" count={expiring.length}>
        {expiring.map((i) => {
          const ended = !!i.when && new Date(i.when).getTime() < now;
          return <ItemRow key={i.tenantId} item={i} when={ended ? `habis ${relDay(i.when, now)}` : relDay(i.when, now)} />;
        })}
      </Group>
      <Group icon={Hourglass} title="Trial berakhir" hint="≤3 hari · tawarkan paket berbayar" tone="#8B5CF6" count={trialsEnding.length}>
        {trialsEnding.map((i) => (
          <ItemRow key={i.tenantId} item={i} when={relDay(i.when, now)} />
        ))}
      </Group>
      <Group icon={TrendingUp} title="Mendekati batas paket" hint="≥80% terpakai · peluang upgrade" tone="#10B981" count={nearLimit.length}>
        {nearLimit.map((n) => (
          <li key={n.tenantId}>
            <Link href={`/admin/tenants/${n.tenantId}`} className="block rounded-lg px-1 py-1.5 hover:bg-muted">
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-foreground">{n.tenant}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{n.plan}</span>
              </span>
              {n.items.map((x) => (
                <span key={x.label} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-32 shrink-0 truncate">{x.label}</span>
                  <Progress value={Math.min(x.pct, 100)} className="min-w-0 flex-1" />
                  <span className="w-10 shrink-0 text-right font-medium tabular-nums text-foreground">{x.pct}%</span>
                </span>
              ))}
            </Link>
          </li>
        ))}
      </Group>
      <Group icon={PlugZap} title="Channel bermasalah" hint="Terputus / diblokir · bantu hubungkan ulang" tone="#EF4444" count={channelIssues.length}>
        {channelIssues.map((i, idx) => (
          <ItemRow key={`${i.tenantId}-${idx}`} item={i} when={relDay(i.when, now)} />
        ))}
      </Group>
      <Group icon={Clock3} title="Pembayaran tertunda" hint=">24 jam belum dibayar · ingatkan" tone="#2547F9" count={pendingOrders.length}>
        {pendingOrders.map((i, idx) => (
          <ItemRow key={`${i.tenantId}-${idx}`} item={i} when={relDay(i.when, now)} />
        ))}
      </Group>
      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Angka langganan dihitung dari riwayat pembayaran: paket bulanan berlaku 30 hari, tahunan 365 hari sejak dibayar.
          Klik tenant untuk membuka detailnya.
        </p>
      </section>
    </div>
  );
}
