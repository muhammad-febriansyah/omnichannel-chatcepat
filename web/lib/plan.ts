// Konstanta + tipe paket (client-safe, tanpa server-only / db).
export type TenantPlan = "pro" | "business" | "enterprise";

export const PLAN_LABEL: Record<TenantPlan, string> = {
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

// Tingkat paket (rendah → tinggi). Dipakai untuk gating fitur per-paket.
export const PLAN_RANK: Record<TenantPlan, number> = {
  pro: 0,
  business: 1,
  enterprise: 2,
};

// True bila paket `current` memenuhi minimal `required`.
export function planAllows(current: TenantPlan, required: TenantPlan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

// Kuota pesan outbound/bulan per paket (config produk; null = unlimited).
export const PLAN_QUOTA: Record<TenantPlan, number | null> = {
  pro: 5000,
  business: 25000,
  enterprise: null,
};

export interface SidebarStats {
  plan: TenantPlan;
  channelsConnected: number;
  channelsTotal: number;
  messagesSent: number; // outbound terkirim bulan ini
  quota: number | null;
}
