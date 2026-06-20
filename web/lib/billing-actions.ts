"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { plans, orders } from "./db/schema";
import { requireSession } from "./session";
import { requireAbility } from "./rbac";
import { createInvoice } from "./duitku";

export type Tier = "pro" | "business" | "enterprise";

export interface PlanInput {
  tier: Tier;
  name: string;
  slug: string;
  priceIdr: number;
  period: string; // month | year
  quota: number | null;
  description: string;
  features: string[];
  isActive: boolean;
  highlight: boolean;
  sortOrder: number;
}

function clean(input: PlanInput) {
  return {
    tier: input.tier,
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    priceIdr: Math.max(0, Math.round(input.priceIdr || 0)),
    period: input.period === "year" ? "year" : "month",
    quota: input.quota == null || Number.isNaN(input.quota) ? null : Math.max(0, Math.round(input.quota)),
    description: input.description.trim() || null,
    features: (input.features ?? []).map((f) => f.trim()).filter(Boolean),
    isActive: !!input.isActive,
    highlight: !!input.highlight,
    sortOrder: Math.round(input.sortOrder || 0),
  };
}

// --- Plan CRUD (super-admin; pricing global). RBAC tenant.manage (03). ---
export async function createPlan(input: PlanInput) {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  const v = clean(input);
  if (!v.name) throw new Error("Nama paket wajib diisi");
  if (!v.slug) throw new Error("Slug wajib diisi");
  await db.insert(plans).values(v);
  revalidatePath("/admin/plans");
  revalidatePath("/");
  redirect("/admin/plans");
}

export async function updatePlan(id: string, input: PlanInput) {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  const v = clean(input);
  if (!v.name) throw new Error("Nama paket wajib diisi");
  await db.update(plans).set({ ...v, updatedAt: new Date().toISOString() }).where(eq(plans.id, id));
  revalidatePath("/admin/plans");
  revalidatePath("/");
  redirect("/admin/plans");
}

export async function deletePlan(id: string) {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  await db.delete(plans).where(eq(plans.id, id));
  revalidatePath("/admin/plans");
  revalidatePath("/");
}

export async function setPlanActive(id: string, active: boolean) {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  await db.update(plans).set({ isActive: active, updatedAt: new Date().toISOString() }).where(eq(plans.id, id));
  revalidatePath("/admin/plans");
  revalidatePath("/");
}

// --- Checkout: buat order + invoice Duitku, lalu redirect ke halaman bayar. ---
// RBAC billing.tenant (admin). Order tenant-scoped, nilai paket di-snapshot.
export async function startCheckout(planId: string) {
  const session = await requireSession();
  requireAbility(session, "billing.tenant");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const plan = await db.query.plans.findFirst({ where: and(eq(plans.id, planId), eq(plans.isActive, true)) });
  if (!plan) throw new Error("Paket tidak ditemukan / tidak aktif");

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  // ID order unik & tak tertebak (hindari koleksi/enumerasi) — crypto, bukan Math.random.
  const merchantOrderId = `CC-${crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;

  const [order] = await db
    .insert(orders)
    .values({
      tenantId: session.tenantId,
      planId: plan.id,
      planName: plan.name,
      tier: plan.tier,
      amountIdr: plan.priceIdr,
      merchantOrderId,
      status: "pending",
      customerName: session.name,
      customerEmail: session.email,
    })
    .returning({ id: orders.id });

  const inv = await createInvoice({
    merchantOrderId,
    amount: plan.priceIdr,
    productDetails: `ChatCepat ${plan.name} (${plan.period === "year" ? "tahunan" : "bulanan"})`,
    email: session.email,
    customerName: session.name,
    callbackUrl: `${base}/api/duitku/callback`,
    returnUrl: `${base}/checkout/return`,
  });

  await db
    .update(orders)
    .set({ duitkuReference: inv.reference, paymentUrl: inv.paymentUrl, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, order.id));

  redirect(inv.paymentUrl);
}

// Paket aktif untuk landing/billing (urut sort_order).
export async function listActivePlans() {
  return db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: [asc(plans.sortOrder), asc(plans.priceIdr)],
  });
}

// Riwayat transaksi tenant (client). Scoped tenant dari sesi — JANGAN dari input.
export async function listOrders() {
  const session = await requireSession();
  requireAbility(session, "billing.tenant");
  if (!session.tenantId) return [];
  try {
    return await db.query.orders.findMany({
      where: eq(orders.tenantId, session.tenantId),
      orderBy: [desc(orders.createdAt)],
      limit: 100,
    });
  } catch {
    return [];
  }
}
