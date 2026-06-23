import "server-only";

// Helper api.co.id (server-only). Dipakai flow connect channel untuk:
//  1. Validasi: cuma boleh connect akun yang BENAR-BENAR ada di api.co.id (cegah phantom).
//  2. Auto-isi external_id = nilai yang dikirim webhook api.co.id (resolve pesan masuk).
// Key sistem dari env APICO_API_KEY (sama dgn gateway), tidak pernah dari input user.

const BASE = (process.env.APICO_BASE_URL || "https://chat.api.co.id/api/v1/public").replace(/\/+$/, "");
const KEY = process.env.APICO_API_KEY || "";

export type ApiCoAccount = {
  externalId: string; // nilai yang dikirim webhook → cocokkan ke channels.external_id
  name: string;
  detail?: string;
};

const ENDPOINT: Record<string, string | undefined> = {
  wa_official: "/phone-numbers",
  facebook: "/facebook-pages",
  instagram: "/instagram-accounts",
};

export async function listApiCoAccounts(type: string): Promise<ApiCoAccount[]> {
  const path = ENDPOINT[type];
  if (!path || !KEY) return [];
  try {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: unknown };
    const data = Array.isArray(json.data) ? json.data : [];
    return data
      .map((d) => normalize(type, d as Record<string, unknown>))
      .filter((a): a is ApiCoAccount => !!a.externalId);
  } catch {
    return [];
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// external_id = field yang dikirim webhook api.co.id sesuai gateway businessID():
//  WA  → whatsapp_phone_number_id = record `id` (clyyy…)
//  FB  → page_id (Facebook Page ID)
//  IG  → instagram_account_id = record `id`
function normalize(type: string, d: Record<string, unknown>): ApiCoAccount {
  if (type === "wa_official") {
    return {
      externalId: str(d.id),
      name: str(d.verified_name) || str(d.display_phone_number) || str(d.id),
      detail: str(d.display_phone_number),
    };
  }
  if (type === "facebook") {
    return { externalId: str(d.page_id) || str(d.id), name: str(d.page_name) || str(d.id), detail: str(d.page_category) };
  }
  if (type === "instagram") {
    return { externalId: str(d.id), name: str(d.username) || str(d.id), detail: str(d.username) };
  }
  return { externalId: str(d.id), name: str(d.id) };
}
