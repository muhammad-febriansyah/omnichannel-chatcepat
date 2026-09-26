import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, tenants } from "@/lib/db/schema";
import { verifyCallbackSignature } from "@/lib/duitku";
import { subscriptionExpiry } from "@/lib/subscription";

export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return new NextResponse("Invalid form", { status: 400 }); }
  const get = (key: string) => (form.get(key) ?? "").toString();
  const merchantCode = get("merchantCode");
  const amount = get("amount");
  const merchantOrderId = get("merchantOrderId");
  const signature = get("signature");
  if (!verifyCallbackSignature({ merchantCode, amount, merchantOrderId, signature })) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const outcome = await db.transaction(async (tx) => {
    // Serialize duplicate callbacks, including callbacks handled by different workers.
    const [order] = await tx.select({ id: orders.id, tenantId: orders.tenantId, status: orders.status, amountIdr: orders.amountIdr, duitkuReference: orders.duitkuReference, tier: orders.tier, period: orders.period }).from(orders)
      .where(eq(orders.merchantOrderId, merchantOrderId)).for("update");
    if (!order) return { message: "Order not found", status: 404 };
    if (!Number.isSafeInteger(Number(amount)) || Number(amount) !== order.amountIdr) {
      return { message: "Amount mismatch", status: 400 };
    }
    if (order.duitkuReference && get("reference") !== order.duitkuReference) {
      return { message: "Reference mismatch", status: 400 };
    }
    if (order.status === "paid") return { message: "OK", status: 200 };
    const now = new Date();
    const raw = Object.fromEntries(form.entries());
    if (get("resultCode") === "00") {
      // Different orders for one tenant must not overwrite each other's extension.
      const [tenant] = await tx.select({ planExpiresAt: tenants.planExpiresAt }).from(tenants)
        .where(eq(tenants.id, order.tenantId)).for("update");
      if (!tenant) return { message: "Tenant not found", status: 404 };
      await tx.update(orders).set({
        status: "paid", duitkuReference: get("reference") || order.duitkuReference,
        paymentMethod: get("paymentCode") || null, paidAt: now.toISOString(),
        raw, updatedAt: now.toISOString(),
      }).where(eq(orders.id, order.id));
      await tx.update(tenants).set({
        plan: order.tier,
        planExpiresAt: subscriptionExpiry(tenant.planExpiresAt, order.period, now.getTime()),
        updatedAt: now.toISOString(),
      }).where(eq(tenants.id, order.tenantId));
    } else if (order.status === "pending") {
      await tx.update(orders).set({ status: "failed", raw, updatedAt: now.toISOString() })
        .where(eq(orders.id, order.id));
    }
    return { message: "OK", status: 200 };
  });
  return new NextResponse(outcome.message, { status: outcome.status });
}
