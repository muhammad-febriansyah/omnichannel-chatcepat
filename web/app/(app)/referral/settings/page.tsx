import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePageAbility } from "@/lib/session";
import { db } from "@/lib/db";
import { referralAccounts } from "@/lib/db/schema";
import { ReferralAccountForm } from "@/components/app/referral/referral-account-form";

export default async function ReferralSettingsPage() {
  const session = await requirePageAbility("billing.tenant");
  if (session.isPlatformAdmin) redirect("/admin/referrals");
  const account = await db.query.referralAccounts.findFirst({ where: eq(referralAccounts.tenantId, session.tenantId!) });
  if (!account) redirect("/referral");
  return (
    <ReferralAccountForm
      initial={{
        code: account.code,
        bankName: account.bankName ?? "",
        accountNumber: account.accountNumber ?? "",
        accountName: account.accountName ?? "",
      }}
    />
  );
}
