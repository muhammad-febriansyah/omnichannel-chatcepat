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

// Structured business facts the assistant may quote (engine: styles.BUSINESS_FIELDS).
export type BusinessInfo = {
  assistantName: string;
  businessName: string;
  hours: string;
  address: string;
  shipping: string;
  payment: string;
  returns: string;
  other: string;
};

export const EMPTY_BUSINESS_INFO: BusinessInfo = {
  assistantName: "",
  businessName: "",
  hours: "",
  address: "",
  shipping: "",
  payment: "",
  returns: "",
  other: "",
};

export const BUSINESS_FIELDS: { key: Exclude<keyof BusinessInfo, "assistantName" | "businessName">; label: string; placeholder: string; max: number; rows?: number }[] = [
  { key: "hours", label: "Jam operasional", placeholder: "Senin–Sabtu 08.00–21.00, Minggu libur", max: 200 },
  { key: "address", label: "Alamat / lokasi", placeholder: "Jl. Melati No. 5, Bandung (dekat Alun-alun)", max: 300 },
  { key: "shipping", label: "Pengiriman", placeholder: "JNE, J&T, SiCepat. Kirim di hari yang sama sebelum jam 15.00", max: 300 },
  { key: "payment", label: "Pembayaran", placeholder: "Transfer BCA/Mandiri, QRIS, COD area Bandung", max: 300 },
  { key: "returns", label: "Retur & garansi", placeholder: "Tukar ukuran maks. 7 hari, barang belum dipakai", max: 300 },
  { key: "other", label: "Info lain", placeholder: "Info penting lain yang sering ditanyakan", max: 1000, rows: 3 },
];

