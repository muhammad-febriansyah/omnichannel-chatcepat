import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Clock, Gift, Hourglass, Landmark, Pencil, Users, Wallet } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { db } from "@/lib/db";
import { referralAccounts, referralCommissions, referralPayouts, referrals, tenants } from "@/lib/db/schema";
import { getReferralSettings, loadReferralBalance } from "@/lib/referral";
import { activateReferral } from "@/lib/referral-actions";
import { rupiah } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { SubmitButton } from "@/components/app/submit-button";
import { ActionLink } from "@/components/app/action-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CommissionsTable,
  CopyButton,
  PayoutsTable,
  ReferredTable,
  RequestPayoutButton,
} from "@/components/app/referral/referral-client";

export default async function ReferralPage() {
  const session = await requirePageAbility("billing.tenant");
  if (session.isPlatformAdmin) redirect("/admin/referrals");
  const tenantId = session.tenantId!;

  const [settings, account] = await Promise.all([
    getReferralSettings(),
    db.query.referralAccounts.findFirst({ where: eq(referralAccounts.tenantId, tenantId) }),
  ]);

  const steps = [
    { icon: Gift, title: "Bagikan kode", text: "Kirim link atau kode Anda ke rekan bisnis." },
    { icon: Users, title: "Mereka daftar", text: "Saat daftar, kode Anda otomatis tercatat." },
    { icon: Wallet, title: "Dapat komisi", text: `${settings.commissionPercent}% dari pembayaran paket pertama mereka.` },
  ];

  if (!account) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Referral" description="Ajak bisnis lain pakai ChatCepat dan dapatkan komisi." />
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Dapat {settings.commissionPercent}% komisi untuk tiap bisnis yang Anda ajak</CardTitle>
            <CardDescription>
              Komisi dihitung dari pembayaran paket pertama bisnis yang daftar memakai kode Anda, lalu bisa dicairkan ke rekening.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-xl bg-muted/50 p-4">
                  <s.icon className="size-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">
                    {i + 1}. {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
            {settings.isEnabled ? (
              <form action={activateReferral}>
                <SubmitButton pendingText="Membuat kode…">
                  <Gift className="size-4" /> Aktifkan referral
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Program referral sedang tidak aktif.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [balance, referred, commissions, payouts] = await Promise.all([
    loadReferralBalance(tenantId),
    db
      .select({ id: referrals.id, name: tenants.name, status: referrals.status, createdAt: referrals.createdAt, convertedAt: referrals.convertedAt })
      .from(referrals)
      .innerJoin(tenants, eq(tenants.id, referrals.referredTenantId))
      .where(eq(referrals.tenantId, tenantId))
      .orderBy(desc(referrals.createdAt))
      .limit(500),
    db
      .select()
      .from(referralCommissions)
      .where(eq(referralCommissions.tenantId, tenantId))
      .orderBy(desc(referralCommissions.createdAt))
      .limit(500),
    db
      .select()
      .from(referralPayouts)
      .where(eq(referralPayouts.tenantId, tenantId))
      .orderBy(desc(referralPayouts.createdAt))
      .limit(100),
  ]);

  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${base}/register?ref=${account.code}`;
  const hasBank = !!(account.bankName && account.accountNumber && account.accountName);
  const openPayout = payouts.some((p) => p.status === "requested");
  const canWithdraw = hasBank && !openPayout && balance.availableIdr > 0 && balance.availableIdr >= settings.minPayoutIdr;
  const converted = referred.filter((r) => r.status === "converted").length;

  const stats = [
    { label: "Bisa ditarik", value: rupiah(balance.availableIdr), icon: Wallet, tone: "#2547f9" },
    { label: `Tertahan (${settings.holdDays} hari)`, value: rupiah(balance.heldIdr), icon: Hourglass, tone: "#f59e0b" },
    { label: "Sedang diproses", value: rupiah(balance.processingIdr), icon: Clock, tone: "#8b5cf6" },
    { label: "Sudah ditransfer", value: rupiah(balance.paidIdr), icon: Landmark, tone: "#10b981" },
  ];

  let withdrawHint = `Minimal penarikan ${rupiah(settings.minPayoutIdr)}.`;
  if (!hasBank) withdrawHint = "Isi rekening pencairan dulu lewat tombol Ubah.";
  else if (openPayout) withdrawHint = "Penarikan sebelumnya masih diproses admin.";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Referral"
        description={`Komisi ${settings.commissionPercent}% dari pembayaran paket pertama bisnis yang daftar memakai kode Anda.`}
        actions={
          <ActionLink href="/referral/settings" variant="outline">
            <Pencil className="size-4" /> Ubah kode & rekening
          </ActionLink>
        }
      />

      {!account.isActive && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Kode referral Anda dinonaktifkan admin. Pendaftaran baru tidak lagi tercatat.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardDescription>Kode referral Anda</CardDescription>
            <CardTitle className="font-mono text-3xl tracking-wider">{account.code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="block truncate rounded-lg bg-muted px-3 py-2 text-xs">{link}</code>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={link} label="Salin link" />
              <CopyButton value={account.code} label="Salin kode" />
            </div>
            <p className="text-xs text-muted-foreground">
              {referred.length} bisnis daftar · {converted} sudah bayar paket
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Saldo bisa ditarik</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rupiah(balance.availableIdr)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasBank ? `${account.bankName} · ${account.accountNumber} a.n. ${account.accountName}` : "Rekening pencairan belum diisi."}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <RequestPayoutButton disabled={!canWithdraw} />
            <p className="text-xs text-muted-foreground">{withdrawHint}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((c) => (
          <div key={c.label} className="rounded-[20px] bg-card p-4">
            <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}>
              <c.icon className="size-[18px]" />
            </span>
            <div className="mt-3 text-xl font-bold tracking-tight tabular-nums">{c.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Komisi</h2>
        <Card>
          <CardContent>
            <CommissionsTable
              rows={commissions.map((c) => ({
                id: c.id,
                referredName: c.referredName,
                planName: c.planName,
                orderAmountIdr: c.orderAmountIdr,
                commissionPercent: c.commissionPercent,
                commissionIdr: c.commissionIdr,
                status: c.status,
                inPayout: !!c.payoutId,
                availableAt: c.availableAt,
                createdAt: c.createdAt,
                voidReason: c.voidReason,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Bisnis yang Anda ajak</h2>
          <Card>
            <CardContent>
              <ReferredTable rows={referred} />
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">Riwayat penarikan</h2>
          <Card>
            <CardContent>
              <PayoutsTable rows={payouts} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
