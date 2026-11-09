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

export type Platform = "wa" | "wa_official" | "instagram" | "facebook" | "telegram";

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "wa", label: "WhatsApp" },
  { value: "wa_official", label: "WA Official" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "telegram", label: "Telegram" },
];

const ALL_CHAT: Platform[] = ["wa", "wa_official", "instagram", "facebook", "telegram"];
const META_SOCIAL: Platform[] = ["instagram", "facebook"];

export type FlowTemplate = {
  id: string;
  title: string;
  desc: string;
  category: TemplateCategory;
  platforms: Platform[]; // where it works, shown as chips on the card
  level: "Mudah" | "Menengah";
  setup: string[]; // what to change after creating it, so users know where to start
  steps: string[]; // short outline shown on the card
  build: () => FlowGraph;
};

export function platformLabel(platforms: Platform[]): string {
  if (ALL_CHAT.every((p) => platforms.includes(p))) return "Semua channel chat";
  return PLATFORMS.filter((p) => platforms.includes(p.value)).map((p) => p.label).join(" · ");
}

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
    platforms: ["wa", "wa_official"],
    level: "Menengah",
    setup: ["Pilih akun WhatsApp pengirim & jadwal di Pemicu", "Ganti isi promo di Pesan Broadcast", "Pilih tag penerima (kosong = semua kontak opt-in)"],
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
    platforms: ["wa_official"],
    level: "Menengah",
    setup: ["Pilih akun WA Official & template HSM yang sudah disetujui", "Sambungkan tiap tombol ke langkah berikutnya", "Atur jadwal kirim di Pemicu"],
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
    platforms: ALL_CHAT,
    level: "Menengah",
    setup: ["Ganti alamat & jam buka di langkah Lokasi", "Sesuaikan cara order", "Pastikan produk aktif di menu Produk untuk katalog"],
    steps: ["Pesan pertama", "Menu 4 pilihan", "Katalog / info / CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "welcome", keywords: [] });
      const hi = g.add("send_text", {
        text: "Halo kak {{nama}} 👋 Selamat datang! Ada yang bisa kami bantu?",
        variants: ["Hai kak {{nama}}, terima kasih sudah chat kami 😊", "Halo {{nama}}! Senang bisa bantu kakak hari ini 🙌"],
      });
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
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Tambah/ubah keyword di Pemicu", "Pastikan produk aktif di menu Produk"],
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
    platforms: META_SOCIAL,
    level: "Menengah",
    setup: ["Pilih akun & postingan di Pemicu (atau biarkan semua postingan)", "Sesuaikan kata kunci komentar", "Ubah isi DM sesuai produk Anda"],
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
    platforms: META_SOCIAL,
    level: "Mudah",
    setup: ["Pilih akun & postingan di Pemicu", "Ganti variasi ucapan terima kasih"],
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
    platforms: META_SOCIAL,
    level: "Mudah",
    setup: ["Pilih postingan giveaway di Pemicu", "Ganti kode promo di Kirim DM", "Sesuaikan kata kunci (mis. MAU, IKUT)"],
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
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Unggah dokumen pengetahuan (FAQ, harga, kebijakan) di AI Agent", "Pilih gaya bahasa AI"],
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
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Isi promo yang sedang berjalan di AI Agent", "Sesuaikan keyword promo"],
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
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Sesuaikan keyword komplain", "Atur instruksi AI (apa yang boleh/tidak dijanjikan)"],
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
    platforms: ALL_CHAT,
    level: "Menengah",
    setup: ["Sesuaikan pertanyaan (nama, alamat, pesanan)", "Ubah pesan ringkasan"],
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
    platforms: ALL_CHAT,
    level: "Menengah",
    setup: ["Sesuaikan pertanyaan tanggal/jam/jumlah orang", "Ubah pesan konfirmasi"],
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
    platforms: ["wa_official"],
    level: "Mudah",
    setup: ["Samakan label tombol dengan tombol di template broadcast", "Isi detail promo"],
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
  // --- WhatsApp / semua chat -------------------------------------------------------
  {
    id: "natural-greeting-ai",
    title: "Sapa Natural + AI",
    desc: "Pesan pertama disapa dengan kalimat yang berganti-ganti (tidak terlihat bot), lalu pertanyaan pelanggan dijawab AI. Cocok untuk WA nomor pribadi.",
    category: "chat",
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Ubah variasi sapaan di Kirim Teks", "Unggah dokumen pengetahuan di AI Agent"],
    steps: ["Pesan pertama", "Sapaan (4 variasi)", "Tunggu pertanyaan", "AI menjawab", "Perlu CS → Alihkan"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "welcome", keywords: [] });
      const hi = g.add("send_text", {
        text: "Halo kak {{nama}} 👋 ada yang bisa kami bantu?",
        variants: [
          "Hai kak {{nama}}, terima kasih sudah menghubungi kami 😊 mau tanya apa nih?",
          "Halo kak! Silakan ceritakan kebutuhannya ya, kami bantu 🙏",
          "Hai {{nama}} 👋 lagi cari produk apa kak?",
        ],
      });
      const wait = g.add("wait_reply", { saveAs: "pertanyaan" });
      const bot = g.add("ai_agent", ai({ role: "cs", tone: "ramah" }));
      const cs = g.add("handoff", {});
      g.chain(t, hi, wait, bot);
      g.link(bot, cs, "handoff");
      return g.graph();
    },
  },
  {
    id: "menu-ai-hybrid",
    title: "Menu + Tanya AI",
    desc: "Sambut pelanggan dengan menu singkat. Pilihan \"Tanya lainnya\" dijawab AI, \"Bicara dengan CS\" langsung ke admin.",
    category: "ai",
    platforms: ALL_CHAT,
    level: "Menengah",
    setup: ["Pastikan produk aktif untuk katalog", "Isi promo di langkah Promo", "Unggah dokumen pengetahuan di AI Agent"],
    steps: ["Pesan pertama", "Menu 4 pilihan", "Katalog / promo / AI / CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "welcome", keywords: [] });
      const m = g.add(
        "menu",
        menu("Halo kak {{nama}} 👋 mau dibantu apa hari ini?", [
          ["1", "Lihat produk & harga"],
          ["2", "Promo minggu ini"],
          ["3", "Tanya lainnya"],
          ["4", "Bicara dengan CS"],
        ]),
      );
      const cat = g.add("send_catalog", { category: "", intro: "Ini produk kami kak 👇" });
      const promo = g.add("send_text", { text: "Promo minggu ini 🎉\n(isi promo, periode, syarat)\n\nMau order? Balas *ORDER* ya kak." });
      const ask = g.add("send_text", { text: "Silakan tulis pertanyaannya kak, kami jawab ya 😊" });
      const wait = g.add("wait_reply", { saveAs: "pertanyaan" });
      const bot = g.add("ai_agent", ai({ role: "cs", tone: "ramah" }));
      const cs = g.add("handoff", {});
      g.chain(t, m);
      const opts = (g.nodes.find((n) => n.id === m)!.data as NodeDataMap["menu"]).options;
      g.link(m, cat, `opt:${opts[0].id}`).link(m, promo, `opt:${opts[1].id}`).link(m, ask, `opt:${opts[2].id}`).link(m, cs, `opt:${opts[3].id}`);
      g.chain(ask, wait, bot);
      g.link(bot, cs, "handoff");
      return g.graph();
    },
  },
  // --- Instagram / Facebook DM --------------------------------------------------------
  {
    id: "dm-social-menu",
    title: "Balas DM Instagram/Facebook",
    desc: "Orang DM \"info\", \"harga\", atau \"halo\" di Instagram/Facebook → disapa natural lalu diberi menu: katalog, ongkir, atau CS.",
    category: "chat",
    platforms: META_SOCIAL,
    level: "Menengah",
    setup: ["Pilih akun Instagram/Facebook di Pemicu", "Sesuaikan keyword DM", "Ganti info ongkir & pengiriman"],
    steps: ["DM berisi keyword", "Sapaan (3 variasi)", "Menu 3 pilihan", "Katalog / ongkir / CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["info", "harga", "halo", "hai", "ready", "pm"], channels: [] });
      const hi = g.add("send_text", {
        text: "Hai kak {{nama}} 👋 makasih sudah DM kami!",
        variants: ["Halo kak {{nama}}, terima kasih sudah menghubungi kami 😊", "Hai {{nama}}! Senang bisa bantu kakak 🙌"],
      });
      const m = g.add(
        "menu",
        menu("Mau dibantu yang mana kak?", [
          ["1", "Lihat produk & harga"],
          ["2", "Ongkir & pengiriman"],
          ["3", "Chat dengan admin"],
        ]),
      );
      const cat = g.add("send_catalog", { category: "", intro: "Ini produk kami kak 👇" });
      const ship = g.add("send_text", { text: "Kami kirim ke seluruh Indonesia 🚚\nEstimasi 2–4 hari kerja.\n(isi kurir & cara cek ongkir)" });
      const cs = g.add("handoff", {});
      g.chain(t, hi, m);
      const opts = (g.nodes.find((n) => n.id === m)!.data as NodeDataMap["menu"]).options;
      g.link(m, cat, `opt:${opts[0].id}`).link(m, ship, `opt:${opts[1].id}`).link(m, cs, `opt:${opts[2].id}`);
      return g.graph();
    },
  },
  // --- Komentar per postingan ---------------------------------------------------------
  {
    id: "comment-per-post",
    title: "Komentar Postingan Produk → DM Harga",
    desc: "Khusus postingan tertentu: setiap yang komentar dibalas publik lalu dikirimi harga produk itu lewat DM. Buat satu flow per postingan supaya balasannya beda-beda.",
    category: "komentar",
    platforms: META_SOCIAL,
    level: "Mudah",
    setup: ["Klik \"Pilih dari postingan\" di Pemicu dan pilih postingannya", "Ganti nama produk & harga di Kirim DM", "Duplikat flow ini untuk postingan lain"],
    steps: ["Komentar di postingan terpilih", "Balas publik (3 variasi)", "DM harga (2 variasi)", "Tunggu balasan", "Alihkan ke CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "comment", keywords: [], channels: [], posts: [] });
      const pub = g.add("reply_comment", {
        texts: [
          "Sudah kami DM ya kak {{nama}} 🙏",
          "Cek inbox kak {{nama}}, detail harganya ada di sana 📩",
          "Makasih kak {{nama}}! Harga & ukurannya kami kirim via DM ya 😊",
        ],
      });
      const dm = g.add("private_reply", {
        text: "Halo kak {{nama}} 👋 makasih sudah komen!\n\n*(Nama produk)*\nHarga: Rp(isi harga)\nUkuran/varian: (isi)\n\nMau order? Balas pesan ini ya kak.",
        variants: [
          "Hai kak {{nama}} 😊 ini info produk yang kakak tanya:\n\n*(Nama produk)* — Rp(isi harga)\nVarian: (isi)\n\nBalas DM ini kalau mau order ya!",
        ],
      });
      const wait = g.add("wait_reply", { saveAs: "jawaban" });
      const tag = g.add("add_tag", { tags: ["tertarik-produk"] });
      const cs = g.add("handoff", {});
      g.chain(t, pub, dm, wait, tag, cs);
      return g.graph();
    },
  },
  {
    id: "comment-lead-wa",
    title: "Komentar → Minta Nomor WhatsApp",
    desc: "Yang komentar \"daftar\"/\"mau\" dibalas publik, lalu lewat DM diminta nomor WhatsApp-nya. Kontak diberi tag lead untuk dihubungi tim sales.",
    category: "komentar",
    platforms: META_SOCIAL,
    level: "Menengah",
    setup: ["Pilih akun & postingan di Pemicu", "Sesuaikan kata kunci komentar", "Ubah pesan penutup"],
    steps: ["Komentar \"daftar\"", "Balas publik", "DM minta nomor WA", "Simpan nomor + tag lead", "Alihkan ke sales"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "comment", keywords: ["daftar", "mau", "ikut", "info", "join"], channels: [], posts: [] });
      const pub = g.add("reply_comment", { texts: ["Sudah kami DM ya kak {{nama}} 🙌", "Cek DM kak {{nama}}, kami kirim infonya 📩"] });
      const dm = g.add("private_reply", {
        text: "Halo kak {{nama}} 👋 makasih sudah tertarik!\n\nBoleh minta *nomor WhatsApp* kakak? Tim kami akan kirim detail lengkapnya di sana 😊",
      });
      const wait = g.add("wait_reply", { saveAs: "nomor_wa" });
      const tag = g.add("add_tag", { tags: ["lead-komentar"] });
      const thanks = g.add("send_text", {
        text: "Terima kasih kak! Nomor {{nomor_wa}} sudah kami catat, tim kami segera menghubungi ya 🙏",
        variants: ["Siap kak, sudah kami simpan ({{nomor_wa}}). Tunggu kabar dari tim kami ya 😊"],
      });
      const cs = g.add("handoff", {});
      g.chain(t, pub, dm, wait, tag, thanks, cs);
      return g.graph();
    },
  },
  {
    id: "comment-complaint",
    title: "Komentar Keluhan → Selesaikan di DM",
    desc: "Komentar bernada keluhan (\"kecewa\", \"belum sampai\", \"rusak\") dijawab publik dengan sopan, lalu dilanjutkan di DM supaya tidak ramai di kolom komentar.",
    category: "komentar",
    platforms: META_SOCIAL,
    level: "Menengah",
    setup: ["Sesuaikan kata kunci keluhan", "Ubah kalimat permintaan maaf", "Pastikan ada CS yang siap menerima"],
    steps: ["Komentar keluhan", "Balas publik (empatik)", "DM minta no. pesanan", "Tag komplain", "Alihkan ke CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", {
        kind: "comment",
        keywords: ["kecewa", "komplain", "rusak", "belum sampai", "lama", "refund", "penipu"],
        channels: [],
        posts: [],
      });
      const pub = g.add("reply_comment", {
        texts: [
          "Mohon maaf atas ketidaknyamanannya kak {{nama}} 🙏 kami hubungi lewat DM ya.",
          "Maaf ya kak {{nama}}, kami bantu cek sekarang. Mohon cek DM 🙏",
        ],
      });
      const dm = g.add("private_reply", {
        text: "Halo kak {{nama}}, mohon maaf atas kendalanya 🙏\n\nBoleh kirim *nomor pesanan* dan ceritakan masalahnya? Tim kami bantu selesaikan secepatnya.",
      });
      const wait = g.add("wait_reply", { saveAs: "detail_keluhan" });
      const tag = g.add("add_tag", { tags: ["komplain"] });
      const cs = g.add("handoff", {});
      g.chain(t, pub, dm, wait, tag, cs);
      return g.graph();
    },
  },
  // --- Penjualan & layanan ------------------------------------------------------------
  {
    id: "shipping-cost",
    title: "Tanya Ongkir",
    desc: "Pelanggan tanya ongkir → ditanya kota tujuan, lalu CS menghitung ongkir dan total.",
    category: "penjualan",
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Sesuaikan keyword di Pemicu", "Ubah info kurir"],
    steps: ["Keyword ongkir", "Tanya kota tujuan", "Simpan + konfirmasi", "Alihkan ke CS"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["ongkir", "ongkos kirim", "biaya kirim", "kirim ke"] });
      const ask = g.add("send_text", {
        text: "Siap kak, kirim ke *kota/kecamatan* mana?",
        variants: ["Boleh tahu alamat tujuannya di kota apa kak? Nanti kami cekkan ongkirnya 🚚"],
      });
      const wait = g.add("wait_reply", { saveAs: "kota" });
      const ok = g.add("send_text", { text: "Oke kak, ongkir ke {{kota}} kami cek dulu ya. Sebentar lagi admin kirim totalnya 🙏" });
      const cs = g.add("handoff", {});
      g.chain(t, ask, wait, ok, cs);
      return g.graph();
    },
  },
  {
    id: "order-status",
    title: "Cek Status Pesanan / Resi",
    desc: "Pelanggan tanya resi atau status pesanan → diminta nomor pesanan, ditandai, lalu admin mengecek.",
    category: "penjualan",
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Sesuaikan keyword di Pemicu", "Ubah pesan konfirmasi"],
    steps: ["Keyword resi/status", "Minta no. pesanan", "Tag cek-pesanan", "Alihkan ke admin"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["resi", "status pesanan", "pesanan saya", "sudah dikirim", "cek pesanan"] });
      const ask = g.add("send_text", {
        text: "Siap kak, boleh kirim *nomor pesanan* atau nama pemesannya?",
        variants: ["Kami bantu cek ya kak 😊 mohon kirim nomor pesanan / nama pemesan."],
      });
      const wait = g.add("wait_reply", { saveAs: "no_pesanan" });
      const tag = g.add("add_tag", { tags: ["cek-pesanan"] });
      const ok = g.add("send_text", { text: "Terima kasih kak, pesanan {{no_pesanan}} sedang kami cek. Mohon tunggu sebentar ya 🙏" });
      const cs = g.add("handoff", {});
      g.chain(t, ask, wait, tag, ok, cs);
      return g.graph();
    },
  },
  {
    id: "payment-confirm",
    title: "Konfirmasi Pembayaran",
    desc: "Pelanggan bilang \"sudah transfer\" → diminta nama & nominal, ditandai sudah bayar, lalu admin verifikasi.",
    category: "penjualan",
    platforms: ALL_CHAT,
    level: "Mudah",
    setup: ["Sesuaikan keyword di Pemicu", "Ubah pesan terima kasih"],
    steps: ["Keyword transfer", "Minta nama + nominal", "Tag sudah-bayar", "Alihkan ke admin"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["sudah transfer", "bukti transfer", "sudah bayar", "konfirmasi pembayaran", "udah tf"] });
      const ask = g.add("send_text", {
        text: "Terima kasih kak 🙏 boleh tulis *nama pengirim* dan *nominal* transfernya? Foto bukti transfer juga boleh dikirim.",
      });
      const wait = g.add("wait_reply", { saveAs: "info_bayar" });
      const tag = g.add("add_tag", { tags: ["sudah-bayar"] });
      const ok = g.add("send_text", {
        text: "Siap kak, pembayaran sedang kami cek. Pesanan diproses setelah dana masuk ya 😊",
        variants: ["Terima kasih kak! Admin kami verifikasi dulu, nanti dikabari ya 🙏"],
      });
      const cs = g.add("handoff", {});
      g.chain(t, ask, wait, tag, ok, cs);
      return g.graph();
    },
  },
  {
    id: "lead-qualify",
    title: "Kumpulkan Leads (Konsultasi)",
    desc: "Calon pelanggan minta konsultasi/penawaran → tanya nama, kebutuhan, dan kisaran budget, lalu diberi tag lead untuk tim sales.",
    category: "penjualan",
    platforms: ALL_CHAT,
    level: "Menengah",
    setup: ["Sesuaikan pertanyaan kebutuhan", "Ubah pilihan budget di Menu Pilihan", "Ganti tag sesuai tim sales"],
    steps: ["Keyword konsultasi", "Nama → kebutuhan", "Pilih budget", "Tag lead", "Alihkan ke sales"],
    build() {
      const g = new G();
      const t = g.add("trigger", { kind: "keyword", keywords: ["konsultasi", "penawaran", "daftar", "minta harga", "quotation"] });
      const q1 = g.add("send_text", { text: "Dengan senang hati kak 😊 boleh kenalan dulu, *nama* kakak siapa?" });
      const w1 = g.add("wait_reply", { saveAs: "nama_lead" });
      const q2 = g.add("send_text", { text: "Salam kenal kak {{nama_lead}}! Kebutuhannya untuk apa? Ceritakan singkat ya." });
      const w2 = g.add("wait_reply", { saveAs: "kebutuhan" });
      const m = g.add(
        "menu",
        menu(
          "Kisaran budget-nya berapa kak?",
          [
            ["1", "Di bawah 1 juta"],
            ["2", "1–5 juta"],
            ["3", "Di atas 5 juta"],
          ],
          "budget",
        ),
      );
      const tag = g.add("add_tag", { tags: ["lead"] });
      const ok = g.add("send_text", { text: "Terima kasih kak {{nama_lead}} 🙏 tim kami segera kirim penawaran yang pas untuk kebutuhan kakak." });
      const cs = g.add("handoff", {});
      g.chain(t, q1, w1, q2, w2, m);
      for (const o of (g.nodes.find((n) => n.id === m)!.data as NodeDataMap["menu"]).options) g.link(m, tag, `opt:${o.id}`);
      g.chain(tag, ok, cs);
      return g.graph();
    },
  },
];

export function findTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}
