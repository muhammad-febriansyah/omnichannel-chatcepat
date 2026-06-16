// Konstanta + tipe paket (client-safe, tanpa server-only / db).
export type TenantPlan = "pro" | "business" | "enterprise";

export const PLAN_LABEL: Record<TenantPlan, string> = {
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

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
