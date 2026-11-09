import "server-only";
// Tenant dashboard data. Every query is scoped to ONE tenant:
//   - tenantId only ever comes from the signed-in session (the page passes session.tenantId),
//   - every table in every query (including joined ones) is filtered by `<alias>.tenant_id = ${t}`,
//   - URL filters (range, channel) are whitelisted before they reach SQL.
// tests/regressions.test.mjs checks the "every table alias is tenant-filtered" rule.
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";

// --- filters ------------------------------------------------------------------------

export const RANGES = [
  { id: "today", label: "Hari ini", days: 1 },
  { id: "7d", label: "7 hari", days: 7 },
  { id: "30d", label: "30 hari", days: 30 },
  { id: "90d", label: "90 hari", days: 90 },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export const CHANNEL_FILTERS = [
  { id: "wa_unofficial", label: "WhatsApp" },
  { id: "wa_official", label: "WA Official" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "telegram", label: "Telegram" },
] as const;
export type ChannelFilter = (typeof CHANNEL_FILTERS)[number]["id"];

export type DashboardFilters = { range: RangeId; days: number; channel: ChannelFilter | null };

// Unknown values fall back to defaults, so nothing from the URL is used verbatim.
export function parseFilters(params: { range?: string; ch?: string }): DashboardFilters {
  const r = RANGES.find((x) => x.id === params.range) ?? RANGES[1];
  const ch = CHANNEL_FILTERS.find((x) => x.id === params.ch)?.id ?? null;
  return { range: r.id, days: r.days, channel: ch };
}

// --- time buckets (WIB) -----------------------------------------------------------

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;

type Window = { from: string; prevFrom: string; unit: "hour" | "day"; keys: string[]; labels: string[] };

function windowFor(days: number, now = Date.now()): Window {
  const todayStart = Math.floor((now + WIB) / DAY) * DAY - WIB; // WIB midnight as UTC instant
  const from = todayStart - (days - 1) * DAY;
  const prevFrom = from - days * DAY;
  const pad = (n: number) => String(n).padStart(2, "0");
  const keys: string[] = [];
  const labels: string[] = [];
  if (days === 1) {
    for (let h = 0; h < 24; h++) {
      const d = new Date(from + WIB);
      keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(h)}`);
      labels.push(`${pad(h)}.00`);
    }
  } else {
    const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
    for (let i = 0; i < days; i++) {
      const d = new Date(from + i * DAY + WIB);
      keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
      labels.push(fmt.format(d));
    }
  }
  return { from: new Date(from).toISOString(), prevFrom: new Date(prevFrom).toISOString(), unit: days === 1 ? "hour" : "day", keys, labels };
}

// SQL bucket key matching Window.keys.
const bucket = (col: SQL, w: Window) =>
  w.unit === "hour"
    ? sql`to_char(${col} at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24')`
    : sql`to_char(${col} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

function fill(w: Window, rows: { k: string; v: unknown }[]): number[] {
  const m = new Map(rows.map((r) => [String(r.k), Number(r.v) || 0]));
  return w.keys.map((k) => m.get(k) ?? 0);
}

// --- helpers ------------------------------------------------------------------------

type Row = Record<string, unknown>;
async function rows<T extends Row>(q: SQL): Promise<T[]> {
  // postgres-js db.execute returns the row array itself.
  return (await db.execute(q)) as unknown as T[];
}
const num = (v: unknown) => Number(v ?? 0) || 0;

// Optional channel-type filter on a table that has channel_id. The channel lookup is
// tenant-scoped too, so a channel type can never pull another tenant's rows in.
function chan(alias: string, t: string, f: DashboardFilters): SQL {
  if (!f.channel) return sql``;
  return sql`and ${sql.raw(alias)}.channel_id in (select chx.id from channels chx where chx.tenant_id = ${t} and chx.type = ${f.channel}::channel_type)`;
}

// --- data ---------------------------------------------------------------------------

export type Delta = { cur: number; prev: number };

export type TenantDashboard = {
  filters: DashboardFilters;
  labels: string[];
  kpi: {
    inbound: Delta;
    newConversations: Delta;
    automation: Delta; // % of replies sent by bot/AI
    firstResponse: Delta; // seconds, bot + agent
    firstResponseAgent: number; // seconds, agent only (current period)
    newContacts: Delta;
    optIns: number;
    waiting: number;
  };
  series: { inbound: number[]; bot: number[]; agent: number[]; conversations: number[]; contacts: number[]; aiTokens: number[] };
  byChannel: { type: string; n: number }[];
  heatmap: number[][]; // [isoDow 1..7][hour 0..23]
  ai: { calls: number; tokens: number };
  broadcasts: { name: string; total: number; sent: number; delivered: number; read: number; clicked: number; failed: number }[];
  contacts: { total: number; growth: number[]; optIn: { status: string; n: number }[]; tags: { tag: string; n: number }[] };
  agents: { id: string; name: string; messages: number; conversations: number; avgFirstResponse: number | null; openAssigned: number }[];
  channels: { name: string; type: string; status: string; convs: number }[];
  recent: { contact: string; preview: string; at: string | null }[];
};

export async function loadTenantDashboard(tenantId: string, f: DashboardFilters): Promise<TenantDashboard> {
  const t = tenantId;
  const w = windowFor(f.days);
  const from = sql`${w.from}::timestamptz`;
  const prevFrom = sql`${w.prevFrom}::timestamptz`;

  const [
    msgAgg,
    convAgg,
    contactAgg,
    waiting,
    firstResp,
    msgSeries,
    convSeries,
    contactSeries,
    aiSeries,
    byChannel,
    heat,
    broadcasts,
    contactBase,
    optIn,
    tags,
    agentMsgs,
    agentResp,
    agentOpen,
    channelStatus,
    recent,
  ] = await Promise.all([
    rows(sql`
      select
        count(*) filter (where m.direction = 'inbound' and m.created_at >= ${from}) in_cur,
        count(*) filter (where m.direction = 'inbound' and m.created_at < ${from}) in_prev,
        count(*) filter (where m.sender = 'bot' and m.created_at >= ${from}) bot_cur,
        count(*) filter (where m.sender = 'bot' and m.created_at < ${from}) bot_prev,
        count(*) filter (where m.sender = 'agent' and m.created_at >= ${from}) agent_cur,
        count(*) filter (where m.sender = 'agent' and m.created_at < ${from}) agent_prev
      from messages m
      where m.tenant_id = ${t} and m.created_at >= ${prevFrom} ${chan("m", t, f)}`),
    rows(sql`
      select count(*) filter (where c.created_at >= ${from}) cur, count(*) filter (where c.created_at < ${from}) prev
      from conversations c
      where c.tenant_id = ${t} and c.created_at >= ${prevFrom} ${chan("c", t, f)}`),
    rows(sql`
      select
        count(*) filter (where ct.created_at >= ${from}) cur,
        count(*) filter (where ct.created_at < ${from}) prev,
        count(*) filter (where ct.opt_in_status = 'opted_in' and ct.opt_in_at >= ${from}) optins
      from contacts ct
      where ct.tenant_id = ${t} and ct.created_at >= ${prevFrom}`),
    rows(sql`
      select count(*) n from conversations c
      where c.tenant_id = ${t} and c.status in ('open', 'pending') and c.unread_count > 0 ${chan("c", t, f)}`),
    rows(sql`
      with fr as (
        select m.conversation_id,
          min(m.created_at) filter (where m.direction = 'inbound') fi,
          min(m.created_at) filter (where m.sender in ('bot', 'agent')) fo,
          min(m.created_at) filter (where m.sender = 'agent') fa
        from messages m
        where m.tenant_id = ${t} and m.created_at >= ${prevFrom} ${chan("m", t, f)}
        group by m.conversation_id
      )
      select
        avg(extract(epoch from fo - fi)) filter (where fo > fi and fi >= ${from}) all_cur,
        avg(extract(epoch from fo - fi)) filter (where fo > fi and fi < ${from}) all_prev,
        avg(extract(epoch from fa - fi)) filter (where fa > fi and fi >= ${from}) agent_cur
      from fr`),
    rows<{ k: string; inb: number; bot: number; agent: number }>(sql`
      select ${bucket(sql`m.created_at`, w)} k,
        count(*) filter (where m.direction = 'inbound') inb,
        count(*) filter (where m.sender = 'bot') bot,
        count(*) filter (where m.sender = 'agent') agent
      from messages m
      where m.tenant_id = ${t} and m.created_at >= ${from} ${chan("m", t, f)}
      group by 1`),
    rows<{ k: string; v: number }>(sql`
      select ${bucket(sql`c.created_at`, w)} k, count(*) v
      from conversations c
      where c.tenant_id = ${t} and c.created_at >= ${from} ${chan("c", t, f)}
      group by 1`),
    rows<{ k: string; v: number }>(sql`
      select ${bucket(sql`ct.created_at`, w)} k, count(*) v
      from contacts ct
      where ct.tenant_id = ${t} and ct.created_at >= ${from}
      group by 1`),
    rows<{ k: string; v: number; calls: number }>(sql`
      select ${bucket(sql`au.created_at`, w)} k, coalesce(sum(au.charged_tokens), 0) v, count(*) calls
      from ai_usage au
      where au.tenant_id = ${t} and au.created_at >= ${from}
      group by 1`),
    rows<{ type: string; n: number }>(sql`
      select ch.type::text type, count(m.id) n
      from messages m
      join channels ch on ch.id = m.channel_id and ch.tenant_id = ${t}
      where m.tenant_id = ${t} and m.created_at >= ${from} ${chan("m", t, f)}
      group by ch.type
      order by n desc`),
    rows<{ d: number; h: number; n: number }>(sql`
      select extract(isodow from m.created_at at time zone 'Asia/Jakarta')::int d,
             extract(hour from m.created_at at time zone 'Asia/Jakarta')::int h,
             count(*) n
      from messages m
      where m.tenant_id = ${t} and m.direction = 'inbound' and m.created_at >= ${from} ${chan("m", t, f)}
      group by 1, 2`),
    rows(sql`
      select b.name,
        count(r.id) total,
        count(r.id) filter (where r.status in ('sent', 'delivered')) sent,
        count(r.id) filter (where r.status = 'delivered' or msg.status in ('delivered', 'read')) delivered,
        count(r.id) filter (where msg.status = 'read') read,
        count(r.id) filter (where r.clicked_at is not null) clicked,
        count(r.id) filter (where r.status = 'failed') failed
      from broadcasts b
      left join broadcast_recipients r on r.broadcast_id = b.id and r.tenant_id = ${t}
      left join messages msg on msg.id = r.message_id and msg.tenant_id = ${t}
      where b.tenant_id = ${t} and b.status in ('running', 'done') ${chan("b", t, f)}
      group by b.id, b.name, b.created_at
      order by b.created_at desc
      limit 6`),
    rows(sql`select count(*) n from contacts ct where ct.tenant_id = ${t} and ct.created_at < ${from}`),
    rows<{ status: string; n: number }>(sql`
      select ct.opt_in_status::text status, count(*) n from contacts ct where ct.tenant_id = ${t} group by 1`),
    rows<{ tag: string; n: number }>(sql`
      select tg.tag, count(*) n
      from contacts ct cross join lateral unnest(ct.tags) as tg(tag)
      where ct.tenant_id = ${t}
      group by tg.tag
      order by n desc
      limit 8`),
    rows<{ id: string; name: string; msgs: number; convs: number }>(sql`
      select u.id::text id, u.name, count(m.id) msgs, count(distinct m.conversation_id) convs
      from messages m
      join users u on u.id = m.agent_id and u.tenant_id = ${t}
      where m.tenant_id = ${t} and m.sender = 'agent' and m.created_at >= ${from} ${chan("m", t, f)}
      group by u.id, u.name
      order by msgs desc
      limit 10`),
    rows<{ agent_id: string; s: number }>(sql`
      with fr as (
        select m.conversation_id,
          min(m.created_at) filter (where m.direction = 'inbound') fi,
          min(m.created_at) filter (where m.sender = 'agent') fa
        from messages m
        where m.tenant_id = ${t} and m.created_at >= ${from} ${chan("m", t, f)}
        group by m.conversation_id
      ),
      first_agent as (
        select distinct on (m.conversation_id) m.conversation_id, m.agent_id
        from messages m
        where m.tenant_id = ${t} and m.sender = 'agent' and m.created_at >= ${from} ${chan("m", t, f)}
        order by m.conversation_id, m.created_at
      )
      select first_agent.agent_id::text agent_id, avg(extract(epoch from fr.fa - fr.fi)) s
      from fr join first_agent on first_agent.conversation_id = fr.conversation_id
      where fr.fa > fr.fi
      group by 1`),
    rows<{ agent_id: string; n: number }>(sql`
      select c.assigned_agent_id::text agent_id, count(*) n
      from conversations c
      where c.tenant_id = ${t} and c.status in ('open', 'pending') and c.assigned_agent_id is not null ${chan("c", t, f)}
      group by 1`),
    rows<{ name: string; type: string; status: string; convs: number }>(sql`
      select c.name, c.type::text type, c.status::text status, count(conv.id) convs
      from channels c
      left join conversations conv on conv.channel_id = c.id and conv.tenant_id = ${t}
      where c.tenant_id = ${t}
      group by c.id, c.name, c.type, c.status
      order by (c.status in ('banned', 'disconnected')) desc, convs desc, c.name asc
      limit 8`),
    rows<{ contact: string; preview: string | null; at: string | null }>(sql`
      select coalesce(ct.name, ct.phone, 'Kontak') contact, conv.last_message_preview preview, conv.last_message_at at
      from conversations conv
      left join contacts ct on ct.id = conv.contact_id and ct.tenant_id = ${t}
      where conv.tenant_id = ${t} ${chan("conv", t, f)}
      order by conv.last_message_at desc nulls last
      limit 6`),
  ]);

  const ma = msgAgg[0] ?? {};
  const pct = (bot: number, agent: number) => (bot + agent > 0 ? Math.round((bot / (bot + agent)) * 100) : 0);
  const fr = firstResp[0] ?? {};

  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of heat) {
    const d = num(r.d);
    const h = num(r.h);
    if (d >= 1 && d <= 7 && h >= 0 && h < 24) heatmap[d - 1][h] = num(r.n);
  }

  const respByAgent = new Map(agentResp.map((r) => [r.agent_id, num(r.s)]));
  const openByAgent = new Map(agentOpen.map((r) => [r.agent_id, num(r.n)]));

  const newContacts = fill(w, contactSeries);
  let running = num(contactBase[0]?.n);
  const growth = newContacts.map((n) => (running += n));

  return {
    filters: f,
    labels: w.labels,
    kpi: {
      inbound: { cur: num(ma.in_cur), prev: num(ma.in_prev) },
      newConversations: { cur: num(convAgg[0]?.cur), prev: num(convAgg[0]?.prev) },
      automation: { cur: pct(num(ma.bot_cur), num(ma.agent_cur)), prev: pct(num(ma.bot_prev), num(ma.agent_prev)) },
      firstResponse: { cur: num(fr.all_cur), prev: num(fr.all_prev) },
      firstResponseAgent: num(fr.agent_cur),
      newContacts: { cur: num(contactAgg[0]?.cur), prev: num(contactAgg[0]?.prev) },
      optIns: num(contactAgg[0]?.optins),
      waiting: num(waiting[0]?.n),
    },
    series: {
      inbound: fill(w, msgSeries.map((r) => ({ k: r.k, v: r.inb }))),
      bot: fill(w, msgSeries.map((r) => ({ k: r.k, v: r.bot }))),
      agent: fill(w, msgSeries.map((r) => ({ k: r.k, v: r.agent }))),
      conversations: fill(w, convSeries),
      contacts: newContacts,
      aiTokens: fill(w, aiSeries),
    },
    byChannel: byChannel.map((r) => ({ type: String(r.type), n: num(r.n) })).filter((r) => r.n > 0),
    heatmap,
    ai: { calls: aiSeries.reduce((a, r) => a + num(r.calls), 0), tokens: aiSeries.reduce((a, r) => a + num(r.v), 0) },
    broadcasts: broadcasts.map((r) => ({
      name: String(r.name ?? "Broadcast"),
      total: num(r.total),
      sent: num(r.sent),
      delivered: num(r.delivered),
      read: num(r.read),
      clicked: num(r.clicked),
      failed: num(r.failed),
    })),
    contacts: {
      total: running,
      growth,
      optIn: optIn.map((r) => ({ status: String(r.status), n: num(r.n) })),
      tags: tags.map((r) => ({ tag: String(r.tag), n: num(r.n) })),
    },
    agents: agentMsgs.map((r) => ({
      id: r.id,
      name: String(r.name),
      messages: num(r.msgs),
      conversations: num(r.convs),
      avgFirstResponse: respByAgent.has(r.id) ? (respByAgent.get(r.id) ?? null) : null,
      openAssigned: openByAgent.get(r.id) ?? 0,
    })),
    channels: channelStatus.map((r) => ({ name: String(r.name ?? "Channel"), type: String(r.type), status: String(r.status), convs: num(r.convs) })),
    recent: recent.map((r) => ({ contact: String(r.contact), preview: r.preview ? String(r.preview) : "(tanpa pratinjau)", at: r.at ? String(r.at) : null })),
  };
}
