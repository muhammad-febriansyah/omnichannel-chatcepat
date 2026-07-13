// Konstanta + tipe paket (client-safe, tanpa server-only / db).
// Tier aktif ditawarkan: basic (249k) < pro (449k) < enterprise (749k).
// 'business' = nilai enum lama (tak ditawarkan lagi) — dipertahankan agar data
// existing tak pecah. Batas fitur di-enforce server: lib/entitlements.ts.
export type TenantPlan = "basic" | "pro" | "business" | "enterprise";

export const PLAN_LABEL: Record<TenantPlan, string> = {
  basic: "Basic",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

// Tingkat paket (rendah → tinggi). Dipakai untuk gating fitur per-paket.
export const PLAN_RANK: Record<TenantPlan, number> = {
  basic: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

// True bila paket `current` memenuhi minimal `required`.
export function planAllows(current: TenantPlan, required: TenantPlan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

// Kuota broadcast/bulan per paket (selaras entitlements; null = unlimited).
export const PLAN_QUOTA: Record<TenantPlan, number | null> = {
  basic: 2000,
  pro: 10000,
  business: 10000, // tier lama = setara Pro (lihat entitlements PLAN_LIMITS.business)
  enterprise: null, // null = unlimited (selaras entitlements broadcastPerMonth = INF)
};

export interface SidebarStats {
  plan: TenantPlan;
  channelsConnected: number;
  channelsTotal: number;
  messagesSent: number; // outbound terkirim bulan ini
  quota: number | null;
}
