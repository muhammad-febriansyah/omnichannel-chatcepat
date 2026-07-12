import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { broadcastRecipients, channels, knowledgeDocuments, users } from "./db/schema";
import { PLAN_LABEL, type TenantPlan } from "./plan";
import type { Session } from "./session";

// Batas fitur per paket (lock sesuai pricing). Admin platform (god-mode) TIDAK
// dibatasi — lihat unlimited(). 'business' = paket lama → disamakan dengan Pro.
export type PlanFeature = "automation" | "catalog" | "multiNumber";

export type PlanLimits = {
  maxChannels: number; // Infinity = tanpa batas
  maxAgents: number;
  maxKbDocs: number;
  broadcastPerMonth: number;
  features: Record<PlanFeature, boolean>;
};

const INF = Number.POSITIVE_INFINITY;

const PRO: PlanLimits = {
  maxChannels: 5,
  maxAgents: 10,
  maxKbDocs: 100,
  broadcastPerMonth: 10000,
  features: { automation: true, catalog: true, multiNumber: false },
};

export const PLAN_LIMITS: Record<TenantPlan, PlanLimits> = {
  basic: {
    maxChannels: 2,
    maxAgents: 3,
    maxKbDocs: 10,
    broadcastPerMonth: 2000,
    features: { automation: false, catalog: false, multiNumber: false },
  },
  pro: PRO,
  business: PRO, // paket lama → setara Pro
  enterprise: {
    maxChannels: INF,
    maxAgents: INF,
    maxKbDocs: INF,
    broadcastPerMonth: 50000,
    features: { automation: true, catalog: true, multiNumber: true },
  },
};

export function planLimits(tier: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(tier as TenantPlan)] ?? PLAN_LIMITS.basic;
}

function planLabel(session: Session): string {
  return PLAN_LABEL[(session.plan as TenantPlan)] ?? PLAN_LABEL.basic;
}

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

// Admin platform tak terikat paket tenant (god-mode). Client terikat plan tenant.
function unlimited(session: Session): boolean {
  return session.isPlatformAdmin;
}

export function hasFeature(session: Session, feature: PlanFeature): boolean {
  if (unlimited(session)) return true;
  return planLimits(session.plan).features[feature];
}

export function requireFeature(session: Session, feature: PlanFeature, label: string): void {
  if (hasFeature(session, feature)) return;
  throw new PlanLimitError(
    `Fitur ${label} tidak tersedia di paket ${planLabel(session)}. Upgrade paket untuk mengaktifkan.`,
  );
}

async function countTenant(
  tenantId: string,
  table: typeof channels | typeof users | typeof knowledgeDocuments,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.tenantId, tenantId));
  return Number(row?.n ?? 0);
}

export async function assertCanAddChannel(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const lim = planLimits(session.plan);
  if (lim.maxChannels === INF) return;
  if ((await countTenant(session.tenantId, channels)) >= lim.maxChannels) {
    throw new PlanLimitError(
      `Paket ${planLabel(session)} maksimal ${lim.maxChannels} channel. Upgrade untuk menambah channel.`,
    );
  }
}

export async function assertCanAddAgent(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const lim = planLimits(session.plan);
  if (lim.maxAgents === INF) return;
  if ((await countTenant(session.tenantId, users)) >= lim.maxAgents) {
    throw new PlanLimitError(
      `Paket ${planLabel(session)} maksimal ${lim.maxAgents} anggota tim. Upgrade untuk menambah anggota.`,
    );
  }
}

export async function assertCanAddKb(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const lim = planLimits(session.plan);
  if (lim.maxKbDocs === INF) return;
  if ((await countTenant(session.tenantId, knowledgeDocuments)) >= lim.maxKbDocs) {
    throw new PlanLimitError(
      `Paket ${planLabel(session)} maksimal ${lim.maxKbDocs} dokumen knowledge base. Upgrade untuk menambah.`,
    );
  }
}

// Kuota broadcast bulanan = jumlah penerima 'sent' sejak awal bulan (UTC).
export async function assertBroadcastQuota(session: Session): Promise<void> {
  if (unlimited(session) || !session.tenantId) return;
  const lim = planLimits(session.plan);
  if (lim.broadcastPerMonth === INF) return;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.tenantId, session.tenantId),
        eq(broadcastRecipients.status, "sent"),
        gte(broadcastRecipients.createdAt, start.toISOString()),
      ),
    );
  if (Number(row?.n ?? 0) >= lim.broadcastPerMonth) {
    throw new PlanLimitError(
      `Kuota broadcast paket ${planLabel(session)} (${lim.broadcastPerMonth.toLocaleString("id-ID")}/bulan) sudah habis. Upgrade paket atau tunggu bulan depan.`,
    );
  }
}
