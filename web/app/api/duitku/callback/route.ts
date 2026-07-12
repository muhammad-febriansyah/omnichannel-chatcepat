import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, tenants } from "@/lib/db/schema";
import { verifyCallbackSignature } from "@/lib/duitku";

// Callback Duitku (server-to-server, x-www-form-urlencoded).
// Verifikasi signature MD5, lalu tandai order lunas + auto-naik paket tenant.
// Idempoten: hanya bertindak saat order masih 'pending'.
export async function POST(req: Request) {
  const form = await req.formData();
  const get = (k: string) => (form.get(k) ?? "").toString();

  const merchantCode = get("merchantCode");
  const amount = get("amount");
  const merchantOrderId = get("merchantOrderId");
  const resultCode = get("resultCode");
  const signature = get("signature");
  const reference = get("reference");
  const paymentCode = get("paymentCode");

  if (!verifyCallbackSignature({ merchantCode, amount, merchantOrderId, signature })) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const order = await db.query.orders.findFirst({ where: eq(orders.merchantOrderId, merchantOrderId) });
  if (!order) return new NextResponse("Order not found", { status: 404 });

  // Cross-check nilai bayar vs order (defense-in-depth; signature sudah lindungi amount).
  if (Math.round(Number(amount)) !== Number(order.amountIdr)) {
    return new NextResponse("Amount mismatch", { status: 400 });
  }

  const raw = Object.fromEntries(form.entries());

  // resultCode "00" = sukses. Lainnya = gagal.
  if (resultCode === "00") {
    if (order.status !== "paid") {
      await db
        .update(orders)
        .set({
          status: "paid",
          duitkuReference: reference || order.duitkuReference,
          paymentMethod: paymentCode || null,
          paidAt: new Date().toISOString(),
          raw,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, order.id));
      // Auto-aktivasi: naikkan paket + perpanjang masa aktif 30 hari. Bila masih
      // aktif, extend dari tanggal habis lama (bukan reset ke hari ini).
      const t = await db.query.tenants.findFirst({
        where: eq(tenants.id, order.tenantId),
        columns: { planExpiresAt: true },
      });
      const now = Date.now();
      const cur = t?.planExpiresAt ? new Date(t.planExpiresAt).getTime() : 0;
      const base = cur > now ? cur : now;
      const newExpiry = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .update(tenants)
        .set({ plan: order.tier, planExpiresAt: newExpiry, updatedAt: new Date().toISOString() })
        .where(eq(tenants.id, order.tenantId));
    }
  } else if (order.status === "pending") {
    await db.update(orders).set({ status: "failed", raw, updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id));
  }

  return new NextResponse("OK", { status: 200 });
}
