import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { PLAN_QUOTA, type TenantPlan, type SidebarStats } from "./plan";

const FALLBACK: SidebarStats = {
  plan: "pro",
  channelsConnected: 0,
  channelsTotal: 0,
  messagesSent: 0,
  quota: PLAN_QUOTA.pro,
};

export async function getSidebarStats(tenantId: string | null): Promise<SidebarStats> {
  if (!tenantId) return FALLBACK;
  try {
    const t = `'${tenantId}'`;
    const row = async (q: string) => {
      const r = await db.execute(sql.raw(q));
      const rows = r as unknown as Array<Record<string, unknown>>;
      return rows[0] ?? {};
    };
    const planRow = await row(`select plan from tenants where id=${t}`);
    const plan = ((planRow.plan as TenantPlan) ?? "pro") as TenantPlan;
    const ch = await row(
      `select count(*)::int total, count(*) filter (where status='connected')::int connected from channels where tenant_id=${t}`,
    );
    const msg = await row(
      `select count(*)::int n from messages where tenant_id=${t} and direction='outbound' and status in ('sent','delivered','read') and created_at >= date_trunc('month', now())`,
    );
    return {
      plan,
      channelsConnected: Number(ch.connected ?? 0),
      channelsTotal: Number(ch.total ?? 0),
      messagesSent: Number(msg.n ?? 0),
      quota: PLAN_QUOTA[plan] ?? null,
    };
  } catch {
    return FALLBACK;
  }
}
