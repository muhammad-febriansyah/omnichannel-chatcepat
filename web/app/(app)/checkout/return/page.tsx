import { and, eq } from "drizzle-orm";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { rupiah } from "@/lib/format";
import { ActionLink } from "@/components/app/action-link";

const STATUS: Record<string, { icon: typeof CheckCircle2; tone: string; title: string; desc: string }> = {
  paid: { icon: CheckCircle2, tone: "text-success", title: "Pembayaran berhasil", desc: "Paket kamu sudah aktif. Terima kasih!" },
  pending: { icon: Clock, tone: "text-amber-500", title: "Menunggu pembayaran", desc: "Selesaikan pembayaran. Status otomatis diperbarui setelah dibayar." },
  failed: { icon: XCircle, tone: "text-danger", title: "Pembayaran gagal", desc: "Transaksi tidak selesai. Coba lagi atau pilih metode lain." },
  expired: { icon: XCircle, tone: "text-danger", title: "Pembayaran kadaluarsa", desc: "Waktu pembayaran habis. Silakan buat order baru." },
};

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantOrderId?: string; reference?: string }>;
}) {
  const session = await requireSession();
  const { merchantOrderId } = await searchParams;

  const order =
    merchantOrderId && session.tenantId
      ? await db.query.orders.findFirst({
          where: and(eq(orders.merchantOrderId, merchantOrderId), eq(orders.tenantId, session.tenantId)),
        })
      : null;

  const meta = STATUS[order?.status ?? "pending"] ?? STATUS.pending;
  const Icon = meta.icon;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <Icon className={`mx-auto size-14 ${meta.tone}`} />
        <h1 className="mt-4 text-xl font-bold text-foreground">{meta.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{meta.desc}</p>

        {order && (
          <div className="mt-5 space-y-1.5 rounded-xl border border-border bg-muted/40 p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Paket</span><span className="font-medium">{order.planName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Jumlah</span><span className="font-medium tabular-nums">{rupiah(order.amountIdr)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><span className="font-mono text-xs">{order.merchantOrderId}</span></div>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <ActionLink href="/dashboard" variant="outline">Ke Dashboard</ActionLink>
          <ActionLink href="/billing">Lihat Paket</ActionLink>
        </div>
      </div>
    </div>
  );
}
