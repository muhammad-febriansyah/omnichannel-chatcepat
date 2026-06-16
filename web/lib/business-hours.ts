// Tipe + default jam kerja (client-safe). Disimpan di tenants.settings.business_hours.
// Acuan: docs/prd/05-message-flow.md (jam kerja & out-of-office). Zona waktu WIB.
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
];

export interface DayHours {
  enabled: boolean;
  open: string; // "HH:MM"
  close: string;
}

export interface BusinessHours {
  days: Record<DayKey, DayHours>;
  outOfOffice: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: {
    mon: { enabled: true, open: "09:00", close: "17:00" },
    tue: { enabled: true, open: "09:00", close: "17:00" },
    wed: { enabled: true, open: "09:00", close: "17:00" },
    thu: { enabled: true, open: "09:00", close: "17:00" },
    fri: { enabled: true, open: "09:00", close: "17:00" },
    sat: { enabled: false, open: "09:00", close: "13:00" },
    sun: { enabled: false, open: "09:00", close: "13:00" },
  },
  outOfOffice: "Halo! Saat ini kami di luar jam operasional. Pesan kamu akan kami balas pada jam kerja berikutnya. 🙏",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Gabungkan data tersimpan dgn default + sanitasi (anti data rusak dari jsonb).
export function normalizeBusinessHours(raw: unknown): BusinessHours {
  const r = (raw ?? {}) as Partial<BusinessHours>;
  const days = {} as Record<DayKey, DayHours>;
  for (const { key } of DAYS) {
    const d = (r.days?.[key] ?? {}) as Partial<DayHours>;
    const def = DEFAULT_BUSINESS_HOURS.days[key];
    days[key] = {
      enabled: typeof d.enabled === "boolean" ? d.enabled : def.enabled,
      open: typeof d.open === "string" && TIME_RE.test(d.open) ? d.open : def.open,
      close: typeof d.close === "string" && TIME_RE.test(d.close) ? d.close : def.close,
    };
  }
  return {
    days,
    outOfOffice: typeof r.outOfOffice === "string" ? r.outOfOffice : DEFAULT_BUSINESS_HOURS.outOfOffice,
  };
}
