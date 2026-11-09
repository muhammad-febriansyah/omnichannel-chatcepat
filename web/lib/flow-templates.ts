// Ready-made flows users start from (Automation → Template). Each template builds a
// normal canvas graph, so everything stays editable after it is created.
// Pure module: used by the template gallery, createFlowFromTemplate and tests.

import { DEFAULT_AI_CONFIG, type AiConfig } from "./ai-agent-options";
import { autoLayout, newId, type FlowGraph, type GraphEdge, type GraphNode, type NodeDataMap, type NodeKind } from "./flow-graph";

export type TemplateCategory = "chat" | "broadcast" | "komentar" | "ai" | "penjualan";

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "chat", label: "Chat & Menu" },
  { value: "broadcast", label: "Broadcast" },
  { value: "komentar", label: "Komentar FB/IG" },
  { value: "ai", label: "AI Agent" },
  { value: "penjualan", label: "Penjualan & Leads" },
];

export type FlowTemplate = {
  id: string;
  title: string;
  desc: string;
  category: TemplateCategory;
  channels: string; // where it fits, shown on the card
  steps: string[]; // short outline shown on the card
  build: () => FlowGraph;
};

// --- tiny builder ---------------------------------------------------------------------

class G {
  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];

  add<K extends NodeKind>(type: K, data: NodeDataMap[K]): string {
    const id = type === "trigger" ? "start" : newId();
    this.nodes.push({ id, type, position: { x: 0, y: 0 }, data } as GraphNode);
    return id;
  }

  link(source: string, target: string, handle = "out"): this {
    this.edges.push({ id: newId("e"), source, sourceHandle: handle, target });
    return this;
  }

  // a → b → c … on the default output
  chain(...ids: string[]): this {
    for (let i = 0; i < ids.length - 1; i++) this.link(ids[i], ids[i + 1]);
    return this;
  }

  graph(): FlowGraph {
    return autoLayout({ nodes: this.nodes, edges: this.edges });
  }
}

const ai = (patch: Partial<AiConfig>): { ai: AiConfig } => ({ ai: { ...DEFAULT_AI_CONFIG, ...patch } });

function menu(prompt: string, options: [string, string][], saveAs = "pilihan"): NodeDataMap["menu"] {
  return {
    prompt,
    saveAs,
    invalidText: "Maaf, pilihan belum dikenali. Balas dengan angka pilihan ya kak 🙏",
    options: options.map(([code, label]) => ({ id: newId("o"), code, label })),
  };
}

// --- templates ------------------------------------------------------------------------

