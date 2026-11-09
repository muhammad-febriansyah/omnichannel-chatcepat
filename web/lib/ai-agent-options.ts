// Shared option lists for AI agents (labels shown in the UI; values match the
// engine's style templates and the DB check constraints in migration 0022).

export type AgentRole = "cs" | "sales" | "reservasi" | "promosi" | "sosial";
export type AgentTone = "ramah" | "profesional" | "promosi" | "santai" | "singkat" | "empatik";
export type AgentEmoji = "tanpa" | "sedikit" | "banyak";
export type AgentLength = "pendek" | "sedang";
export type AgentGreeting = "kak" | "bapak_ibu" | "nama";
export type AgentLanguage = "auto" | "id" | "en";

export const ROLES: { value: AgentRole; label: string; desc: string }[] = [
  { value: "cs", label: "Customer Service", desc: "Jawab pertanyaan, selesaikan masalah" },
  { value: "sales", label: "Sales", desc: "Rekomendasi produk sampai pelanggan pesan" },
  { value: "reservasi", label: "Reservasi", desc: "Kumpulkan data booking & konfirmasi" },
  { value: "promosi", label: "Promosi", desc: "Jelaskan promo aktif & ajak beli" },
  { value: "sosial", label: "Komentar Sosial", desc: "Balasan singkat di publik, lanjut via DM" },
];

// sample = how a reply to "Ada promo apa kak?" sounds in this tone (preview only).
export const TONES: { value: AgentTone; label: string; emoji: string; desc: string; sample: string }[] = [
  {
    value: "ramah",
    label: "Ramah",
    emoji: "😊",
    desc: "Hangat & bersahabat",
    sample: "Halo Kak 😊 Minggu ini ada diskon 20% untuk semua kaos. Mau aku bantu pilihkan ukurannya?",
  },
  {
    value: "profesional",
    label: "Profesional",
    emoji: "💼",
    desc: "Formal & sopan",
    sample: "Selamat siang, Bapak/Ibu. Saat ini berlaku diskon 20% untuk seluruh produk kaos hingga 30 November.",
  },
  {
    value: "promosi",
    label: "Promosi",
    emoji: "🔥",
    desc: "Persuasif, ajak beli",
    sample: "Pas banget Kak! 🔥 Diskon 20% semua kaos, cuma sampai 30 Nov. Stok terbatas, mau langsung aku bantu order?",
  },
  {
    value: "santai",
    label: "Santai",
    emoji: "😎",
    desc: "Akrab, bahasa sehari-hari",
    sample: "Ada dong! Semua kaos lagi diskon 20% nih sampai akhir bulan. Kamu lagi cari yang model apa?",
  },
  {
    value: "singkat",
    label: "Singkat",
    emoji: "⚡",
    desc: "Langsung ke inti",
    sample: "Diskon 20% semua kaos s/d 30 Nov.",
  },
  {
    value: "empatik",
    label: "Empatik",
    emoji: "🤝",
    desc: "Menenangkan, untuk komplain",
    sample: "Terima kasih sudah bertanya, Kak. Saat ini ada diskon 20% untuk kaos — kalau ada kendala saat order, aku bantu sampai beres ya.",
  },
];

export const EMOJIS: { value: AgentEmoji; label: string }[] = [
  { value: "tanpa", label: "Tanpa emoji" },
  { value: "sedikit", label: "Sedikit" },
  { value: "banyak", label: "Banyak" },
];

export const LENGTHS: { value: AgentLength; label: string }[] = [
  { value: "pendek", label: "Pendek (1–3 kalimat)" },
  { value: "sedang", label: "Sedang (maks 5 kalimat)" },
];

export const GREETINGS: { value: AgentGreeting; label: string }[] = [
  { value: "kak", label: "Kak" },
  { value: "bapak_ibu", label: "Bapak/Ibu" },
  { value: "nama", label: "Nama pelanggan" },
];

export const LANGUAGES: { value: AgentLanguage; label: string }[] = [
  { value: "auto", label: "Ikuti bahasa pelanggan" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

export const toneMeta = (v: string) => TONES.find((t) => t.value === v) ?? TONES[0];
export const roleLabel = (v: string) => ROLES.find((r) => r.value === v)?.label ?? v;

export type AgentInput = {
  name: string;
  role: AgentRole;
  tone: AgentTone;
  emoji: AgentEmoji;
  length: AgentLength;
  greeting: AgentGreeting;
  language: AgentLanguage;
  goal: string;
  instructions: string;
  examples: { q: string; a: string }[];
  handoffRules: string;
  fallbackMessage: string;
  knowledgeAll: boolean;
  documentIds: string[];
  useCatalog: boolean;
  usePromos: boolean;
  isActive: boolean;
};

// AI settings stored on a flow "AI Agent" node (and the tenant default AI).
export type AiConfig = Omit<AgentInput, "name" | "isActive">;

export const DEFAULT_AI_CONFIG: AiConfig = {
  role: "cs",
  tone: "ramah",
  emoji: "sedikit",
  length: "pendek",
  greeting: "kak",
  language: "auto",
  goal: "",
  instructions: "",
  examples: [],
  handoffRules: "",
  fallbackMessage: "",
  knowledgeAll: true,
  documentIds: [],
  useCatalog: true,
  usePromos: true,
};

// Missing keys (older nodes) fall back to defaults.
export function normalizeAiConfig(raw: unknown): AiConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<AiConfig>;
  return {
    ...DEFAULT_AI_CONFIG,
    ...v,
    examples: Array.isArray(v.examples) ? v.examples : [],
    documentIds: Array.isArray(v.documentIds) ? v.documentIds : [],
  };
}

// --- Data the AI node manages inline (Pengetahuan & Promo live in the node panel) ---

export type KnowledgeDoc = { id: string; title: string; status: string };

export type PromoState = "berjalan" | "terjadwal" | "berakhir" | "nonaktif";

export type PromoItem = {
  id: string;
  title: string;
  description: string;
  code: string;
  startsAt: string; // YYYY-MM-DD (WIB) or ""
  endsAt: string;
  isActive: boolean;
  period: string; // human label
  state: PromoState;
};
