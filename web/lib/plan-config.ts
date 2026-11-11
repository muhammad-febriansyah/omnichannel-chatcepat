// What a plan grants (client-safe: used by the superadmin plan form, billing page and
// entitlements). Stored on plans.limits / plans.feature_flags / plans.flow_nodes.

import type { TenantPlan } from "./plan";

export type ChannelKind = "wa_official" | "wa_unofficial" | "instagram" | "facebook" | "telegram";

export const CHANNEL_KINDS: { value: ChannelKind; label: string }[] = [
  { value: "wa_official", label: "WhatsApp Official" },
  { value: "wa_unofficial", label: "WhatsApp (QR)" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "telegram", label: "Telegram" },
];

export type PlanFeature = "automation" | "broadcast" | "catalog" | "reports" | "multiNumber";

// hidden = not built yet: kept in stored flags, but not offered in the plan form or
// listed on the billing page, so no plan sells something that does nothing.
export const PLAN_FEATURES: { value: PlanFeature; label: string; desc: string; hidden?: boolean }[] = [
  { value: "automation", label: "Automation (Flow Builder)", desc: "Kanvas flow, template, auto-reply" },
  { value: "broadcast", label: "Broadcast", desc: "Kirim pesan massal ke kontak opt-in" },
  { value: "catalog", label: "Katalog Produk", desc: "Produk, harga, kirim katalog" },
  { value: "reports", label: "Laporan", desc: "Analitik percakapan & tim" },
  { value: "multiNumber", label: "Multi nomor per CS", desc: "Satu CS pegang banyak nomor", hidden: true },
];

// null = tanpa batas.
export type PlanLimitsConfig = {
  maxChannels: number | null; // total semua channel
  channels: Record<ChannelKind, number | null>;
  maxAgents: number | null;
  maxKbDocs: number | null;
  broadcastPerMonth: number | null;
};

export type PlanEntitlements = {
  limits: PlanLimitsConfig;
  features: Record<PlanFeature, boolean>;
  flowNodes: string[] | null; // null = semua langkah flow
  aiTokensMonthly: number;
};

const allChannels = (n: number | null): Record<ChannelKind, number | null> => ({
  wa_official: n,
  wa_unofficial: n,
  instagram: n,
  facebook: n,
  telegram: n,
});

// Defaults per tier — used when a plan row has no value for a key (older rows).
export const TIER_DEFAULTS: Record<TenantPlan, PlanEntitlements> = {
  basic: {
    limits: { maxChannels: 2, channels: allChannels(null), maxAgents: 3, maxKbDocs: 10, broadcastPerMonth: 2000 },
    features: { automation: false, broadcast: true, catalog: false, reports: false, multiNumber: false },
    flowNodes: null,
    aiTokensMonthly: 100_000,
  },
  pro: {
    limits: { maxChannels: 5, channels: allChannels(null), maxAgents: 10, maxKbDocs: 100, broadcastPerMonth: 10_000 },
    features: { automation: true, broadcast: true, catalog: true, reports: true, multiNumber: false },
    flowNodes: null,
    aiTokensMonthly: 300_000,
  },
  business: {
    limits: { maxChannels: 5, channels: allChannels(null), maxAgents: 10, maxKbDocs: 100, broadcastPerMonth: 10_000 },
    features: { automation: true, broadcast: true, catalog: true, reports: true, multiNumber: false },
    flowNodes: null,
    aiTokensMonthly: 300_000,
  },
  enterprise: {
    limits: { maxChannels: null, channels: allChannels(null), maxAgents: null, maxKbDocs: null, broadcastPerMonth: null },
    features: { automation: true, broadcast: true, catalog: true, reports: true, multiNumber: true },
    flowNodes: null,
    aiTokensMonthly: 1_000_000,
  },
};

function num(v: unknown, fallback: number | null): number | null {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return fallback;
}

// Plan row (jsonb, possibly partial) + tier defaults → complete entitlements.
export function resolveEntitlements(
  tier: TenantPlan,
  row: { limits?: unknown; featureFlags?: unknown; flowNodes?: unknown; aiTokensMonthly?: number } | null,
): PlanEntitlements {
  const base = TIER_DEFAULTS[tier] ?? TIER_DEFAULTS.basic;
  if (!row) return base;
  const l = (row.limits ?? {}) as Record<string, unknown>;
  const ch = (l.channels ?? {}) as Record<string, unknown>;
  const f = (row.featureFlags ?? {}) as Record<string, unknown>;
  return {
    limits: {
      maxChannels: num(l.maxChannels, base.limits.maxChannels),
      channels: Object.fromEntries(CHANNEL_KINDS.map((c) => [c.value, num(ch[c.value], base.limits.channels[c.value])])) as Record<
        ChannelKind,
        number | null
      >,
      maxAgents: num(l.maxAgents, base.limits.maxAgents),
      maxKbDocs: num(l.maxKbDocs, base.limits.maxKbDocs),
      broadcastPerMonth: num(l.broadcastPerMonth, base.limits.broadcastPerMonth),
    },
    features: Object.fromEntries(
      PLAN_FEATURES.map((x) => [x.value, typeof f[x.value] === "boolean" ? (f[x.value] as boolean) : base.features[x.value]]),
    ) as Record<PlanFeature, boolean>,
    flowNodes: Array.isArray(row.flowNodes) ? (row.flowNodes as unknown[]).map(String) : null,
    aiTokensMonthly: typeof row.aiTokensMonthly === "number" ? row.aiTokensMonthly : base.aiTokensMonthly,
  };
}

export function nodeAllowed(flowNodes: string[] | null, kind: string): boolean {
  // broadcast_message is governed by the "broadcast" feature, not the node list.
  return kind === "trigger" || kind === "broadcast_message" || flowNodes === null || flowNodes.includes(kind);
}

export const fmtLimit = (n: number | null) => (n === null ? "Tanpa batas" : n.toLocaleString("id-ID"));
export const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : n >= 1000 ? `${Math.round(n / 1000).toLocaleString("id-ID")} rb` : n.toLocaleString("id-ID");
