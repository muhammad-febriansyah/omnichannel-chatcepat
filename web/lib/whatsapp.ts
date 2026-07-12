// WhatsApp Cloud API — Embedded Signup helper (server-only).
// Flow: tombol "Hubungkan WhatsApp" → FB JS SDK luncurkan Embedded Signup (user pilih/
// buat WABA + nomor) → SDK balikan `code` + sessionInfo (waba_id, phone_number_id) →
// server tukar code jadi business token → subscribe app ke WABA → register nomor →
// simpan channel. Tanpa copy-paste Phone Number ID / token manual.
//
// ENV (server): FB_APP_ID/META_APP_ID, FB_APP_SECRET/META_APP_SECRET.

const GRAPH_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function appId(): string {
  const v = process.env.FB_APP_ID ?? process.env.META_APP_ID;
  if (!v) throw new Error("FB_APP_ID belum di-set");
  return v;
}
function appSecret(): string {
  const v = process.env.FB_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!v) throw new Error("FB_APP_SECRET belum di-set");
  return v;
}

async function graphError(res: Response): Promise<never> {
  let msg = `${res.status}`;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? msg;
  } catch {
    /* non-JSON */
  }
  throw new Error(`Graph API: ${msg}`);
}

// Tukar code Embedded Signup → business integration system-user token (non-expiring).
// Beda dari OAuth biasa: TANPA redirect_uri.
export async function exchangeWaCode(code: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId());
  url.searchParams.set("client_secret", appSecret());
  url.searchParams.set("code", code);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) await graphError(res);
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

// Subscribe app ke WABA → webhook pesan mulai dikirim ke callback gateway.
export async function subscribeWabaToApp(wabaId: string, token: string): Promise<void> {
  const url = new URL(`${GRAPH}/${wabaId}/subscribed_apps`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) await graphError(res);
}

// Register nomor ke Cloud API (wajib supaya bisa kirim). PIN = two-step verification.
// Best-effort: kalau nomor sudah ter-register, Graph balas error → diabaikan pemanggil.
export async function registerWaPhone(phoneNumberId: string, token: string, pin: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    cache: "no-store",
  });
  if (!res.ok) await graphError(res);
}

// Info nomor utk nama channel (display number + verified name).
export async function getWaPhoneInfo(
  phoneNumberId: string,
  token: string,
): Promise<{ displayPhoneNumber: string; verifiedName: string }> {
  const url = new URL(`${GRAPH}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) await graphError(res);
  const j = (await res.json()) as { display_phone_number?: string; verified_name?: string };
  return {
    displayPhoneNumber: j.display_phone_number ?? "",
    verifiedName: j.verified_name ?? "",
  };
}
