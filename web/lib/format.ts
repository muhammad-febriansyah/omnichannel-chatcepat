export function cleanIDR(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function rupiah(n: number): string {
  return "Rp " + cleanIDR(n);
}

export type ChannelType =
  | "wa_official"
  | "wa_unofficial"
  | "instagram"
  | "facebook"
  | "telegram";

export const CHANNEL_META: Record<ChannelType, { label: string; color: string; short: string }> = {
  wa_official: { label: "WhatsApp", color: "#25d366", short: "WA" },
  wa_unofficial: { label: "WhatsApp", color: "#25d366", short: "WA" },
  instagram: { label: "Instagram", color: "#dd2a7b", short: "IG" },
  facebook: { label: "Facebook", color: "#1877f2", short: "FB" },
  telegram: { label: "Telegram", color: "#0088cc", short: "TG" },
};

const STATUS_LABEL: Record<string, string> = {
  open: "Terbuka",
  pending: "Menunggu",
  resolved: "Selesai",
  snoozed: "Ditunda",
  connected: "Terhubung",
  disconnected: "Terputus",
  banned: "Diblokir",
  active: "Aktif",
  suspended: "Ditangguhkan",
  // Status dokumen knowledge base (AI Agent)
  ready: "Siap",
  processing: "Diproses",
  failed: "Gagal",
};

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s.replace(/_/g, " ");
}

// Label peran (role) berbahasa Indonesia yang familiar untuk user.
const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  agent: "Agen",
};

export function roleLabel(r: string): string {
  return ROLE_LABEL[r] ?? r.replace(/_/g, " ");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}j`;
  return `${Math.floor(s / 86400)}h`;
}

// Jam pesan (HH:MM, WIB) untuk bubble chat.
export function clock(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

// Kunci hari (YYYY-MM-DD) di zona WIB — untuk mengelompokkan pesan per tanggal.
export function dayKey(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

// Label pemisah tanggal di thread: "Hari ini" / "Kemarin" / "12 Juni 2026".
export function dayLabel(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const key = dayKey(d);
  if (key === dayKey(new Date())) return "Hari ini";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}
