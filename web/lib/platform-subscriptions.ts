import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { resolveEntitlements } from "./plan-config";
import type { TenantPlan } from "./plan";

// Subscription health for the superadmin console: MRR, paying tenants, trials, what
// needs follow-up today, and the trends behind them. There is no subscriptions table:
// a paid "plan" order covers 30 days (month) or 365 days (year) from its payment, the
// same rule as lib/subscription.ts, so MRR and churn here are close estimates.

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Row[];
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));

const COVERAGE = sql`CASE WHEN o.period = 'year' THEN interval '365 days' ELSE interval '30 days' END`;
const MONTHLY = sql`o.amount_idr::numeric / CASE WHEN o.period = 'year' THEN 12 ELSE 1 END`;
const IS_TRIAL = sql`coalesce(t.settings->>'trial', 'false') = 'true'`;

// Latest paid plan order per tenant as of a point in time, still covering that point.
const activeAt = (point: ReturnType<typeof sql>) => sql`
  SELECT * FROM (
    SELECT DISTINCT ON (o.tenant_id) o.tenant_id, o.plan_name, o.period, o.paid_at,
           ${MONTHLY} AS monthly, o.paid_at + ${COVERAGE} AS ends_at
    FROM orders o
    WHERE o.status = 'paid' AND o.kind = 'plan' AND o.paid_at <= ${point}
    ORDER BY o.tenant_id, o.paid_at DESC
  ) latest WHERE ${point} < latest.ends_at`;

// --- Dashboard: KPIs + "Perlu tindakan" ---

export type ActionItem = {
  tenantId: string;
  tenant: string;
  detail: string;
  when: string | null; // ISO date the item is about (expiry, order date, ...)
};

export type NearLimit = { tenantId: string; tenant: string; plan: string; items: { label: string; pct: number }[] };

export async function loadSubscriptionOverview() {
  const [kpi, expiring, trials, channelIssues, pendingOrders, near] = await Promise.all([
    rows(sql`
      WITH paying AS (${activeAt(sql`now()`)})
      SELECT
        (SELECT coalesce(sum(p.monthly), 0) FROM paying p JOIN tenants t ON t.id = p.tenant_id WHERE t.status = 'active')::bigint AS mrr,
        (SELECT count(*) FROM paying p JOIN tenants t ON t.id = p.tenant_id WHERE t.status = 'active')::int AS paying,
        (SELECT count(*) FROM tenants t WHERE t.status = 'active' AND ${IS_TRIAL} AND t.plan_expires_at > now())::int AS trials,
        (SELECT count(*) FROM tenants t WHERE t.status = 'active' AND ${IS_TRIAL}
           AND t.plan_expires_at > now() AND t.plan_expires_at <= now() + interval '7 days')::int AS trials_ending,
        (SELECT count(*) FROM tenants t WHERE t.status = 'active' AND NOT ${IS_TRIAL}
           AND t.plan_expires_at > now() AND t.plan_expires_at <= now() + interval '7 days')::int AS expiring`),
    // Paid plans ending within 7 days, or ended in the last 7 days (win-back).
    rows(sql`
      SELECT t.id, t.name, t.plan_expires_at, coalesce(p.name, initcap(t.plan::text)) AS plan
      FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.status = 'active' AND NOT ${IS_TRIAL}
        AND t.plan_expires_at BETWEEN now() - interval '7 days' AND now() + interval '7 days'
      ORDER BY t.plan_expires_at LIMIT 20`),
    rows(sql`
      SELECT t.id, t.name, t.plan_expires_at
      FROM tenants t
      WHERE t.status = 'active' AND ${IS_TRIAL}
        AND t.plan_expires_at > now() AND t.plan_expires_at <= now() + interval '3 days'
      ORDER BY t.plan_expires_at LIMIT 20`),
    rows(sql`
      SELECT t.id, t.name, c.name AS channel, c.type::text AS type, c.status::text AS status, c.updated_at
      FROM channels c JOIN tenants t ON t.id = c.tenant_id
      WHERE t.status = 'active' AND c.status IN ('disconnected', 'banned')
      ORDER BY c.updated_at DESC LIMIT 20`),
    rows(sql`
      SELECT t.id, t.name, o.plan_name, o.kind, o.amount_idr, o.created_at
      FROM orders o JOIN tenants t ON t.id = o.tenant_id
      WHERE o.status = 'pending'
        AND o.created_at BETWEEN now() - interval '7 days' AND now() - interval '24 hours'
      ORDER BY o.created_at DESC LIMIT 20`),
    nearLimits(),
  ]);

  const k = kpi[0] ?? {};
  const mrr = num(k.mrr);
  const paying = num(k.paying);
  const channelLabel: Record<string, string> = { disconnected: "terputus", banned: "diblokir" };

  return {
    now: Date.now(),
    kpi: {
      mrr,
      paying,
      arpu: paying ? Math.round(mrr / paying) : 0,
      trials: num(k.trials),
      trialsEnding: num(k.trials_ending),
      expiring: num(k.expiring),
    },
    expiring: expiring.map<ActionItem>((r) => ({
      tenantId: str(r.id),
      tenant: str(r.name),
      detail: str(r.plan),
      when: r.plan_expires_at ? str(r.plan_expires_at) : null,
    })),
    trialsEnding: trials.map<ActionItem>((r) => ({
      tenantId: str(r.id),
      tenant: str(r.name),
      detail: "Trial Pro",
      when: r.plan_expires_at ? str(r.plan_expires_at) : null,
    })),
    channelIssues: channelIssues.map<ActionItem>((r) => ({
      tenantId: str(r.id),
      tenant: str(r.name),
      detail: `${str(r.channel)} ${channelLabel[str(r.status)] ?? str(r.status)}`,
      when: r.updated_at ? str(r.updated_at) : null,
    })),
    pendingOrders: pendingOrders.map<ActionItem>((r) => ({
      tenantId: str(r.id),
      tenant: str(r.name),
      detail: `${str(r.kind) === "ai_topup" ? "Top-up token AI" : str(r.plan_name)} · Rp ${num(r.amount_idr).toLocaleString("id-ID")}`,
      when: r.created_at ? str(r.created_at) : null,
    })),
    nearLimit: near,
  };
}

