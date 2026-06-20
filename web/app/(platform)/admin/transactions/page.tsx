import { Wallet, CalendarClock, Clock, Receipt } from "lucide-react";
import { requireSession } from "@/lib/session";
import { rupiah } from "@/lib/format";
import { getRevenueStats, listOrders, type OrderRow } from "@/lib/platform-stats";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Dibayar",
  pending: "Menunggu",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export default async function TransactionsPage() {
  await requireSession();
  const [stats, orders] = await Promise.all([getRevenueStats(), listOrders(100)]);

  const cards = [
    { label: "Total Pendapatan", value: rupiah(stats.totalPaidIdr), icon: Wallet, tone: "#10b981" },
    { label: "Pendapatan Bulan Ini", value: rupiah(stats.monthPaidIdr), icon: CalendarClock, tone: "#3b82f6" },
    { label: "Menunggu Bayar", value: String(stats.pendingCount), icon: Clock, tone: "#f59e0b" },
    { label: "Total Transaksi", value: String(stats.totalCount), icon: Receipt, tone: "#8b5cf6" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transaksi</h1>
        <p className="text-sm text-muted-foreground">Pembayaran paket seluruh tenant.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <span
                className="flex size-9 items-center justify-center rounded-lg"
                style={{ background: `${c.tone}1a`, color: c.tone }}
              >
                <Icon className="size-[18px]" />
              </span>
              <div className="mt-3 text-xl font-bold tracking-tight">{c.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Riwayat Transaksi</h2>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Belum ada transaksi.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Paket</th>
                  <th className="px-4 py-3 font-semibold">Jumlah</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Metode</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: OrderRow) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.tenantName}</div>
                      {o.customerName && (
                        <div className="text-xs text-muted-foreground">{o.customerName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{o.planName}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">{rupiah(o.amountIdr)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.paymentMethod ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
