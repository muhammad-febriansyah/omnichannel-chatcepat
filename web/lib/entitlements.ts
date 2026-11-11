import "server-only";
import { cache } from "react";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { broadcastRecipients, channels, knowledgeDocuments, plans, tenants, users } from "./db/schema";
import { PLAN_LABEL, type TenantPlan } from "./plan";
import {
  CHANNEL_KINDS,
  nodeAllowed,
  resolveEntitlements,
  type ChannelKind,
  type PlanEntitlements,
  type PlanFeature,
} from "./plan-config";
import type { Session } from "./session";

// Batas per paket kini diatur superadmin di Konsol → Paket (plans.limits,
// feature_flags, flow_nodes, ai_tokens_monthly). Admin platform (god-mode) tidak
// dibatasi. Paket kedaluwarsa → tier basic (selaras session).
export type { PlanFeature } from "./plan-config";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    // Keep the message readable in production (see lib/action-error.ts).
    (this as unknown as { digest: string }).digest = "CCERR:" + encodeURIComponent(message);
    this.name = "PlanLimitError";
  }
}

function unlimited(session: Session): boolean {
  return session.isPlatformAdmin;
}

function planLabel(session: Session): string {
  return PLAN_LABEL[session.plan as TenantPlan] ?? PLAN_LABEL.basic;
}

// The plan row a tenant is on: its linked plan (while not expired), else the first
// active plan of its tier. Cached per request.
export const tenantEntitlements = cache(async (tenantId: string, tier: TenantPlan): Promise<PlanEntitlements & { planName: string }> => {
  const t = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { planId: true, planExpiresAt: true },
  });
  const expired = !!t?.planExpiresAt && new Date(t.planExpiresAt).getTime() < Date.now();
  let row = !expired && t?.planId ? await db.query.plans.findFirst({ where: eq(plans.id, t.planId) }) : undefined;
  if (!row) {
    row = await db.query.plans.findFirst({
      where: and(eq(plans.tier, tier), eq(plans.isActive, true)),
      orderBy: [asc(plans.sortOrder)],
    });
  }
  return { ...resolveEntitlements(tier, row ?? null), planName: row?.name ?? PLAN_LABEL[tier] };
});

export async function sessionEntitlements(session: Session) {
  return tenantEntitlements(session.tenantId ?? "", (session.plan as TenantPlan) ?? "basic");
}

export async function hasFeature(session: Session, feature: PlanFeature): Promise<boolean> {
  if (unlimited(session)) return true;
  if (!session.tenantId) return false;
  return (await sessionEntitlements(session)).features[feature];
}

export async function requireFeature(session: Session, feature: PlanFeature, label: string): Promise<void> {
  if (await hasFeature(session, feature)) return;
  throw new PlanLimitError(`Fitur ${label} tidak tersedia di paket ${planLabel(session)}. Upgrade paket untuk mengaktifkan.`);
}

// Flow steps the plan allows (null = all). Admin = all.
export async function allowedFlowNodes(session: Session): Promise<string[] | null> {
  if (unlimited(session) || !session.tenantId) return null;
  return (await sessionEntitlements(session)).flowNodes;
}

export async function assertFlowNodesAllowed(session: Session, kinds: string[]): Promise<void> {
  const allowed = await allowedFlowNodes(session);
  const blocked = [...new Set(kinds.filter((k) => !nodeAllowed(allowed, k)))];
  if (blocked.length) {
    throw new PlanLimitError(
      `Langkah ${blocked.join(", ")} tidak termasuk paket ${planLabel(session)}. Hapus langkah itu atau upgrade paket.`,
    );
  }
}

async function countTenant(tenantId: string, table: typeof channels | typeof users | typeof knowledgeDocuments): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.tenantId, tenantId));
  return Number(row?.n ?? 0);
}

// Total channel limit + per-type limit (e.g. Paket Plus: maks 2 WA, 2 IG).
export async function assertCanAddChannel(session: Session, type?: ChannelKind): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const { limits } = await sessionEntitlements(session);
  if (limits.maxChannels !== null && (await countTenant(session.tenantId, channels)) >= limits.maxChannels) {
    throw new PlanLimitError(`Paket ${planLabel(session)} maksimal ${limits.maxChannels} channel. Upgrade untuk menambah channel.`);
  }
  const perType = type ? limits.channels[type] : null;
  if (type && perType !== null) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(channels)
      .where(and(eq(channels.tenantId, session.tenantId), eq(channels.type, type)));
    if (Number(row?.n ?? 0) >= perType) {
      const label = CHANNEL_KINDS.find((c) => c.value === type)?.label ?? type;
      throw new PlanLimitError(`Paket ${planLabel(session)} maksimal ${perType} akun ${label}. Upgrade untuk menambah.`);
    }
  }
}

export async function assertCanAddAgent(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const { limits } = await sessionEntitlements(session);
  if (limits.maxAgents !== null && (await countTenant(session.tenantId, users)) >= limits.maxAgents) {
    throw new PlanLimitError(`Paket ${planLabel(session)} maksimal ${limits.maxAgents} anggota tim. Upgrade untuk menambah anggota.`);
  }
}

export async function assertCanAddKb(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const { limits } = await sessionEntitlements(session);
  if (limits.maxKbDocs !== null && (await countTenant(session.tenantId, knowledgeDocuments)) >= limits.maxKbDocs) {
    throw new PlanLimitError(`Paket ${planLabel(session)} maksimal ${limits.maxKbDocs} dokumen pengetahuan. Upgrade untuk menambah.`);
  }
}

// Monthly broadcast quota = recipients this month (UTC) that are queued, sent or
// delivered, plus the audience about to be added. The engine checks it again when a
// scheduled broadcast starts (engine/app/services/broadcast.py).
export async function assertBroadcastQuota(session: Session, audience = 0): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const ent = await sessionEntitlements(session);
  if (!ent.features.broadcast) {
    throw new PlanLimitError(`Fitur Broadcast tidak tersedia di paket ${planLabel(session)}. Upgrade paket untuk mengaktifkan.`);
  }
  const quota = ent.limits.broadcastPerMonth;
  if (quota === null) return;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.tenantId, session.tenantId),
        inArray(broadcastRecipients.status, ["pending", "sent", "delivered"]),
        gte(broadcastRecipients.createdAt, start.toISOString()),
      ),
    );
  const left = Math.max(quota - Number(row?.n ?? 0), 0);
  if (audience > left || left === 0) {
    const fmt = (n: number) => n.toLocaleString("id-ID");
    throw new PlanLimitError(
      left === 0
        ? `Kuota broadcast paket ${planLabel(session)} (${fmt(quota)}/bulan) sudah habis. Upgrade paket atau tunggu bulan depan.`
        : `Kuota broadcast tersisa ${fmt(left)} penerima bulan ini, broadcast ini ke ${fmt(audience)} penerima. Persempit tag penerima atau upgrade paket.`,
    );
  }
}
