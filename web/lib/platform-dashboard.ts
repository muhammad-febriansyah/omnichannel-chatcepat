import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";

// Superadmin dashboard data: revenue (plans + AI top-ups), transactions, AI tokens,
// tenants and messages over a period of N days (days in WIB).

export type RangeDays = 7 | 30 | 90;

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Row[];
const num = (v: unknown) => Number(v ?? 0);

const FEATURE_LABEL: Record<string, string> = {
  flow_reply: "Balasan AI",
  simulator: "Uji AI",
  embedding: "Pencarian pengetahuan",
};

export async function loadPlatformDashboard(days: RangeDays) {
  // Period = last `days` WIB days incl. today; previous = the `days` before that.
  const start = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(days => ${days - 1})) AT TIME ZONE 'Asia/Jakarta'`;
  const prevStart = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(days => ${2 * days - 1})) AT TIME ZONE 'Asia/Jakarta'`;
  const dayKey = (col: ReturnType<typeof sql>) => sql`to_char(${col} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`;

  const [kpiRows, revDaily, aiDaily, msgDaily, byPlan, byStatus, topTokens, recent, planMix] = await Promise.all([
    rows(sql`
      SELECT
        coalesce(sum(amount_idr) FILTER (WHERE status='paid' AND paid_at >= ${start}), 0)::bigint AS revenue,
        coalesce(sum(amount_idr) FILTER (WHERE status='paid' AND paid_at >= ${prevStart} AND paid_at < ${start}), 0)::bigint AS revenue_prev,
        coalesce(sum(amount_idr) FILTER (WHERE status='paid' AND kind='ai_topup' AND paid_at >= ${start}), 0)::bigint AS topup_revenue,
        count(*) FILTER (WHERE status='paid' AND paid_at >= ${start})::int AS paid,
        count(*) FILTER (WHERE status='paid' AND paid_at >= ${prevStart} AND paid_at < ${start})::int AS paid_prev,
        count(*) FILTER (WHERE status='pending' AND created_at >= ${start})::int AS pending,
        (SELECT count(*) FROM tenants)::int AS tenants,
        (SELECT count(*) FROM tenants WHERE status='active')::int AS tenants_active,
        (SELECT count(*) FROM tenants WHERE created_at >= ${start})::int AS tenants_new,
        (SELECT count(*) FROM tenants WHERE created_at >= ${prevStart} AND created_at < ${start})::int AS tenants_new_prev,
        (SELECT count(*) FROM channels WHERE status='connected')::int AS channels,
        (SELECT coalesce(sum(charged_tokens),0) FROM ai_usage WHERE created_at >= ${start})::bigint AS tokens,
        (SELECT coalesce(sum(charged_tokens),0) FROM ai_usage WHERE created_at >= ${prevStart} AND created_at < ${start})::bigint AS tokens_prev,
        (SELECT count(*) FROM ai_usage WHERE created_at >= ${start})::int AS ai_calls,
        (SELECT count(*) FROM messages WHERE created_at >= ${start})::int AS messages,
        (SELECT count(*) FROM messages WHERE created_at >= ${prevStart} AND created_at < ${start})::int AS messages_prev
      FROM orders`),
    rows(sql`
      WITH d AS (SELECT generate_series(0, ${days - 1}) AS i)
      SELECT to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(days => ${days - 1} - i), 'YYYY-MM-DD') AS day,
        coalesce((SELECT sum(amount_idr) FROM orders o WHERE o.status='paid' AND o.kind='plan'
          AND ${dayKey(sql`o.paid_at`)} = to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(days => ${days - 1} - i), 'YYYY-MM-DD')), 0)::bigint AS plan,
        coalesce((SELECT sum(amount_idr) FROM orders o WHERE o.status='paid' AND o.kind='ai_topup'
          AND ${dayKey(sql`o.paid_at`)} = to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(days => ${days - 1} - i), 'YYYY-MM-DD')), 0)::bigint AS topup
      FROM d ORDER BY i`),
    rows(sql`
      SELECT ${dayKey(sql`created_at`)} AS day, feature, sum(charged_tokens)::bigint AS tokens
      FROM ai_usage WHERE created_at >= ${start} GROUP BY 1, 2`),
    rows(sql`
      SELECT ${dayKey(sql`created_at`)} AS day,
        count(*) FILTER (WHERE direction='inbound')::int AS inbound,
        count(*) FILTER (WHERE direction='outbound')::int AS outbound
      FROM messages WHERE created_at >= ${start} GROUP BY 1`),
    rows(sql`
      SELECT CASE WHEN kind='ai_topup' THEN 'Top-up token AI' ELSE plan_name END AS name, sum(amount_idr)::bigint AS total
      FROM orders WHERE status='paid' AND paid_at >= ${start} GROUP BY 1 ORDER BY 2 DESC`),
    rows(sql`SELECT status::text AS status, count(*)::int AS n FROM orders WHERE created_at >= ${start} GROUP BY 1`),
    rows(sql`
      SELECT t.name, sum(u.charged_tokens)::bigint AS tokens
      FROM ai_usage u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.created_at >= ${start} GROUP BY t.name ORDER BY 2 DESC LIMIT 8`),
    rows(sql`
      SELECT o.id, o.created_at, o.paid_at, o.kind, o.plan_name, o.amount_idr, o.status::text AS status, o.payment_method, t.name AS tenant
      FROM orders o JOIN tenants t ON t.id = o.tenant_id
      ORDER BY o.created_at DESC LIMIT 50`),
    rows(sql`
      SELECT coalesce(p.name, initcap(t.plan::text)) AS plan, count(*)::int AS n
      FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.status = 'active' GROUP BY 1 ORDER BY 2 DESC`),
  ]);

  const k = kpiRows[0] ?? {};
  const dayLabels = revDaily.map((r) => String(r.day));
  const label = (d: string) => {
    const [, m, dd] = d.split("-");
    return `${Number(dd)}/${Number(m)}`;
  };
  const features = [...new Set(aiDaily.map((r) => String(r.feature)))];
  const msgByDay = new Map(msgDaily.map((r) => [String(r.day), r]));

  const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? null : 0);

  return {
    kpi: {
      revenue: num(k.revenue),
      revenueDelta: delta(num(k.revenue), num(k.revenue_prev)),
      topupRevenue: num(k.topup_revenue),
      paid: num(k.paid),
      paidDelta: delta(num(k.paid), num(k.paid_prev)),
      pending: num(k.pending),
      tenants: num(k.tenants),
      tenantsActive: num(k.tenants_active),
      tenantsNew: num(k.tenants_new),
      tenantsNewDelta: delta(num(k.tenants_new), num(k.tenants_new_prev)),
      channels: num(k.channels),
      tokens: num(k.tokens),
      tokensDelta: delta(num(k.tokens), num(k.tokens_prev)),
      aiCalls: num(k.ai_calls),
      messages: num(k.messages),
      messagesDelta: delta(num(k.messages), num(k.messages_prev)),
    },
    days: dayLabels.map(label),
    revenueSeries: [
      { name: "Paket langganan", data: revDaily.map((r) => num(r.plan)) },
      { name: "Top-up token AI", data: revDaily.map((r) => num(r.topup)) },
    ],
    tokenSeries: features.map((f) => ({
      name: FEATURE_LABEL[f] ?? f,
      data: dayLabels.map((d) => num(aiDaily.find((r) => r.day === d && r.feature === f)?.tokens)),
    })),
    messageSeries: [
      { name: "Pesan masuk", data: dayLabels.map((d) => num(msgByDay.get(d)?.inbound)) },
      { name: "Pesan keluar", data: dayLabels.map((d) => num(msgByDay.get(d)?.outbound)) },
    ],
    revenueByItem: { labels: byPlan.map((r) => String(r.name)), values: byPlan.map((r) => num(r.total)) },
    orderStatus: (["paid", "pending", "failed", "expired"] as const).map((s) => ({ status: s, n: num(byStatus.find((r) => r.status === s)?.n) })),
    topTokenTenants: { labels: topTokens.map((r) => String(r.name)), values: topTokens.map((r) => num(r.tokens)) },
    planMix: { labels: planMix.map((r) => String(r.plan)), values: planMix.map((r) => num(r.n)) },
    recentOrders: recent.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      kind: String(r.kind),
      item: String(r.plan_name),
      tenant: String(r.tenant),
      amount: num(r.amount_idr),
      status: String(r.status),
      method: r.payment_method ? String(r.payment_method) : null,
    })),
  };
}

export type PlatformDashboard = Awaited<ReturnType<typeof loadPlatformDashboard>>;
