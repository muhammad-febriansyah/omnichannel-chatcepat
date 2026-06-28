import crypto from "crypto";

// Duitku POP — createInvoice (hosted checkout page). Docs: https://docs.duitku.com
const ENV = process.env.DUITKU_ENV ?? "sandbox";
const BASE = ENV === "production" ? "https://api-prod.duitku.com" : "https://api-sandbox.duitku.com";
const MERCHANT = process.env.DUITKU_MERCHANT_CODE ?? "";
const API_KEY = process.env.DUITKU_API_KEY ?? "";

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function duitkuConfigured(): boolean {
  return Boolean(MERCHANT && API_KEY);
}

export interface CreateInvoiceInput {
  merchantOrderId: string;
  amount: number; // rupiah penuh
  productDetails: string;
  email: string;
  customerName: string;
  callbackUrl: string;
  returnUrl: string;
  expiryMinutes?: number;
}

export interface CreateInvoiceResult {
  reference: string;
  paymentUrl: string;
}

// Buat invoice → balik paymentUrl (halaman bayar Duitku). Signature header SHA256.
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  if (!duitkuConfigured()) throw new Error("Duitku belum dikonfigurasi (DUITKU_MERCHANT_CODE / DUITKU_API_KEY)");
  const timestamp = Date.now().toString();
  const signature = sha256(MERCHANT + timestamp + API_KEY);
  const res = await fetch(`${BASE}/api/merchant/createInvoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-duitku-signature": signature,
      "x-duitku-timestamp": timestamp,
      "x-duitku-merchantcode": MERCHANT,
    },
    body: JSON.stringify({
      paymentAmount: input.amount,
      merchantOrderId: input.merchantOrderId,
      productDetails: input.productDetails,
      email: input.email,
      customerVaName: input.customerName,
      callbackUrl: input.callbackUrl,
      returnUrl: input.returnUrl,
      expiryPeriod: input.expiryMinutes ?? 60,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string;
    statusMessage?: string;
    reference?: string;
    paymentUrl?: string;
  };
  if (!res.ok || data.statusCode !== "00" || !data.paymentUrl || !data.reference) {
    throw new Error(data.statusMessage || `Duitku gagal membuat invoice (${res.status})`);
  }
  return { reference: data.reference, paymentUrl: data.paymentUrl };
}

// Verifikasi signature callback Duitku (MD5). Tolak kalau merchant/sig tak cocok.
export function verifyCallbackSignature(p: {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  signature: string;
}): boolean {
  if (!p.merchantCode || p.merchantCode !== MERCHANT) return false;
  const expected = md5(MERCHANT + p.amount + p.merchantOrderId + API_KEY);
  return expected.toLowerCase() === (p.signature || "").toLowerCase();
}
