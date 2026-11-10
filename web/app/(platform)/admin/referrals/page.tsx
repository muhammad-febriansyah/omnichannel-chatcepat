import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Banknote, Clock, Coins, Settings2, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { referralCommissions, referralPayouts, referrals, tenants } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { getReferralSettings } from "@/lib/referral";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AdminCommissionsTable, AdminPayoutsTable, ReferralSettingsForm } from "@/components/app/referral/referral-admin";

type Tab = "pencairan" | "komisi" | "pengaturan";
const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "pencairan", label: "Penarikan", icon: Banknote },
  { value: "komisi", label: "Komisi", icon: Coins },
  { value: "pengaturan", label: "Pengaturan", icon: Settings2 },
];

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) notFound();
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "pencairan";

  const [settings, [totals], [refCounts]] = await Promise.all([
    getReferralSettings(),
    db
      .select({
        open: sql<number>`coalesce(sum(${referralPayouts.amountIdr}) filter (where ${referralPayouts.status} = 'requested'), 0)::bigint`,
        openCount: sql<number>`count(*) filter (where ${referralPayouts.status} = 'requested')::int`,
        paid: sql<number>`coalesce(sum(${referralPayouts.amountIdr}) filter (where ${referralPayouts.status} = 'paid'), 0)::bigint`,
      })
      .from(referralPayouts),
    db
      .select({
        total: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${referrals.status} = 'converted')::int`,
        owed: sql<number>`(select coalesce(sum(commission_idr), 0) from referral_commissions where status = 'earned')::bigint`,
      })
      .from(referrals),
  ]);

  const cards = [
    { label: `Menunggu transfer (${totals?.openCount ?? 0})`, value: rupiah(Number(totals?.open ?? 0)), icon: Clock, tone: "#f59e0b" },
    { label: "Komisi belum dibayar", value: rupiah(Number(refCounts?.owed ?? 0)), icon: Wallet, tone: "#2547f9" },
    { label: "Sudah ditransfer", value: rupiah(Number(totals?.paid ?? 0)), icon: Banknote, tone: "#10b981" },
    { label: "Daftar via referral", value: `${refCounts?.total ?? 0} · ${refCounts?.converted ?? 0} bayar`, icon: Users, tone: "#8b5cf6" },
  ];

  let body: React.ReactNode;
  if (tab === "pengaturan") {
    body = (
      <ReferralSettingsForm
        initial={{
          isEnabled: settings.isEnabled,
          commissionPercent: settings.commissionPercent,
          holdDays: settings.holdDays,
          minPayoutIdr: settings.minPayoutIdr,
        }}
      />
    );
  } else if (tab === "komisi") {
    const rows = await db
      .select({ c: referralCommissions, referrerName: tenants.name })
      .from(referralCommissions)
      .innerJoin(tenants, eq(tenants.id, referralCommissions.tenantId))
      .orderBy(desc(referralCommissions.createdAt))
      .limit(500);
    body = (
      <Card>
        <CardContent>
          <AdminCommissionsTable
            rows={rows.map(({ c, referrerName }) => ({
              id: c.id,
              referrerName,
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
    );
  } else {
    // Open requests first, then newest.
    const rows = await db
      .select({ p: referralPayouts, tenantName: tenants.name })
      .from(referralPayouts)
      .innerJoin(tenants, eq(tenants.id, referralPayouts.tenantId))
      .orderBy(sql`(${referralPayouts.status} = 'requested') desc`, desc(referralPayouts.createdAt))
      .limit(500);
    body = (
      <Card>
        <CardContent>
          <AdminPayoutsTable rows={rows.map(({ p, tenantName }) => ({ ...p, tenantName }))} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        title="Referral"
        description={`Komisi ${settings.commissionPercent}% dari paket pertama, ditahan ${settings.holdDays} hari, minimal tarik ${rupiah(settings.minPayoutIdr)}.${settings.isEnabled ? "" : " Program sedang nonaktif."}`}
        tabs={
          <div className="inline-flex flex-wrap gap-1 rounded-[20px] border border-border bg-card p-1 shadow-sm">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={t.value === "pencairan" ? "/admin/referrals" : `/admin/referrals?tab=${t.value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  t.value === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[20px] bg-card p-4">
            <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}>
              <c.icon className="size-[18px]" />
            </span>
            <div className="mt-3 text-xl font-bold tracking-tight tabular-nums">{c.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {body}
    </div>
  );
}
