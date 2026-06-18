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
      // Auto-aktivasi: naikkan paket tenant sesuai tier yang dibeli.
      await db.update(tenants).set({ plan: order.tier, updatedAt: new Date().toISOString() }).where(eq(tenants.id, order.tenantId));
    }
  } else if (order.status === "pending") {
    await db.update(orders).set({ status: "failed", raw, updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id));
  }

  return new NextResponse("OK", { status: 200 });
}
