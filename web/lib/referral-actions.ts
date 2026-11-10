"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { userError } from "./action-error";
import { db } from "./db";
import { referralAccounts, referralCommissions, referralPayouts, referralSettings, tenants } from "./db/schema";
import { requireSession, type Session } from "./session";
import { requireAbility } from "./rbac";
import { writeAudit } from "./audit";
import { CODE_RE, getReferralSettings, normalizeCode, suggestCode } from "./referral";

// --- Tenant side: own code, bank details, withdrawal ---

async function tenantSession(): Promise<Session & { tenantId: string }> {
  const session = await requireSession();
  requireAbility(session, "billing.tenant");
  // The platform admin has no referral earnings of its own, even while viewing a tenant.
  if (session.isPlatformAdmin || !session.tenantId) throw userError("Fitur referral hanya untuk akun tenant");
  return session as Session & { tenantId: string };
}

export async function activateReferral() {
  const session = await tenantSession();
  const settings = await getReferralSettings();
  if (!settings.isEnabled) throw userError("Program referral sedang tidak aktif");
  const existing = await db.query.referralAccounts.findFirst({ columns: { id: true }, where: eq(referralAccounts.tenantId, session.tenantId) });
  if (!existing) {
    const tenant = await db.query.tenants.findFirst({ columns: { name: true }, where: eq(tenants.id, session.tenantId) });
    const code = await suggestCode(tenant?.name ?? session.tenantName ?? "");
    await db.insert(referralAccounts).values({ tenantId: session.tenantId, code }).onConflictDoNothing();
    await writeAudit(session, { action: "referral.activate", targetType: "referral_account", targetLabel: code });
  }
  revalidatePath("/referral");
}

export interface ReferralAccountInput {
  code: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export async function saveReferralAccount(input: ReferralAccountInput) {
  const session = await tenantSession();
  const code = normalizeCode(input.code);
  if (!CODE_RE.test(code)) throw userError("Kode referral 4–20 karakter, huruf dan angka saja");
  const bankName = input.bankName.trim();
  const accountNumber = input.accountNumber.replace(/[^0-9]/g, "");
  const accountName = input.accountName.trim();
  const anyBank = bankName || accountNumber || accountName;
  if (anyBank && (!bankName || !accountNumber || !accountName)) throw userError("Lengkapi nama bank, nomor rekening, dan nama pemilik rekening");
  if (accountNumber && (accountNumber.length < 5 || accountNumber.length > 30)) throw userError("Nomor rekening tidak valid");

  const account = await db.query.referralAccounts.findFirst({ columns: { id: true }, where: eq(referralAccounts.tenantId, session.tenantId) });
  if (!account) throw userError("Aktifkan referral terlebih dahulu");
  const taken = await db.query.referralAccounts.findFirst({
    columns: { id: true },
    where: and(eq(referralAccounts.code, code), ne(referralAccounts.tenantId, session.tenantId)),
  });
  if (taken) throw userError("Kode referral sudah dipakai, coba kode lain");

  try {
    await db
      .update(referralAccounts)
      .set({
        code,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountName: accountName || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(referralAccounts.tenantId, session.tenantId));
  } catch (e) {
    // Lost a race for the same code.
    if (String((e as { code?: string })?.code) === "23505") throw userError("Kode referral sudah dipakai, coba kode lain");
    throw e;
  }
  await writeAudit(session, { action: "referral.account.update", targetType: "referral_account", targetId: account.id, targetLabel: code });
  revalidatePath("/referral");
  redirect("/referral");
}

export async function requestPayout() {
  const session = await tenantSession();
  const settings = await getReferralSettings();

  const result = await db.transaction(async (tx) => {
    // Lock the tenant's referral account so two clicks can't both claim the same commissions.
    const [account] = await tx.select().from(referralAccounts).where(eq(referralAccounts.tenantId, session.tenantId)).for("update");
    if (!account) return { error: "Aktifkan referral terlebih dahulu" };
    if (!account.bankName || !account.accountNumber || !account.accountName) return { error: "Isi rekening pencairan terlebih dahulu" };
    const [open] = await tx
      .select({ id: referralPayouts.id })
      .from(referralPayouts)
      .where(and(eq(referralPayouts.tenantId, session.tenantId), eq(referralPayouts.status, "requested")));
    if (open) return { error: "Masih ada penarikan yang sedang diproses" };

    const ready = and(
      eq(referralCommissions.tenantId, session.tenantId),
      eq(referralCommissions.status, "earned"),
      isNull(referralCommissions.payoutId),
      lte(referralCommissions.availableAt, sql`now()`),
    );
    const [{ total }] = await tx
      .select({ total: sql<number>`coalesce(sum(${referralCommissions.commissionIdr}), 0)::bigint` })
      .from(referralCommissions)
      .where(ready);
    const amount = Number(total);
    if (amount <= 0) return { error: "Belum ada komisi yang bisa ditarik" };
    if (amount < settings.minPayoutIdr) {
      return { error: `Minimal penarikan Rp${settings.minPayoutIdr.toLocaleString("id-ID")}` };
    }

    const [payout] = await tx
      .insert(referralPayouts)
      .values({
        tenantId: session.tenantId,
        amountIdr: amount,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        requestedBy: session.id,
      })
      .returning({ id: referralPayouts.id });
    await tx.update(referralCommissions).set({ payoutId: payout.id, updatedAt: new Date().toISOString() }).where(ready);
    return { id: payout.id, amount };
  });

  if ("error" in result) throw userError(result.error!);
  await writeAudit(session, { action: "referral.payout.request", targetType: "referral_payout", targetId: result.id, metadata: { amountIdr: result.amount } });
  revalidatePath("/referral");
  revalidatePath("/admin/referrals");
}

// --- Platform admin: settings, payouts, commissions ---

async function adminSession(): Promise<Session> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya superadmin");
  return session;
}

export interface ReferralSettingsInput {
  isEnabled: boolean;
  commissionPercent: number;
  holdDays: number;
  minPayoutIdr: number;
}

export async function saveReferralSettings(input: ReferralSettingsInput) {
  const session = await adminSession();
  const percent = Math.round(Number(input.commissionPercent));
  const holdDays = Math.round(Number(input.holdDays));
  const minPayout = Math.round(Number(input.minPayoutIdr));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw userError("Persen komisi harus 0–100");
  if (!Number.isFinite(holdDays) || holdDays < 0 || holdDays > 365) throw userError("Masa tahan harus 0–365 hari");
  if (!Number.isSafeInteger(minPayout) || minPayout < 0) throw userError("Minimal penarikan tidak valid");
  const values = { isEnabled: !!input.isEnabled, commissionPercent: percent, holdDays, minPayoutIdr: minPayout, updatedAt: new Date().toISOString() };
  await db
    .insert(referralSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: referralSettings.id, set: values });
  await writeAudit(session, { action: "referral.settings.update", targetType: "referral_settings", metadata: values });
  revalidatePath("/admin/referrals");
  revalidatePath("/referral");
}

