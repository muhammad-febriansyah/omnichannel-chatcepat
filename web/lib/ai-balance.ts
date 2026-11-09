import "server-only";
import { and, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { aiCreditBuckets, aiCreditPacks, aiUsage } from "./db/schema";

export type AiBalance = {
  remaining: number;
  monthlyAllowance: number;
  usedThisMonth: number;
  buckets: { id: string; source: string; total: number; used: number; expiresAt: string | null; note: string | null }[];
  usage30d: { feature: string; calls: number; charged: number }[];
};

// Start of the current month in WIB, as an ISO instant (matches the engine bucket key).
function wibMonthStart(): string {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 7 * 3_600_000).toISOString();
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// Read-only view of a tenant's AI tokens. The engine creates this month's plan
// bucket on first use; until then the allowance is counted as available.
export async function loadAiBalance(tenantId: string, monthlyAllowance: number): Promise<AiBalance> {
  const monthStart = wibMonthStart();
  const [buckets, usage, monthUse] = await Promise.all([
    db
      .select()
      .from(aiCreditBuckets)
      .where(
        and(
          eq(aiCreditBuckets.tenantId, tenantId),
          or(isNull(aiCreditBuckets.expiresAt), gt(aiCreditBuckets.expiresAt, sql`now()`)),
        ),
      )
      .orderBy(aiCreditBuckets.expiresAt),
    db
      .select({
        feature: aiUsage.feature,
        calls: sql<number>`count(*)::int`,
        charged: sql<number>`coalesce(sum(${aiUsage.chargedTokens}), 0)::bigint`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.tenantId, tenantId), gte(aiUsage.createdAt, daysAgo(30))))
      .groupBy(aiUsage.feature),
    db
      .select({ n: sql<number>`coalesce(sum(${aiUsage.chargedTokens}), 0)::bigint` })
      .from(aiUsage)
      .where(and(eq(aiUsage.tenantId, tenantId), gte(aiUsage.createdAt, monthStart))),
  ]);
  const hasPlanBucket = buckets.some((b) => b.source === "plan" && b.periodStart && new Date(b.periodStart).toISOString() === monthStart);
  const remaining =
    buckets.reduce((sum, b) => sum + Math.max(0, b.tokensTotal - b.tokensUsed), 0) + (hasPlanBucket ? 0 : monthlyAllowance);
  return {
    remaining,
    monthlyAllowance,
    usedThisMonth: Number(monthUse[0]?.n ?? 0),
    buckets: buckets.map((b) => ({ id: b.id, source: b.source, total: b.tokensTotal, used: b.tokensUsed, expiresAt: b.expiresAt, note: b.note })),
    usage30d: usage.map((u) => ({ feature: u.feature, calls: u.calls, charged: Number(u.charged) })),
  };
}

export async function listTopupPacks() {
  return db.query.aiCreditPacks.findMany({
    where: eq(aiCreditPacks.isActive, true),
    orderBy: [aiCreditPacks.sortOrder, desc(aiCreditPacks.tokens)],
  });
}
