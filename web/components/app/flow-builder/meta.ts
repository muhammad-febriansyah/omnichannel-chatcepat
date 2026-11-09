import {
  Zap,
  MessageSquare,
  Image as ImageIcon,
  ShoppingBag,
  ListChecks,
  Clock,
  GitBranch,
  Variable,
  Tag,
  Sparkles,
  UserPlus,
  Globe,
  Timer,
  MessageCircleReply,
  Send,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "@/lib/flow-graph";

export type NodeGroup = "Pemicu" | "Kirim Pesan" | "Tanya & Pilihan" | "Komentar FB/IG" | "Broadcast" | "Logika & Data" | "AI & Agen";

// Where a step works. Absent = every chat channel (WhatsApp, Instagram, Facebook, Telegram).
export type NodeChannel = "WA" | "WA Official" | "FB" | "IG";

type Meta = {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  group: NodeGroup;
  // Extra words people type when searching (Indonesian + common slang/English).
  keywords: string;
  channels?: NodeChannel[];
};

export const NODE_META: Record<NodeKind, Meta> = {
  trigger: { label: "Pemicu", desc: "Awal flow: keyword, komentar, broadcast terjadwal, klik tombol, pesan pertama, atau cadangan", icon: Zap, color: "#f59e0b", group: "Pemicu", keywords: "mulai start trigger awal" },
  send_text: { label: "Kirim Teks", desc: "Balas dengan pesan teks (bisa beberapa variasi kalimat)", icon: MessageSquare, color: "#2547f9", group: "Kirim Pesan", keywords: "pesan balas chat text tulis sapa variasi natural" },
  send_media: { label: "Kirim Media", desc: "Gambar/dokumen dari URL + caption", icon: ImageIcon, color: "#06b6d4", group: "Kirim Pesan", keywords: "foto gambar image video pdf dokumen file brosur lampiran" },
  send_catalog: { label: "Kirim Katalog", desc: "Foto + harga produk aktif", icon: ShoppingBag, color: "#0ea5e9", group: "Kirim Pesan", keywords: "produk harga pricelist katalog toko jualan" },
  menu: { label: "Menu Pilihan", desc: "Tampilkan opsi, cabang per jawaban", icon: ListChecks, color: "#6366f1", group: "Tanya & Pilihan", keywords: "tombol button pilihan opsi list angka cabang" },
  wait_reply: { label: "Tunggu Balasan", desc: "Tanya lalu simpan jawaban pelanggan ke variabel", icon: Clock, color: "#f97316", group: "Tanya & Pilihan", keywords: "tanya jawab input form isi nama alamat simpan" },
  reply_comment: { label: "Balas Komentar", desc: "Balasan publik di bawah komentar postingan", icon: MessageCircleReply, color: "#e1306c", group: "Komentar FB/IG", keywords: "komentar comment postingan post reels publik instagram facebook", channels: ["FB", "IG"] },
  private_reply: { label: "Kirim DM", desc: "Pesan pribadi ke orang yang berkomentar", icon: Send, color: "#1877f2", group: "Komentar FB/IG", keywords: "dm direct message inbox pribadi private komentar instagram facebook", channels: ["FB", "IG"] },
  broadcast_message: { label: "Pesan Broadcast", desc: "Pesan massal ke kontak opt-in (langkah pertama flow broadcast)", icon: Megaphone, color: "#7c3aed", group: "Broadcast", keywords: "broadcast blast massal promo jadwal template hsm whatsapp", channels: ["WA", "WA Official"] },
  condition: { label: "Kondisi", desc: "Cabang berdasarkan isi variabel", icon: GitBranch, color: "#ec4899", group: "Logika & Data", keywords: "if jika kondisi cabang logika filter" },
  set_var: { label: "Set Variabel", desc: "Isi variabel dengan nilai tetap", icon: Variable, color: "#64748b", group: "Logika & Data", keywords: "variabel data simpan nilai" },
  add_tag: { label: "Beri Tag", desc: "Tandai kontak untuk segmen & broadcast", icon: Tag, color: "#14b8a6", group: "Logika & Data", keywords: "tag label segmen kontak lead" },
  ai_agent: { label: "AI Agent", desc: "Jawab otomatis dari knowledge base", icon: Sparkles, color: "#8b5cf6", group: "AI & Agen", keywords: "ai bot gpt otomatis jawab faq cs pintar" },
  handoff: { label: "Alihkan ke Agen", desc: "Serahkan ke CS manusia, flow selesai", icon: UserPlus, color: "#10b981", group: "AI & Agen", keywords: "cs admin manusia agen operator serahkan" },
};

export const PALETTE_GROUPS: { group: NodeGroup; hint: string; kinds: NodeKind[] }[] = [
  { group: "Kirim Pesan", hint: "Balasan ke pelanggan", kinds: ["send_text", "send_media", "send_catalog"] },
  { group: "Tanya & Pilihan", hint: "Ajak pelanggan menjawab", kinds: ["menu", "wait_reply"] },
  { group: "Komentar FB/IG", hint: "Untuk pemicu Komentar", kinds: ["reply_comment", "private_reply"] },
  { group: "Broadcast", hint: "Untuk pemicu Broadcast terjadwal", kinds: ["broadcast_message"] },
  { group: "Logika & Data", hint: "Cabang, variabel, tag", kinds: ["condition", "set_var", "add_tag"] },
  { group: "AI & Agen", hint: "Jawaban AI & CS manusia", kinds: ["ai_agent", "handoff"] },
];

// Which palette group fits a trigger kind best — shown first so the right steps are on top.
export const GROUP_FOR_TRIGGER: Partial<Record<string, NodeGroup>> = {
  comment: "Komentar FB/IG",
  broadcast: "Broadcast",
};

// Search over label, description, keywords and channel names (case/diacritic-insensitive).
export function nodeMatches(kind: NodeKind, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const m = NODE_META[kind];
  const channels = (m.channels ?? ["WA", "FB", "IG", "Telegram", "whatsapp", "instagram", "facebook"]).join(" ");
  const hay = `${m.label} ${m.desc} ${m.keywords} ${m.group} ${channels}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

// Shown disabled in the palette until the engine has a scheduler / HTTP tool runner.
export const COMING_SOON: { label: string; icon: LucideIcon }[] = [
  { label: "HTTP Request", icon: Globe },
  { label: "Jeda Waktu", icon: Timer },
];

export const DRAG_MIME = "application/x-chatcepat-flow-node";