export async function markPayoutPaid(payoutId: string) {
  const session = await adminSession();
  const now = new Date().toISOString();
  const done = await db.transaction(async (tx) => {
    const [p] = await tx
      .update(referralPayouts)
      .set({ status: "paid", processedBy: session.id, processedAt: now, updatedAt: now })
      .where(and(eq(referralPayouts.id, payoutId), eq(referralPayouts.status, "requested")))
      .returning({ id: referralPayouts.id, tenantId: referralPayouts.tenantId, amountIdr: referralPayouts.amountIdr });
    if (!p) return null;
    await tx.update(referralCommissions).set({ status: "paid", updatedAt: now }).where(eq(referralCommissions.payoutId, p.id));
    return p;
  });
  if (!done) throw userError("Penarikan tidak ditemukan atau sudah diproses");
  await writeAudit(session, { action: "referral.payout.paid", targetType: "referral_payout", targetId: payoutId, tenantId: done.tenantId, metadata: { amountIdr: done.amountIdr } });
  revalidatePath("/admin/referrals");
}

export async function rejectPayout(payoutId: string, note: string) {
  const session = await adminSession();
  const reason = note.trim();
  if (!reason) throw userError("Alasan penolakan wajib diisi");
  const now = new Date().toISOString();
  const done = await db.transaction(async (tx) => {
    const [p] = await tx
      .update(referralPayouts)
      .set({ status: "rejected", note: reason, processedBy: session.id, processedAt: now, updatedAt: now })
      .where(and(eq(referralPayouts.id, payoutId), eq(referralPayouts.status, "requested")))
      .returning({ id: referralPayouts.id, tenantId: referralPayouts.tenantId });
    if (!p) return null;
    // Commissions go back to the tenant's balance.
    await tx.update(referralCommissions).set({ payoutId: null, updatedAt: now }).where(eq(referralCommissions.payoutId, p.id));
    return p;
  });
  if (!done) throw userError("Penarikan tidak ditemukan atau sudah diproses");
  await writeAudit(session, { action: "referral.payout.reject", targetType: "referral_payout", targetId: payoutId, tenantId: done.tenantId, metadata: { note: reason } });
  revalidatePath("/admin/referrals");
}

export async function voidCommission(commissionId: string, reason: string) {
  const session = await adminSession();
  const why = reason.trim();
  if (!why) throw userError("Alasan pembatalan wajib diisi");
  // Only commissions not yet in a payout; reject the payout first otherwise.
  const [c] = await db
    .update(referralCommissions)
    .set({ status: "void", voidReason: why, updatedAt: new Date().toISOString() })
    .where(and(eq(referralCommissions.id, commissionId), eq(referralCommissions.status, "earned"), isNull(referralCommissions.payoutId)))
    .returning({ id: referralCommissions.id, tenantId: referralCommissions.tenantId, commissionIdr: referralCommissions.commissionIdr });
  if (!c) throw userError("Komisi tidak bisa dibatalkan (sudah dalam penarikan atau sudah dibayar)");
  await writeAudit(session, { action: "referral.commission.void", targetType: "referral_commission", targetId: c.id, tenantId: c.tenantId, metadata: { reason: why, commissionIdr: c.commissionIdr } });
  revalidatePath("/admin/referrals");
}
