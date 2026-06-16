import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import type { TenantPlan } from "./plan";

export interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  channelsConnected: number;
  messagesThisMonth: number;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: "active" | "suspended";
  createdAt: string;
  channels: number;
  users: number;
}

const FALLBACK_OVERVIEW: PlatformOverview = {
  totalTenants: 0,
  activeTenants: 0,
  suspendedTenants: 0,
  channelsConnected: 0,
  messagesThisMonth: 0,
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  try {
    const r = await db.execute(
      sql.raw(
        `select
           count(*)::int total,
           count(*) filter (where status='active')::int active,
           count(*) filter (where status='suspended')::int suspended,
           (select count(*) from channels where status='connected')::int channels_connected,
           (select count(*) from messages where created_at >= date_trunc('month', now()))::int msgs
         from tenants`,
      ),
    );
    const row = (r as unknown as Array<Record<string, unknown>>)[0] ?? {};
    return {
      totalTenants: Number(row.total ?? 0),
      activeTenants: Number(row.active ?? 0),
      suspendedTenants: Number(row.suspended ?? 0),
      channelsConnected: Number(row.channels_connected ?? 0),
      messagesThisMonth: Number(row.msgs ?? 0),
    };
  } catch {
    return FALLBACK_OVERVIEW;
  }
}

export async function listTenants(): Promise<TenantRow[]> {
  try {
    const r = await db.execute(
      sql.raw(
        `select t.id, t.name, t.slug, t.plan, t.status, t.created_at,
           (select count(*) from channels c where c.tenant_id = t.id)::int channels,
           (select count(*) from users u where u.tenant_id = t.id)::int users
         from tenants t
         order by t.created_at desc
         limit 100`,
      ),
    );
    const rows = r as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      plan: (row.plan as TenantPlan) ?? "pro",
      status: (row.status as "active" | "suspended") ?? "active",
      createdAt: String(row.created_at),
      channels: Number(row.channels ?? 0),
      users: Number(row.users ?? 0),
    }));
  } catch {
    return [];
  }
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: "active" | "suspended";
  createdAt: string;
  counts: { channels: number; users: number; contacts: number; messagesThisMonth: number };
  users: { id: string; name: string; email: string; role: string; status: string }[];
  channels: { id: string; name: string; type: string; status: string }[];
}

export async function getTenantDetail(id: string): Promise<TenantDetail | null> {
  try {
    const tRows = (await db.execute(
      sql.raw(`select id, name, slug, plan, status, created_at from tenants where id='${id}'`),
    )) as unknown as Array<Record<string, unknown>>;
    const t = tRows[0];
    if (!t) return null;

    const cRow = (
      (await db.execute(
        sql.raw(
          `select
             (select count(*) from channels where tenant_id='${id}')::int channels,
             (select count(*) from users where tenant_id='${id}')::int users,
             (select count(*) from contacts where tenant_id='${id}')::int contacts,
             (select count(*) from messages where tenant_id='${id}' and created_at >= date_trunc('month', now()))::int msgs`,
        ),
      )) as unknown as Array<Record<string, unknown>>
    )[0] ?? {};

    const users = (await db.execute(
      sql.raw(
        `select id, name, email, role, status from users where tenant_id='${id}' order by created_at desc limit 100`,
      ),
    )) as unknown as Array<Record<string, unknown>>;

    const channels = (await db.execute(
      sql.raw(
        `select id, name, type, status from channels where tenant_id='${id}' order by created_at desc limit 100`,
      ),
    )) as unknown as Array<Record<string, unknown>>;

    return {
      id: String(t.id),
      name: String(t.name),
      slug: String(t.slug),
      plan: (t.plan as TenantPlan) ?? "pro",
      status: (t.status as "active" | "suspended") ?? "active",
      createdAt: String(t.created_at),
      counts: {
        channels: Number(cRow.channels ?? 0),
        users: Number(cRow.users ?? 0),
        contacts: Number(cRow.contacts ?? 0),
        messagesThisMonth: Number(cRow.msgs ?? 0),
      },
      users: users.map((u) => ({ id: String(u.id), name: String(u.name), email: String(u.email), role: String(u.role), status: String(u.status) })),
      channels: channels.map((c) => ({ id: String(c.id), name: String(c.name), type: String(c.type), status: String(c.status) })),
    };
  } catch {
    return null;
  }
}
