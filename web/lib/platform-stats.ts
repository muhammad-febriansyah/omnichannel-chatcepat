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

// --- Transaksi (orders) lintas tenant — konsol platform ---

export interface RevenueStats {
  totalPaidIdr: number;
  monthPaidIdr: number;
  pendingCount: number;
  totalCount: number;
}

export interface OrderRow {
  id: string;
  tenantName: string;
  planName: string;
  amountIdr: number;
  status: string;
  paymentMethod: string | null;
  customerName: string | null;
  createdAt: string;
  paidAt: string | null;
}

export async function getRevenueStats(): Promise<RevenueStats> {
  try {
    const r = await db.execute(
      sql`SELECT
            coalesce(sum(amount_idr) filter (where status='paid'),0)::bigint total_paid,
            coalesce(sum(amount_idr) filter (where status='paid' and paid_at >= date_trunc('month', now())),0)::bigint month_paid,
            count(*) filter (where status='pending')::int pending,
            count(*)::int total
          FROM orders`,
    );
    const row = (r as unknown as Record<string, unknown>[])[0] ?? {};
    return {
      totalPaidIdr: Number(row.total_paid ?? 0),
      monthPaidIdr: Number(row.month_paid ?? 0),
      pendingCount: Number(row.pending ?? 0),
      totalCount: Number(row.total ?? 0),
    };
  } catch {
    return { totalPaidIdr: 0, monthPaidIdr: 0, pendingCount: 0, totalCount: 0 };
  }
}

export async function listOrders(limit = 100): Promise<OrderRow[]> {
  try {
    const r = await db.execute(
      sql`SELECT o.id, t.name tenant_name, o.plan_name, o.amount_idr, o.status,
                 o.payment_method, o.customer_name, o.created_at, o.paid_at
          FROM orders o JOIN tenants t ON t.id = o.tenant_id
          ORDER BY o.created_at DESC
          LIMIT ${limit}`,
    );
    const rows = (r as unknown as Record<string, unknown>[]);
    return rows.map((row) => ({
      id: String(row.id),
      tenantName: String(row.tenant_name),
      planName: String(row.plan_name),
      amountIdr: Number(row.amount_idr ?? 0),
      status: String(row.status),
      paymentMethod: row.payment_method ? String(row.payment_method) : null,
      customerName: row.customer_name ? String(row.customer_name) : null,
      createdAt: String(row.created_at),
      paidAt: row.paid_at ? String(row.paid_at) : null,
    }));
  } catch {
    return [];
  }
}

// --- Pengguna lintas tenant ---

export interface PlatformUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  tenantName: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

export async function listAllUsers(limit = 200): Promise<PlatformUserRow[]> {
  try {
    const r = await db.execute(
      sql`SELECT u.id, u.name, u.email, u.role, u.status, t.name tenant_name,
                 u.last_active_at, u.created_at
          FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
          ORDER BY u.created_at DESC
          LIMIT ${limit}`,
    );
    const rows = (r as unknown as Record<string, unknown>[]);
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      status: String(row.status),
      tenantName: row.tenant_name ? String(row.tenant_name) : null,
      lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

// --- Analitik platform: tren 6 bulan terakhir ---

export interface MonthlyPoint {
  month: string; // "2026-06"
  label: string; // "Jun"
  revenue: number;
  tenants: number;
  messages: number;
}

export async function getMonthlyAnalytics(): Promise<MonthlyPoint[]> {
  try {
    const r = await db.execute(
      sql`WITH months AS (
            SELECT date_trunc('month', now()) - (interval '1 month' * gs) AS m
            FROM generate_series(0, 5) gs
          )
          SELECT to_char(m, 'YYYY-MM') month,
                 to_char(m, 'Mon') label,
                 coalesce((SELECT sum(amount_idr) FROM orders o
                    WHERE o.status='paid' AND date_trunc('month', o.paid_at) = months.m),0)::bigint revenue,
                 (SELECT count(*) FROM tenants t
                    WHERE date_trunc('month', t.created_at) = months.m)::int tenants,
                 (SELECT count(*) FROM messages msg
                    WHERE date_trunc('month', msg.created_at) = months.m)::int messages
          FROM months
          ORDER BY m ASC`,
    );
    const rows = (r as unknown as Record<string, unknown>[]);
    return rows.map((row) => ({
      month: String(row.month),
      label: String(row.label),
      revenue: Number(row.revenue ?? 0),
      tenants: Number(row.tenants ?? 0),
      messages: Number(row.messages ?? 0),
    }));
  } catch {
    return [];
  }
}

// --- Audit log (jejak aksi super-admin, dari tabel audit_logs) ---

export interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetLabel: string | null;
  tenantName: string | null;
  ip: string | null;
  createdAt: string;
}

export async function listAuditLogs(limit = 100): Promise<AuditRow[]> {
  try {
    const r = await db.execute(
      sql`SELECT a.id, coalesce(u.email, a.diff->>'actorEmail') actor_email,
                 a.action, a.entity target_type, a.diff->>'targetLabel' target_label,
                 t.name tenant_name, a.diff->>'ip' ip, a.created_at
          FROM audit_logs a
          LEFT JOIN tenants t ON t.id = a.tenant_id
          LEFT JOIN users u ON u.id = a.actor_id
          ORDER BY a.created_at DESC
          LIMIT ${limit}`,
    );
    const rows = (r as unknown as Record<string, unknown>[]);
    return rows.map((row) => ({
      id: String(row.id),
      actorEmail: row.actor_email ? String(row.actor_email) : null,
      action: String(row.action),
      targetType: row.target_type ? String(row.target_type) : null,
      targetLabel: row.target_label ? String(row.target_label) : null,
      tenantName: row.tenant_name ? String(row.tenant_name) : null,
      ip: row.ip ? String(row.ip) : null,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
