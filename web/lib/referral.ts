import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { referralAccounts, referralCommissions, referralSettings, referrals, tenants, users } from "./db/schema";

// Cookie set by middleware when someone opens any page with ?ref=CODE.
export const REF_COOKIE = "cc_ref";
export const REF_COOKIE_MAX_AGE = 30 * 86_400;
export const CODE_RE = /^[A-Z0-9]{4,20}$/;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

export type ReferralSettings = typeof referralSettings.$inferSelect;

const DEFAULT_SETTINGS: ReferralSettings = {
  id: 1,
  isEnabled: true,
  commissionPercent: 20,
  holdDays: 14,
  minPayoutIdr: 100_000,
  updatedAt: new Date(0).toISOString(),
};

/** Uppercase, letters and digits only. Empty string when nothing usable is left. */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

export async function getReferralSettings(exec: Exec = db): Promise<ReferralSettings> {
  const [row] = await exec.select().from(referralSettings).where(eq(referralSettings.id, 1));
  return row ?? DEFAULT_SETTINGS;
}

// Same mailbox written differently: drop "+tag" everywhere, and dots for Gmail.
function mailbox(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  let l = local.split("+")[0];
  if (d === "gmail.com") l = l.replace(/\./g, "");
  return `${l}@${d}`;
}

/**
 * Resolve the code a new signup typed (or carried in the cookie) to the referrer tenant.
 * Throws a readable message for an unknown code or for someone referring themselves.
 */
export async function resolveReferralCode(rawCode: string, signupEmail: string): Promise<{ tenantId: string; code: string } | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const settings = await getReferralSettings();
  if (!settings.isEnabled) return null; // program off: sign up normally, no referral
  const account = await db.query.referralAccounts.findFirst({
    columns: { tenantId: true, code: true, isActive: true },
    where: eq(referralAccounts.code, code),
  });
  if (!account || !account.isActive) throw new ReferralCodeError("Kode referral tidak ditemukan");
  const owners = await db.select({ email: users.email }).from(users).where(eq(users.tenantId, account.tenantId));
  const me = mailbox(signupEmail);
  if (owners.some((u) => mailbox(u.email) === me)) throw new ReferralCodeError("Kode referral tidak bisa dipakai untuk akun sendiri");
  return { tenantId: account.tenantId, code: account.code };
}

export class ReferralCodeError extends Error {}

/**
 * Called inside the Duitku callback transaction when a plan order is paid. The first paid
 * plan of a referred tenant earns the referrer a commission; later orders earn nothing.
 * Idempotent: the referral row is locked and order_id is unique.
 */
export async function recordReferralCommission(
  tx: Tx,
  order: { id: string; tenantId: string; planName: string; amountIdr: number },
  now: Date,
): Promise<void> {
  const [ref] = await tx
    .select({ id: referrals.id, tenantId: referrals.tenantId })
    .from(referrals)
    .where(and(eq(referrals.referredTenantId, order.tenantId), eq(referrals.status, "pending")))
    .for("update");
  if (!ref) return;

  const settings = await getReferralSettings(tx);
  const commission = Math.floor((order.amountIdr * settings.commissionPercent) / 100);
  if (commission > 0) {
    const [referred] = await tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, order.tenantId));
    await tx
      .insert(referralCommissions)
      .values({
        tenantId: ref.tenantId,
        referralId: ref.id,
        referredTenantId: order.tenantId,
        orderId: order.id,
        referredName: referred?.name ?? "—",
        planName: order.planName,
        orderAmountIdr: order.amountIdr,
        commissionPercent: settings.commissionPercent,
        commissionIdr: commission,
        availableAt: new Date(now.getTime() + settings.holdDays * 86_400_000).toISOString(),
      })
      .onConflictDoNothing();
  }
  await tx
    .update(referrals)
    .set({ status: "converted", convertedAt: now.toISOString() })
    .where(eq(referrals.id, ref.id));
}

export type ReferralBalance = {
  heldIdr: number; // earned, still in the hold period
  availableIdr: number; // earned, past hold, not in a payout
  processingIdr: number; // in an open payout request
  paidIdr: number;
};

export async function loadReferralBalance(tenantId: string): Promise<ReferralBalance> {
  const [row] = await db
    .select({
      held: sql<number>`coalesce(sum(${referralCommissions.commissionIdr}) filter (where ${referralCommissions.status} = 'earned' and ${referralCommissions.payoutId} is null and ${referralCommissions.availableAt} > now()), 0)::bigint`,
      available: sql<number>`coalesce(sum(${referralCommissions.commissionIdr}) filter (where ${referralCommissions.status} = 'earned' and ${referralCommissions.payoutId} is null and ${referralCommissions.availableAt} <= now()), 0)::bigint`,
      processing: sql<number>`coalesce(sum(${referralCommissions.commissionIdr}) filter (where ${referralCommissions.status} = 'earned' and ${referralCommissions.payoutId} is not null), 0)::bigint`,
      paid: sql<number>`coalesce(sum(${referralCommissions.commissionIdr}) filter (where ${referralCommissions.status} = 'paid'), 0)::bigint`,
    })
    .from(referralCommissions)
    .where(eq(referralCommissions.tenantId, tenantId));
  return {
    heldIdr: Number(row?.held ?? 0),
    availableIdr: Number(row?.available ?? 0),
    processingIdr: Number(row?.processing ?? 0),
    paidIdr: Number(row?.paid ?? 0),
  };
}

/** Suggested code from the business name, e.g. "Toko Budi Jaya" → "TOKOBUDIJ". Made unique with digits. */
export async function suggestCode(name: string): Promise<string> {
  let base = normalizeCode(name).slice(0, 9);
  if (base.length < 4) base = (base + "CEPAT").slice(0, 9);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(100 + Math.random() * 900)}`;
    const taken = await db.query.referralAccounts.findFirst({ columns: { id: true }, where: eq(referralAccounts.code, candidate) });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