const broadcastMsg = (patch: Partial<NodeDataMap["broadcast_message"]>): NodeDataMap["broadcast_message"] => ({
  text: "",
  mediaUrl: "",
  template: "",
  language: "",
  headerFormat: "",
  headerUrl: "",
  params: [],
  buttons: [],
  saveAs: "balasan",
  ...patch,
});

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "broadcast-promo",
    title: "Broadcast Promo + Follow-up",
    desc: "Kirim promo terjadwal ke kontak opt-in. Yang membalas \"1\" dapat detail promo & ditandai, sisanya dijawab AI.",
    category: "broadcast",
    channels: "WhatsApp",
    steps: ["Broadcast terjadwal", "Pesan promo", "Balas 1 → detail + tag", "Balasan lain → AI"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "broadcast", keywords: [], channels: [], tags: [], scheduleAt: null });
      const msg = g.add(
        "broadcast_message",
        broadcastMsg({
          text: "Halo kak {{nama}} 👋\n\nPromo spesial minggu ini: *diskon 20%* untuk semua produk! 🎉\n\nBalas *1* untuk info lengkap.\nBalas *STOP* jika tidak ingin menerima pesan promo lagi.",
        }),
      );
      const cond = g.add("condition", { variable: "balasan", rules: [{ id: newId("r"), op: "contains", value: "1" }] });
      const info = g.add("send_text", { text: "Siap kak {{nama}}! Ini detail promonya:\n(isi detail promo, syarat, periode)\n\nMau langsung order? Balas *ORDER* ya 😊" });
      const tag = g.add("add_tag", { tags: ["tertarik-promo"] });
      const bot = g.add("ai_agent", ai({}));
      const rule = (g.nodes.find((n) => n.id === cond)!.data as NodeDataMap["condition"]).rules[0].id;
      g.chain(t, msg, cond);
      g.link(cond, info, `rule:${rule}`).chain(info, tag);
      g.link(cond, bot, "else");
      return g.graph();
    },
  },
  {
    id: "broadcast-template-buttons",
    title: "Broadcast Template + Tombol",
    desc: "WA Official: kirim template HSM terjadwal. Tiap tombol quick reply punya cabang sendiri — sambungkan setelah memilih template.",
    category: "broadcast",
    channels: "WhatsApp Official",
    steps: ["Broadcast terjadwal", "Template HSM", "Cabang per tombol", "Balasan lain → CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "broadcast", keywords: [], channels: [], tags: [], scheduleAt: null });
      const msg = g.add("broadcast_message", broadcastMsg({}));
      const tag = g.add("add_tag", { tags: ["respon-broadcast"] });
      const cs = g.add("handoff", {});
      g.chain(t, msg, tag, cs);
      return g.graph();
    },
  },
  {
    id: "welcome-menu",
    title: "Sambutan + Menu Utama",
    desc: "Sapa pelanggan baru lalu tampilkan menu: katalog, cara order, lokasi, atau bicara dengan CS.",
    category: "chat",
    channels: "WhatsApp · Instagram · Facebook · Telegram",
    steps: ["Pesan pertama", "Menu 4 pilihan", "Katalog / info / CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "welcome", keywords: [] });
      const hi = g.add("send_text", { text: "Halo kak {{nama}} 👋 Selamat datang! Ada yang bisa kami bantu?" });
      const m = g.add(
        "menu",
        menu("Silakan pilih menu di bawah ini:", [
          ["1", "Lihat katalog & harga"],
          ["2", "Cara order"],
          ["3", "Lokasi & jam buka"],
          ["4", "Bicara dengan CS"],
        ]),
      );
      const cat = g.add("send_catalog", { category: "", intro: "Ini produk terbaru kami kak 👇" });
      const order = g.add("send_text", {
        text: "Cara order mudah kak:\n1. Pilih produk & jumlah\n2. Kirim nama + alamat lengkap\n3. Transfer sesuai total\n4. Pesanan kami kirim di hari yang sama 🚚",
      });
      const loc = g.add("send_text", { text: "📍 Toko kami: (isi alamat)\n🕘 Buka Senin–Sabtu 08.00–21.00\nGoogle Maps: (isi link)" });
      const cs = g.add("handoff", {});
      g.chain(t, hi, m);
      const opts = (g.nodes.find((n) => n.id === m)!.data as NodeDataMap["menu"]).options;
      g.link(m, cat, `opt:${opts[0].id}`).link(m, order, `opt:${opts[1].id}`).link(m, loc, `opt:${opts[2].id}`).link(m, cs, `opt:${opts[3].id}`);
      return g.graph();
    },
  },
  {
    id: "keyword-price",
    title: "Info Harga (keyword)",
    desc: "Pelanggan ketik \"harga\" atau \"pricelist\" → kirim katalog lalu tanya mau order.",
    category: "chat",
    channels: "Semua channel chat",
    steps: ["Keyword harga", "Kirim katalog", "Tawarkan bantuan CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["harga", "pricelist", "price list", "katalog"] });
      const cat = g.add("send_catalog", { category: "", intro: "Ini daftar harga terbaru kak {{nama}} 👇" });
      const ask = g.add("send_text", { text: "Ada yang ingin dipesan kak? Balas nama produk & jumlahnya, nanti CS kami bantu proses 😊" });
      const cs = g.add("handoff", {});
      g.chain(t, cat, ask, cs);
      return g.graph();
    },
  },
  {
    id: "comment-to-dm",
    title: "Komentar → DM Otomatis",
    desc: "Orang komentar \"info\"/\"harga\" di postingan → dibalas publik, lalu dikirimi DM berisi info dan ditanya lanjut.",
    category: "komentar",
    channels: "Instagram · Facebook Page",
    steps: ["Komentar berisi kata kunci", "Balas publik (3 variasi)", "Kirim DM", "Lanjut di DM dengan AI"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "comment", keywords: ["info", "harga", "berapa", "mau", "order", "pm"], channels: [], posts: [] });
      const pub = g.add("reply_comment", {
        texts: [
          "Halo kak {{nama}}! Infonya sudah kami kirim lewat DM ya 🙏",
          "Siap kak {{nama}}, cek DM ya! 📩",
          "Terima kasih kak {{nama}} 😊 detailnya kami kirim ke DM.",
        ],
      });
      const dm = g.add("private_reply", {
        text: "Halo kak {{nama}} 👋 terima kasih sudah komentar di postingan kami!\n\nMau kami kirimkan daftar harga & promo terbaru? Balas pesan ini ya kak 😊",
      });
      const wait = g.add("wait_reply", { saveAs: "jawaban" });
      const bot = g.add("ai_agent", ai({ role: "sales", tone: "ramah", goal: "Bantu pelanggan memilih produk sampai order" }));
      const cs = g.add("handoff", {});
      g.chain(t, pub, dm, wait, bot);
      g.link(bot, cs, "handoff");
      return g.graph();
    },
  },
  {
    id: "comment-thanks",
    title: "Balas Semua Komentar",
    desc: "Setiap komentar di postingan dibalas ucapan terima kasih (variasi acak) supaya engagement naik.",
    category: "komentar",
    channels: "Instagram · Facebook Page",
    steps: ["Semua komentar", "Balas publik (4 variasi)"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "comment", keywords: [], channels: [], posts: [] });
      const pub = g.add("reply_comment", {
        texts: [
          "Terima kasih kak {{nama}} 🙏",
          "Makasih sudah mampir kak {{nama}} 😊",
          "Terima kasih kak! Jangan lupa follow untuk promo berikutnya ✨",
          "Siap kak {{nama}}, terima kasih dukungannya 💙",
        ],
      });
      g.chain(t, pub);
      return g.graph();
    },
  },
  {
    id: "comment-giveaway",
    title: "Giveaway / Kode Promo via Komentar",
    desc: "Orang komentar kata kunci giveaway → dibalas publik dan dikirimi kode promo lewat DM, kontak diberi tag.",
    category: "komentar",
    channels: "Instagram · Facebook Page",
    steps: ["Komentar \"MAU\"", "Balas publik", "DM kode promo", "Tag kontak"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "comment", keywords: ["mau", "ikut", "promo"], channels: [], posts: [] });
      const pub = g.add("reply_comment", { texts: ["Kodenya sudah dikirim ke DM ya kak {{nama}} 🎁", "Cek DM kak {{nama}}, ada hadiah buat kamu 🎉"] });
      const dm = g.add("private_reply", {
        text: "Halo kak {{nama}} 🎉 Ini kode promo spesial kamu: *HEMAT10* (diskon 10%, berlaku 7 hari).\n\nBalas pesan ini kalau mau langsung order ya!",
      });
      const tag = g.add("add_tag", { tags: ["promo-komentar"] });
      g.chain(t, pub, dm, tag);
      return g.graph();
    },
  },
  {
    id: "ai-faq",
    title: "CS AI 24 Jam",
    desc: "Pesan yang tidak cocok flow lain dijawab AI dari dokumen pengetahuan Anda. Bila AI ragu atau pelanggan minta manusia → CS.",
    category: "ai",
    channels: "Semua channel chat",
    steps: ["Pesan tak dikenali", "AI Agent (ramah)", "Perlu CS → Alihkan"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "fallback", keywords: [] });
      const bot = g.add("ai_agent", ai({ role: "cs", tone: "ramah" }));
      const note = g.add("send_text", { text: "Baik kak, kami sambungkan ke tim CS ya. Mohon tunggu sebentar 🙏" });
      const cs = g.add("handoff", {});
      g.chain(t, bot);
      g.link(bot, note, "handoff").chain(note, cs);
      return g.graph();
    },
  },
  {
    id: "ai-promo",
    title: "AI Promosi",
    desc: "Pelanggan tanya promo/diskon → AI gaya promosi menjelaskan promo yang sedang berjalan dan mengajak order.",
    category: "ai",
    channels: "Semua channel chat",
    steps: ["Keyword promo", "AI Agent (promosi)", "Perlu CS → Alihkan"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["promo", "diskon", "voucher", "sale"] });
      const bot = g.add("ai_agent", ai({ role: "promosi", tone: "promosi", emoji: "banyak", goal: "Ajak pelanggan klaim promo dan order" }));
      const cs = g.add("handoff", {});
      g.chain(t, bot);
      g.link(bot, cs, "handoff");
      return g.graph();
    },
  },
  {
    id: "ai-complaint",
    title: "Tangani Komplain",
    desc: "Kata seperti \"rusak\", \"komplain\", \"kecewa\" → tag kontak, AI empatik minta detail, lalu serahkan ke CS.",
    category: "ai",
    channels: "Semua channel chat",
    steps: ["Keyword komplain", "Tag komplain", "AI empatik", "Alihkan ke CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["komplain", "rusak", "kecewa", "refund", "retur"] });
      const tag = g.add("add_tag", { tags: ["komplain"] });
      const bot = g.add("ai_agent", ai({ role: "cs", tone: "empatik", instructions: "Minta nomor pesanan dan foto masalah. Jangan menjanjikan refund." }));
      const cs = g.add("handoff", {});
      g.chain(t, tag, bot, cs);
      g.link(bot, cs, "handoff");
      return g.graph();
    },
  },
  {
    id: "order-form",
    title: "Form Order via Chat",
    desc: "Kumpulkan nama, alamat, dan pesanan satu per satu, beri tag \"order-baru\", lalu teruskan ke admin.",
    category: "penjualan",
    channels: "Semua channel chat",
    steps: ["Keyword order", "Tanya nama → alamat → pesanan", "Ringkasan + tag", "Alihkan ke admin"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["order", "pesan", "beli", "checkout"] });
      const q1 = g.add("send_text", { text: "Siap kak, kami bantu order 😊\nBoleh tulis *nama lengkap* penerima?" });
      const w1 = g.add("wait_reply", { saveAs: "nama_penerima" });
      const q2 = g.add("send_text", { text: "Terima kasih kak {{nama_penerima}}. Sekarang *alamat lengkap* + kode pos ya." });
      const w2 = g.add("wait_reply", { saveAs: "alamat" });
      const q3 = g.add("send_text", { text: "Terakhir, *produk & jumlah* yang dipesan apa kak?" });
      const w3 = g.add("wait_reply", { saveAs: "pesanan" });
      const tag = g.add("add_tag", { tags: ["order-baru"] });
      const sum = g.add("send_text", {
        text: "Ringkasan pesanan:\n👤 {{nama_penerima}}\n🏠 {{alamat}}\n🛒 {{pesanan}}\n\nAdmin kami segera kirim total & nomor rekening ya kak 🙏",
      });
      const cs = g.add("handoff", {});
      g.chain(t, q1, w1, q2, w2, q3, w3, tag, sum, cs);
      return g.graph();
    },
  },
  {
    id: "booking",
    title: "Reservasi / Booking",
    desc: "Pelanggan booking jadwal: tanya tanggal, jam, dan jumlah orang, lalu konfirmasi oleh admin.",
    category: "penjualan",
    channels: "Semua channel chat",
    steps: ["Keyword booking", "Tanggal → jam → jumlah", "Tag + alihkan"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["booking", "reservasi", "jadwal", "janji"] });
      const q1 = g.add("send_text", { text: "Mau booking untuk *tanggal* berapa kak? (mis. 20 Desember)" });
      const w1 = g.add("wait_reply", { saveAs: "tanggal" });
      const q2 = g.add("send_text", { text: "Jam berapa kak? (mis. 19.00)" });
      const w2 = g.add("wait_reply", { saveAs: "jam" });
      const q3 = g.add("send_text", { text: "Untuk berapa orang?" });
      const w3 = g.add("wait_reply", { saveAs: "jumlah_orang" });
      const tag = g.add("add_tag", { tags: ["booking"] });
      const ok = g.add("send_text", { text: "Booking dicatat: {{tanggal}}, {{jam}}, {{jumlah_orang}} orang. Admin kami konfirmasi ketersediaan sebentar lagi ya kak 🙏" });
      const cs = g.add("handoff", {});
      g.chain(t, q1, w1, q2, w2, q3, w3, tag, ok, cs);
      return g.graph();
    },
  },
  {
    id: "broadcast-button",
    title: "Follow-up Tombol Broadcast",
    desc: "Pelanggan klik tombol \"Mau Info\" di broadcast WA → kirim detail, tag \"tertarik\", lalu CS lanjutkan.",
    category: "penjualan",
    channels: "WhatsApp Official",
    steps: ["Klik tombol broadcast", "Kirim detail", "Tag tertarik", "Alihkan ke CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "button", keywords: ["Mau Info"] });
      const info = g.add("send_text", { text: "Terima kasih kak {{nama}}! Ini detail promonya: (isi detail promo)\n\nAda yang ingin ditanyakan? CS kami siap bantu 😊" });
      const tag = g.add("add_tag", { tags: ["tertarik-promo"] });
      const cs = g.add("handoff", {});
      g.chain(t, info, tag, cs);
      return g.graph();
    },
  },
];

export function findTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}