// Tenants using ≥80% of a plan limit this month: the best upgrade conversations.
async function nearLimits(): Promise<NearLimit[]> {
  const data = await rows(sql`
    WITH t AS (
      SELECT t.id, t.name, t.plan_id,
             CASE WHEN t.plan_expires_at < now() THEN 'basic' ELSE t.plan::text END AS tier,
             coalesce(t.plan_expires_at < now(), false) AS expired
      FROM tenants t WHERE t.status = 'active'
    )
    SELECT t.id, t.name, t.tier,
           p.name AS plan_name, p.limits, p.feature_flags, p.flow_nodes, p.ai_tokens_monthly,
           (SELECT count(*) FROM channels c WHERE c.tenant_id = t.id)::int AS channels,
           (SELECT count(*) FROM broadcast_recipients r WHERE r.tenant_id = t.id
              AND r.status IN ('pending', 'sent', 'delivered')
              AND r.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS broadcast_used,
           (SELECT coalesce(sum(b.tokens_total), 0) FROM ai_credit_buckets b WHERE b.tenant_id = t.id
              AND (b.expires_at IS NULL OR b.expires_at > now()))::bigint AS ai_total,
           (SELECT coalesce(sum(least(b.tokens_used, b.tokens_total)), 0) FROM ai_credit_buckets b WHERE b.tenant_id = t.id
              AND (b.expires_at IS NULL OR b.expires_at > now()))::bigint AS ai_used
    FROM t
    LEFT JOIN LATERAL (
      SELECT p.* FROM plans p
      WHERE (p.id = t.plan_id AND NOT t.expired)
         OR (p.tier::text = t.tier AND p.is_active)
      ORDER BY (p.id = t.plan_id AND NOT t.expired) DESC, p.sort_order
      LIMIT 1
    ) p ON true`);

  const out: NearLimit[] = [];
  for (const r of data) {
    const tier = (str(r.tier) || "basic") as TenantPlan;
    const ent = resolveEntitlements(
      tier,
      r.plan_name == null
        ? null
        : { limits: r.limits, featureFlags: r.feature_flags, flowNodes: r.flow_nodes, aiTokensMonthly: num(r.ai_tokens_monthly) },
    );
    const items: { label: string; pct: number }[] = [];
    const add = (label: string, used: number, max: number | null) => {
      if (max === null || max <= 0) return;
      const pct = Math.round((used / max) * 100);
      if (pct >= 80) items.push({ label, pct });
    };
    add("Channel", num(r.channels), ent.limits.maxChannels);
    if (ent.features.broadcast) add("Broadcast bulan ini", num(r.broadcast_used), ent.limits.broadcastPerMonth);
    add("Token AI", num(r.ai_used), num(r.ai_total) || null);
    if (items.length) {
      out.push({ tenantId: str(r.id), tenant: str(r.name), plan: str(r.plan_name) || tier, items });
    }
  }
  return out.sort((a, b) => Math.max(...b.items.map((i) => i.pct)) - Math.max(...a.items.map((i) => i.pct))).slice(0, 20);
}

