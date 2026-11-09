// Excel/CSV import: map spreadsheet columns to products or Tanya-jawab. Pure module —
// used by the import pages (preview) and the server actions (re-check), and by tests.

export type ImportKind = "products" | "faqs";

export type ProductRow = {
  name: string;
  priceIdr: number;
  stock: number;
  sku: string;
  category: string;
  description: string;
};
export type FaqRowIn = { question: string; answer: string };
export type RowError = { row: number; message: string }; // row = spreadsheet row number

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<ImportKind, Record<string, string[]>> = {
  products: {
    name: ["nama", "namaproduk", "produk", "name", "product", "productname", "item", "namabarang", "barang"],
    priceIdr: ["harga", "price", "hargajual", "hargarp", "rp", "hargasatuan"],
    stock: ["stok", "stock", "qty", "jumlah", "kuantitas", "quantity"],
    sku: ["sku", "kode", "kodeproduk", "kodebarang", "code"],
    category: ["kategori", "category", "jenis", "kelompok"],
    description: ["deskripsi", "description", "keterangan", "desc", "detail", "spesifikasi"],
  },
  faqs: {
    question: ["pertanyaan", "question", "tanya", "q", "pertanyaanpelanggan"],
    answer: ["jawaban", "answer", "jawab", "a", "balasan"],
  },
};

export const REQUIRED: Record<ImportKind, string[]> = { products: ["name", "priceIdr"], faqs: ["question", "answer"] };

export const FIELD_LABEL: Record<string, string> = {
  name: "Nama",
  priceIdr: "Harga",
  stock: "Stok",
  sku: "SKU",
  category: "Kategori",
  description: "Deskripsi",
  question: "Pertanyaan",
  answer: "Jawaban",
};

/** field → column index (-1 = not found). */
export function detectColumns(kind: ImportKind, columns: string[]): Record<string, number> {
  const keys = columns.map(norm);
  const out: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(ALIASES[kind])) {
    out[field] = keys.findIndex((k) => aliases.includes(k));
  }
  return out;
}

/** "Rp150.000", "150,000", "150000.00", "1.250.000" → whole rupiah. NaN = not a number. */
export function parseRupiah(raw: string): number {
  const s = (raw ?? "").toString().trim().toLowerCase().replace(/rp\.?|idr|\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, "")); // 1.250.000 / 150,000
  if (/^\d+([.,]\d{1,2})?$/.test(s)) return Math.round(Number(s.replace(",", "."))); // 150000 / 150000.0
  return NaN;
}

const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").toString().trim() : "");

export const MAX_IMPORT_ROWS = 1000;

export function rowsToProducts(columns: string[], rows: string[][]): { items: ProductRow[]; errors: RowError[]; missing: string[] } {
  const col = detectColumns("products", columns);
  const missing = REQUIRED.products.filter((f) => col[f] < 0).map((f) => FIELD_LABEL[f]);
  const items: ProductRow[] = [];
  const errors: RowError[] = [];
  if (missing.length) return { items, errors, missing };
  rows.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const line = i + 2; // header is row 1
    const name = cell(r, col.name).slice(0, 200);
    const price = parseRupiah(cell(r, col.priceIdr));
    const stockRaw = cell(r, col.stock);
    const stock = stockRaw ? parseRupiah(stockRaw) : 0;
    if (!name) return errors.push({ row: line, message: "Nama kosong" });
    if (!Number.isFinite(price)) return errors.push({ row: line, message: `Harga "${cell(r, col.priceIdr)}" bukan angka` });
    if (!Number.isFinite(stock)) return errors.push({ row: line, message: `Stok "${stockRaw}" bukan angka` });
    items.push({
      name,
      priceIdr: price,
      stock,
      sku: cell(r, col.sku).slice(0, 80),
      category: cell(r, col.category).slice(0, 80),
      description: cell(r, col.description).slice(0, 2000),
    });
  });
  return { items, errors, missing };
}

export function rowsToFaqs(columns: string[], rows: string[][]): { items: FaqRowIn[]; errors: RowError[]; missing: string[] } {
  const col = detectColumns("faqs", columns);
  const missing = REQUIRED.faqs.filter((f) => col[f] < 0).map((f) => FIELD_LABEL[f]);
  const items: FaqRowIn[] = [];
  const errors: RowError[] = [];
  if (missing.length) return { items, errors, missing };
  rows.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const line = i + 2;
    const question = cell(r, col.question).slice(0, 300);
    const answer = cell(r, col.answer).slice(0, 2000);
    if (question.length < 3) return errors.push({ row: line, message: "Pertanyaan kosong/terlalu pendek" });
    if (!answer) return errors.push({ row: line, message: "Jawaban kosong" });
    items.push({ question, answer });
  });
  return { items, errors, missing };
}

/** Example CSV the import pages offer for download. */
export const TEMPLATE_CSV: Record<ImportKind, string> = {
  products:
    "Nama,Harga,Stok,SKU,Kategori,Deskripsi\n" +
    "Susu Formula Bebelac 1 800g,150000,12,SUS-001,Susu,Untuk usia 0-6 bulan\n" +
    "Popok Merries M isi 34,99000,20,POP-M34,Popok,Ukuran M 6-11 kg\n",
  faqs:
    "Pertanyaan,Jawaban\n" +
    "Bisa bayar COD?,\"Bisa kak, COD untuk area Jakarta dan Tangerang.\"\n" +
    "Berapa lama pengiriman?,2-3 hari kerja untuk Pulau Jawa.\n",
};
