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

// Hasil ambil akun: pisahkan "kosong beneran" (key OK, akun nol) dari "gagal
// menghubungi" (key salah/endpoint/network). Dulu semua error ditelan jadi [] →
// UI connect kosong tanpa alasan + createChannel lempar pesan menyesatkan.
export type ApiCoAccountsResult = { accounts: ApiCoAccount[]; error?: string };

const ENDPOINT: Record<string, string | undefined> = {
  wa_official: "/phone-numbers",
  facebook: "/facebook-pages",
  instagram: "/instagram-accounts",
};

export async function listApiCoAccounts(type: string): Promise<ApiCoAccountsResult> {
  const path = ENDPOINT[type];
  if (!path) return { accounts: [], error: `Tipe channel "${type}" tidak didukung api.co.id` };
  if (!KEY) return { accounts: [], error: "APICO_API_KEY belum diset di server" };
  try {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail = extractErr(safeJson(body)) || truncate(body, 300);
      const error = `api.co.id ${path}: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`;
      console.error("[apico] listAccounts gagal:", error);
      return { accounts: [], error };
    }
    const json = (await res.json()) as { data?: unknown };
    const data = Array.isArray(json.data) ? json.data : [];
    const accounts = data
      .map((d) => normalize(type, d as Record<string, unknown>))
      .filter((a): a is ApiCoAccount => !!a.externalId);
    return { accounts };
  } catch (e) {
    const error = e instanceof Error ? e.message : "gagal menghubungi api.co.id";
    console.error("[apico] listAccounts error:", error);
    return { accounts: [], error };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

const AUTH = { Authorization: `Bearer ${KEY}` };

// `error` api.co.id bisa string atau object {message,code} → ambil pesan apa pun bentuknya.
function extractErr(json: unknown): string {
  const j = json as { error?: unknown; message?: unknown } | null;
  if (!j) return "";
  const e = j.error;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; detail?: unknown };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.detail === "string" && o.detail) return o.detail;
  }
  if (typeof j.message === "string" && j.message) return j.message;
  return "";
}

// --- WhatsApp templates (HSM) — dikelola di api.co.id (sumber kebenaran, sinkron status Meta) ---

export type ApiCoTemplate = {
  id: string;
  name: string; // template_name (dipakai saat kirim)
  language: string;
  status: string; // APPROVED | PENDING | REJECTED | PAUSED | DISABLED
  category: string;
  body: string; // content
};

function normalizeTemplate(d: Record<string, unknown>): ApiCoTemplate {
  return {
    id: str(d.id),
    name: str(d.template_name) || str(d.name),
    language: str(d.language) || "id",
    status: (str(d.status) || "PENDING").toUpperCase(),
    category: str(d.category),
    body: str(d.content) || str(d.body),
  };
}

export async function listApiCoTemplates(opts?: { status?: string }): Promise<ApiCoTemplate[]> {
  if (!KEY) return [];
  const qs = opts?.status ? `?status=${encodeURIComponent(opts.status)}` : "";
  try {
    const res = await fetch(`${BASE}/templates${qs}`, { headers: AUTH, cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: unknown };
    const data = Array.isArray(json.data) ? json.data : [];
    return data.map((d) => normalizeTemplate(d as Record<string, unknown>)).filter((t) => t.name);
  } catch {
    return [];
  }
}

export type CreateTemplateInput = {
  templateName: string;
  category: string; // MARKETING | UTILITY | AUTHENTICATION
  language: string;
  body: string; // pakai {{1}}, {{2}} untuk variabel
  variables?: string[]; // contoh nilai per placeholder (urut dari 1)
  footer?: string;
};

// POST /templates (buat draft). Return id untuk di-submit ke Meta.
export async function createApiCoTemplate(
  input: CreateTemplateInput,
): Promise<{ id: string; status: string } | { error: string }> {
  if (!KEY) return { error: "APICO_API_KEY belum diset di server" };
  try {
    const res = await fetch(`${BASE}/templates`, {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_name: input.templateName,
        category: input.category,
        language: input.language,
        body: input.body,
        ...(input.variables && input.variables.length ? { variables: input.variables } : {}),
        ...(input.footer ? { footer: input.footer } : {}),
      }),
    });
    const json = (await res.json().catch(() => null)) as { data?: { id?: unknown; status?: unknown } } | null;
    const id = json?.data?.id;
    if (!res.ok || !id) return { error: extractErr(json) || `HTTP ${res.status}` };
    return { id: String(id), status: String(json?.data?.status ?? "PENDING").toUpperCase() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "gagal menghubungi api.co.id" };
  }
}

// POST /templates/:id/submit (kirim ke Meta untuk approval).
export async function submitApiCoTemplate(id: string): Promise<{ status: string } | { error: string }> {
  if (!KEY) return { error: "APICO_API_KEY belum diset di server" };
  try {
    const res = await fetch(`${BASE}/templates/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      headers: AUTH,
    });
    const json = (await res.json().catch(() => null)) as { data?: { status?: unknown } } | null;
    if (!res.ok) return { error: extractErr(json) || `HTTP ${res.status}` };
    return { status: String(json?.data?.status ?? "PENDING").toUpperCase() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "gagal menghubungi api.co.id" };
  }
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