// --- Analytics: trends ---

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Last n months (WIB calendar), oldest first.
function lastMonths(n: number): { key: string; label: string }[] {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - i, 1));
    out.push({ key: monthKey(d), label: `${MONTH_LABEL[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
  }
  return out;
}

const MONTHS_START = (n: number) =>
  sql`(date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - make_interval(months => ${n - 1})) AT TIME ZONE 'Asia/Jakarta'`;

export const ADOPTION_FEATURES = [
  { key: "automation", label: "Automation" },
  { key: "broadcast", label: "Broadcast" },
  { key: "ai", label: "AI" },
  { key: "catalog", label: "Katalog" },
] as const;

export type AdoptionRow = { plan: string; tenants: number } & Record<(typeof ADOPTION_FEATURES)[number]["key"], number>;

export async function loadSubscriptionAnalytics() {
  const months12 = lastMonths(12);
  const months6 = lastMonths(6);

  const [mrrRows, cohortRows, retentionRows, funnelRows, adoptionRows, revenueRows, nowRows] = await Promise.all([
    // MRR at the end of each month (or now, for the current month), per plan.
    rows(sql`
      WITH months AS (
        SELECT m, least((m + interval '1 month') AT TIME ZONE 'Asia/Jakarta', now()) AS pt
        FROM generate_series(
          date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '11 months',
          date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta'),
          interval '1 month') AS m
      )
      SELECT to_char(mo.m, 'YYYY-MM') AS month, x.plan_name, sum(x.monthly)::bigint AS mrr
      FROM months mo
      CROSS JOIN LATERAL (
        SELECT DISTINCT ON (o.tenant_id) o.plan_name, o.paid_at, ${MONTHLY} AS monthly, o.paid_at + ${COVERAGE} AS ends_at
        FROM orders o
        WHERE o.status = 'paid' AND o.kind = 'plan' AND o.paid_at <= mo.pt
        ORDER BY o.tenant_id, o.paid_at DESC
      ) x
      WHERE mo.pt < x.ends_at
      GROUP BY 1, 2`),
    // Signups per month and how many of them ever paid for a plan.
    rows(sql`
      SELECT to_char(t.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS month,
             count(*)::int AS signups,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM orders o WHERE o.tenant_id = t.id AND o.status = 'paid' AND o.kind = 'plan'))::int AS paid
      FROM tenants t WHERE t.created_at >= ${MONTHS_START(6)}
      GROUP BY 1`),
    // Paid periods that ended each month, and how many were followed by another payment.
    rows(sql`
      WITH pp AS (
        SELECT o.tenant_id, o.paid_at, o.paid_at + ${COVERAGE} AS ends_at
        FROM orders o WHERE o.status = 'paid' AND o.kind = 'plan'
      )
      SELECT to_char(pp.ends_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS month,
             count(*)::int AS ended,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM pp n WHERE n.tenant_id = pp.tenant_id AND n.paid_at > pp.paid_at))::int AS renewed
      FROM pp WHERE pp.ends_at <= now() AND pp.ends_at >= ${MONTHS_START(6)}
      GROUP BY 1`),
    // Activation funnel for tenants who signed up in the last 90 days. Each step
    // also requires the ones before it, so the bars only ever shrink.
    rows(sql`
      WITH t AS (
        SELECT t.id,
               EXISTS (SELECT 1 FROM channels c WHERE c.tenant_id = t.id) AS channel,
               EXISTS (SELECT 1 FROM messages m WHERE m.tenant_id = t.id AND m.direction = 'inbound') AS message,
               EXISTS (SELECT 1 FROM orders o WHERE o.tenant_id = t.id AND o.status = 'paid' AND o.kind = 'plan') AS paid
        FROM tenants t WHERE t.created_at >= now() - interval '90 days'
      )
      SELECT count(*)::int AS signups,
             count(*) FILTER (WHERE channel)::int AS channel,
             count(*) FILTER (WHERE channel AND message)::int AS message,
             count(*) FILTER (WHERE channel AND message AND paid)::int AS paid
      FROM t`),
    // Which features active tenants actually use (last 30 days), by current plan.
    rows(sql`
      SELECT CASE WHEN t.plan_expires_at < now() THEN 'Basic'
                  WHEN ${IS_TRIAL} THEN 'Trial'
                  ELSE coalesce(p.name, initcap(t.plan::text)) END AS plan,
             count(*)::int AS tenants,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM flows f
               WHERE f.tenant_id = t.id AND f.status = 'active' AND f.trigger::text <> 'broadcast'))::int AS automation,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM broadcasts b
               WHERE b.tenant_id = t.id AND b.created_at >= now() - interval '30 days'
                 AND b.status IN ('scheduled', 'running', 'done')))::int AS broadcast,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ai_usage u
               WHERE u.tenant_id = t.id AND u.created_at >= now() - interval '30 days'))::int AS ai,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM products pr WHERE pr.tenant_id = t.id))::int AS catalog
      FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.status = 'active'
      GROUP BY 1 ORDER BY 2 DESC`),
    // Plan revenue over the last 12 months, by plan and billing period.
    rows(sql`
      SELECT o.plan_name, o.period, count(*)::int AS orders, sum(o.amount_idr)::bigint AS total
      FROM orders o
      WHERE o.status = 'paid' AND o.kind = 'plan' AND o.paid_at >= ${MONTHS_START(12)}
      GROUP BY 1, 2 ORDER BY 4 DESC`),
    rows(sql`
      WITH paying AS (${activeAt(sql`now()`)})
      SELECT coalesce(sum(p.monthly), 0)::bigint AS mrr, count(*)::int AS paying
      FROM paying p JOIN tenants t ON t.id = p.tenant_id WHERE t.status = 'active'`),
  ]);

  // MRR series: one stacked series per plan.
  const plans = [...new Set(mrrRows.map((r) => str(r.plan_name)))];
  const mrrSeries = plans.map((name) => ({
    name,
    data: months12.map((m) => num(mrrRows.find((r) => str(r.month) === m.key && str(r.plan_name) === name)?.mrr)),
  }));
  const mrrTotal = months12.map((_, i) => mrrSeries.reduce((s, x) => s + x.data[i], 0));

  const cohorts = months6.map((m) => {
    const r = cohortRows.find((x) => str(x.month) === m.key);
    const signups = num(r?.signups);
    const paid = num(r?.paid);
    return { label: m.label, signups, paid, rate: signups ? Math.round((paid / signups) * 100) : 0 };
  });

  const retention = months6.map((m) => {
    const r = retentionRows.find((x) => str(x.month) === m.key);
    const ended = num(r?.ended);
    const renewed = num(r?.renewed);
    return { label: m.label, ended, renewed, churned: ended - renewed, rate: ended ? Math.round((renewed / ended) * 100) : null };
  });

  const f = funnelRows[0] ?? {};
  const funnel = [
    { label: "Daftar", n: num(f.signups) },
    { label: "Hubungkan channel", n: num(f.channel) },
    { label: "Terima pesan pertama", n: num(f.message) },
    { label: "Bayar paket", n: num(f.paid) },
  ];

  const adoption: AdoptionRow[] = adoptionRows.map((r) => ({
    plan: str(r.plan),
    tenants: num(r.tenants),
    automation: num(r.automation),
    broadcast: num(r.broadcast),
    ai: num(r.ai),
    catalog: num(r.catalog),
  }));

  const revenueByPlan = revenueRows.map((r) => ({
    plan: str(r.plan_name),
    period: str(r.period) === "year" ? "Tahunan" : "Bulanan",
    orders: num(r.orders),
    total: num(r.total),
  }));

  const n = nowRows[0] ?? {};
  const mrr = num(n.mrr);
  const paying = num(n.paying);
  const prevMrr = mrrTotal.length > 1 ? mrrTotal[mrrTotal.length - 2] : 0;

  return {
    kpi: {
      mrr,
      mrrDelta: prevMrr ? Math.round(((mrr - prevMrr) / prevMrr) * 100) : null,
      paying,
      arpu: paying ? Math.round(mrr / paying) : 0,
      conversion: (() => {
        const s = cohorts.reduce((a, c) => a + c.signups, 0);
        const p = cohorts.reduce((a, c) => a + c.paid, 0);
        return s ? Math.round((p / s) * 100) : 0;
      })(),
      renewal: (() => {
        const e = retention.reduce((a, c) => a + c.ended, 0);
        const r = retention.reduce((a, c) => a + c.renewed, 0);
        return e ? Math.round((r / e) * 100) : null;
      })(),
    },
    months: months12.map((m) => m.label),
    mrrSeries,
    cohorts,
    retention,
    funnel,
    adoption,
    revenueByPlan,
  };
}