// engine snake_case <-> UI camelCase
export function businessToEngine(b: BusinessInfo): Record<string, string> {
  const out: Record<string, string> = {
    assistant_name: b.assistantName.trim(),
    business_name: b.businessName.trim(),
    hours: b.hours.trim(),
    address: b.address.trim(),
    shipping: b.shipping.trim(),
    payment: b.payment.trim(),
    returns: b.returns.trim(),
    other: b.other.trim(),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

export function businessFromEngine(raw: unknown): BusinessInfo {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    assistantName: str(r.assistant_name ?? r.assistantName),
    businessName: str(r.business_name ?? r.businessName),
    hours: str(r.hours),
    address: str(r.address),
    shipping: str(r.shipping),
    payment: str(r.payment),
    returns: str(r.returns),
    other: str(r.other),
  };
}

// Starting prompts per role ({{nama_asisten}} / {{nama_bisnis}} are filled by the engine).
export const PROMPT_TEMPLATES: Record<AgentRole, string> = {
  cs:
    "Kamu adalah {{nama_asisten}}, Customer Service {{nama_bisnis}}. Jawab pertanyaan pelanggan dengan jelas dan ringkas, " +
    "bantu sampai masalahnya selesai. Kalau pelanggan menanyakan status pesanan, minta nomor pesanan dulu. " +
    "Jangan menjanjikan hal yang tidak ada di info bisnis atau pengetahuan.",
  sales:
    "Kamu adalah {{nama_asisten}}, sales {{nama_bisnis}}. Tanyakan kebutuhan pelanggan (untuk apa, budget, ukuran/varian), " +
    "lalu rekomendasikan 1–2 produk yang paling cocok dari katalog beserta harganya. Akhiri dengan ajakan order yang sopan. " +
    "Jangan memaksa dan jangan mengarang stok atau harga.",
  reservasi:
    "Kamu adalah {{nama_asisten}}, admin reservasi {{nama_bisnis}}. Bantu pelanggan booking: tanyakan tanggal, jam, " +
    "jumlah orang, dan nama pemesan satu per satu. Setelah lengkap, ulangi ringkasannya dan sampaikan bahwa admin akan " +
    "mengonfirmasi ketersediaan.",
  promosi:
    "Kamu adalah {{nama_asisten}} dari {{nama_bisnis}}. Jelaskan promo yang sedang berjalan dengan antusias tapi jujur: " +
    "apa promonya, sampai kapan, dan syaratnya. Ajak pelanggan langsung order. Kalau tidak ada promo aktif, katakan apa adanya.",
  sosial:
    "Kamu admin media sosial {{nama_bisnis}} yang membalas komentar publik. Balas sangat singkat dan ramah, " +
    "jangan menyebut harga khusus atau data pribadi di kolom komentar — ajak pelanggan lanjut lewat DM.",
};

// Ready-made assistants for "Buat asisten" (the tenant edits everything afterwards).
export const ASSISTANT_PRESETS: {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  name: string;
  config: Partial<AiConfig>;
}[] = [
  {
    id: "cs",
    title: "Customer Service",
    desc: "Jawab pertanyaan umum, status pesanan, dan keluhan ringan dengan ramah.",
    emoji: "🎧",
    name: "CS",
    config: { role: "cs", tone: "ramah", emoji: "sedikit", length: "pendek" },
  },
  {
    id: "sales",
    title: "Sales / Admin Jualan",
    desc: "Gali kebutuhan, rekomendasikan produk dari katalog, ajak order.",
    emoji: "🛍️",
    name: "Sales",
    config: { role: "sales", tone: "ramah", emoji: "sedikit", length: "pendek", goal: "Bantu pelanggan memilih produk sampai order" },
  },
  {
    id: "reservasi",
    title: "Reservasi / Booking",
    desc: "Kumpulkan tanggal, jam, dan jumlah orang, lalu konfirmasi.",
    emoji: "📅",
    name: "Reservasi",
    config: { role: "reservasi", tone: "profesional", emoji: "sedikit", length: "pendek", greeting: "bapak_ibu" },
  },
  {
    id: "promosi",
    title: "Promosi",
    desc: "Jelaskan promo aktif dengan antusias dan ajak klaim.",
    emoji: "🔥",
    name: "Promo",
    config: { role: "promosi", tone: "promosi", emoji: "banyak", length: "pendek", goal: "Ajak pelanggan klaim promo dan order" },
  },
  {
    id: "komplain",
    title: "Penanganan Komplain",
    desc: "Empatik, minta detail masalah, lalu alihkan ke CS manusia.",
    emoji: "🤝",
    name: "Bantuan Komplain",
    config: {
      role: "cs",
      tone: "empatik",
      emoji: "tanpa",
      length: "pendek",
      handoffRules: "Pelanggan minta refund atau ganti barang\nPelanggan marah atau mengancam review buruk",
      instructions:
        "Kamu adalah {{nama_asisten}} dari {{nama_bisnis}} yang menangani keluhan pelanggan. Mulai dengan meminta maaf " +
        "atas ketidaknyamanannya, lalu tanyakan detail masalah (nomor pesanan, apa yang terjadi, foto bila perlu). " +
        "Jangan menyalahkan pelanggan dan jangan menjanjikan refund — sampaikan bahwa tim kami akan menindaklanjuti.",
    },
  },
  {
    id: "sosial",
    title: "Admin Media Sosial",
    desc: "Balasan komentar publik yang singkat, lanjut lewat DM.",
    emoji: "💬",
    name: "Admin Sosmed",
    config: { role: "sosial", tone: "santai", emoji: "sedikit", length: "pendek" },
  },
];

// Editor values for a new assistant from a preset (prompt = the role's sample unless set).
export function presetInput(presetId: string | undefined): AgentInput {
  const p = ASSISTANT_PRESETS.find((x) => x.id === presetId);
  const config = normalizeAiConfig({ ...DEFAULT_AI_CONFIG, ...(p?.config ?? {}) });
  if (p && !config.instructions) config.instructions = PROMPT_TEMPLATES[config.role];
  return { ...config, name: p?.name ?? "", isActive: true };
}

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
  businessInfo: BusinessInfo;
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
  businessInfo: EMPTY_BUSINESS_INFO,
};

// Missing keys (older nodes) fall back to defaults.
export function normalizeAiConfig(raw: unknown): AiConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<AiConfig>;
  return {
    ...DEFAULT_AI_CONFIG,
    ...v,
    examples: Array.isArray(v.examples) ? v.examples : [],
    documentIds: Array.isArray(v.documentIds) ? v.documentIds : [],
    businessInfo: { ...EMPTY_BUSINESS_INFO, ...(v.businessInfo && typeof v.businessInfo === "object" ? v.businessInfo : {}) },
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
