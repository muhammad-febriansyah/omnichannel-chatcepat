import {
  Zap,
  MessageSquare,
  Image as ImageIcon,
  ShoppingBag,
  ListChecks,
  Clock,
  GitBranch,
  Variable,
  Sparkles,
  UserPlus,
  Globe,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "@/lib/flow-graph";

export type NodeGroup = "Pemicu" | "Pesan" | "Logika" | "AI & Agen";

export const NODE_META: Record<NodeKind, { label: string; desc: string; icon: LucideIcon; color: string; group: NodeGroup }> = {
  trigger: { label: "Pemicu", desc: "Awal flow: keyword, pesan pertama, atau cadangan", icon: Zap, color: "#f59e0b", group: "Pemicu" },
  send_text: { label: "Kirim Teks", desc: "Balas dengan pesan teks", icon: MessageSquare, color: "#3b82f6", group: "Pesan" },
  send_media: { label: "Kirim Media", desc: "Gambar/dokumen dari URL + caption", icon: ImageIcon, color: "#06b6d4", group: "Pesan" },
  send_catalog: { label: "Kirim Katalog", desc: "Foto + harga produk aktif", icon: ShoppingBag, color: "#0ea5e9", group: "Pesan" },
  menu: { label: "Menu Pilihan", desc: "Tampilkan opsi, cabang per jawaban", icon: ListChecks, color: "#6366f1", group: "Logika" },
  wait_reply: { label: "Tunggu Balasan", desc: "Simpan jawaban pelanggan ke variabel", icon: Clock, color: "#f97316", group: "Logika" },
  condition: { label: "Kondisi", desc: "Cabang berdasarkan isi variabel", icon: GitBranch, color: "#ec4899", group: "Logika" },
  set_var: { label: "Set Variabel", desc: "Isi variabel dengan nilai tetap", icon: Variable, color: "#64748b", group: "Logika" },
  ai_agent: { label: "AI Agent", desc: "Jawab otomatis dari knowledge base", icon: Sparkles, color: "#8b5cf6", group: "AI & Agen" },
  handoff: { label: "Alihkan ke Agen", desc: "Serahkan ke CS manusia, flow selesai", icon: UserPlus, color: "#10b981", group: "AI & Agen" },
};

export const PALETTE_GROUPS: { group: NodeGroup; kinds: NodeKind[] }[] = [
  { group: "Pesan", kinds: ["send_text", "send_media", "send_catalog"] },
  { group: "Logika", kinds: ["menu", "wait_reply", "condition", "set_var"] },
  { group: "AI & Agen", kinds: ["ai_agent", "handoff"] },
];

// Shown disabled in the palette until the engine has a scheduler / HTTP tool runner.
export const COMING_SOON: { label: string; icon: LucideIcon }[] = [
  { label: "HTTP Request", icon: Globe },
  { label: "Jeda Waktu", icon: Timer },
];

export const DRAG_MIME = "application/x-chatcepat-flow-node";
