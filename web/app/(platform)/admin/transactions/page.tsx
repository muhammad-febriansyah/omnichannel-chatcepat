import { Wallet, CalendarClock, Clock, Receipt } from "lucide-react";
import { requireSession } from "@/lib/session";
import { rupiah } from "@/lib/format";
import { getRevenueStats, listOrders } from "@/lib/platform-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsTable } from "@/components/app/transactions-table";

export default async function TransactionsPage() {
  await requireSession();
  const [stats, orders] = await Promise.all([getRevenueStats(), listOrders(500)]);

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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable rows={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
