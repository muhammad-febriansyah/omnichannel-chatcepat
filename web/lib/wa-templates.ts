import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { channels } from "./db/schema";
import { decryptCreds } from "./channel-crypto";
import { GRAPH, graphError } from "./whatsapp";

export type WaHeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type WaTemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone: string };

// WhatsApp message templates (HSM), read and created straight from the Meta Graph API.
// Templates belong to a WABA, so each one is tagged with the channel (WABA) it came from.
// Meta is the source of truth for status; nothing is cached locally.

export type WaTemplate = {
  id: string;
  name: string; // template name used when sending
  language: string;
  status: string; // APPROVED | PENDING | REJECTED | PAUSED | DISABLED
  category: string;
  body: string; // BODY component text
  variableCount: number; // number of {{n}} placeholders in the body
  headerFormat: WaHeaderFormat;
  headerText: string; // TEXT header (may contain {{1}})
  headerExample: string; // sample media URL Meta stored at review time (if any)
  footer: string;
  buttons: WaTemplateButton[];
  channelId: string;
  channelName: string;
};

export type WaChannelCreds = { id: string; name: string; wabaId: string; token: string };

type GraphButton = { type?: string; text?: string; url?: string; phone_number?: string };
type GraphComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: GraphButton[];
  example?: { header_handle?: string[]; header_url?: string[] };
};
type GraphTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  components?: GraphComponent[];
};

export function countVariables(body: string): number {
  const nums = new Set<string>();
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) nums.add(m[1]);
  return nums.size;
}

// Connected wa_official channels of a tenant that have WABA credentials.
export async function listWaChannelCreds(tenantId: string, channelId?: string): Promise<WaChannelCreds[]> {
  const rows = await db.query.channels.findMany({
    where: and(
      eq(channels.tenantId, tenantId),
      eq(channels.type, "wa_official"),
      eq(channels.status, "connected"),
      ...(channelId ? [eq(channels.id, channelId)] : []),
    ),
    columns: { id: true, name: true, credentials: true },
  });
  const out: WaChannelCreds[] = [];
  for (const r of rows) {
    const c = decryptCreds((r.credentials ?? {}) as Record<string, unknown>);
    const wabaId = typeof c.waba_id === "string" ? c.waba_id : "";
    const token = typeof c.access_token === "string" ? c.access_token : "";
    if (wabaId && token) out.push({ id: r.id, name: r.name, wabaId, token });
  }
  return out;
}

async function fetchChannelTemplates(ch: WaChannelCreds): Promise<WaTemplate[]> {
  const out: WaTemplate[] = [];
  let next: string | null = (() => {
    const url = new URL(`${GRAPH}/${ch.wabaId}/message_templates`);
    url.searchParams.set("fields", "id,name,language,status,category,components");
    url.searchParams.set("limit", "100");
    return url.toString();
  })();
  // Follow paging, capped so a huge WABA can't stall a page render.
  for (let page = 0; next && page < 5; page++) {
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${ch.token}` },
      cache: "no-store",
    });
    if (!res.ok) await graphError(res);
    const j = (await res.json()) as { data?: GraphTemplate[]; paging?: { next?: string } };
    for (const t of j.data ?? []) {
      const comps = t.components ?? [];
      const body = comps.find((c) => c.type === "BODY")?.text ?? "";
      const header = comps.find((c) => c.type === "HEADER");
      const buttons: WaTemplateButton[] = (comps.find((c) => c.type === "BUTTONS")?.buttons ?? []).map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text ?? "", url: b.url ?? "" }
          : b.type === "PHONE_NUMBER"
            ? { type: "PHONE_NUMBER", text: b.text ?? "", phone: b.phone_number ?? "" }
            : { type: "QUICK_REPLY", text: b.text ?? "" },
      );
      out.push({
        id: t.id ?? "",
        name: t.name ?? "",
        language: t.language ?? "id",
        status: (t.status ?? "PENDING").toUpperCase(),
        category: t.category ?? "",
        body,
        variableCount: countVariables(body),
        headerFormat: ((header?.format ?? "NONE").toUpperCase() as WaHeaderFormat) || "NONE",
        headerText: header?.format === "TEXT" ? (header.text ?? "") : "",
        headerExample: header?.example?.header_handle?.[0] ?? header?.example?.header_url?.[0] ?? "",
        footer: comps.find((c) => c.type === "FOOTER")?.text ?? "",
        buttons,
        channelId: ch.id,
        channelName: ch.name,
      });
    }
    next = j.paging?.next ?? null;
  }
  return out;
}

export type WaTemplatesResult = { templates: WaTemplate[]; errors: string[] };

// Templates across all of a tenant's connected WABAs. A failing channel (expired token,
// missing permission) is reported in `errors` instead of hiding every template.
export async function listWaTemplates(
  tenantId: string,
  opts?: { status?: string; channelId?: string },
): Promise<WaTemplatesResult> {
  const chans = await listWaChannelCreds(tenantId, opts?.channelId);
  const results = await Promise.allSettled(chans.map(fetchChannelTemplates));
  const templates: WaTemplate[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") templates.push(...r.value);
    else errors.push(`${chans[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });
  const status = opts?.status?.toUpperCase();
  return {
    templates: status ? templates.filter((t) => t.status === status) : templates,
    errors,
  };
}

export type CreateWaTemplateInput = {
  channelId: string;
  templateName: string;
  category: string; // MARKETING | UTILITY | AUTHENTICATION
  language: string;
  body: string; // uses {{1}}, {{2}} for variables
  variables?: string[]; // example value per placeholder (in order from 1)
  footer?: string;
  header?: { format: WaHeaderFormat; text?: string; handle?: string };
  buttons?: WaTemplateButton[];
};

// Submit a new template to Meta for review. Returns Meta's initial status.
export async function createWaTemplateOnMeta(
  ch: WaChannelCreds,
  input: Omit<CreateWaTemplateInput, "channelId">,
): Promise<{ id: string; status: string }> {
  const bodyComponent: Record<string, unknown> = { type: "BODY", text: input.body };
  if (input.variables && input.variables.length > 0) {
    bodyComponent.example = { body_text: [input.variables] };
  }
  const components: Record<string, unknown>[] = [];
  const h = input.header;
  if (h?.format === "TEXT" && h.text?.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: h.text.trim() });
  } else if (h && ["IMAGE", "VIDEO", "DOCUMENT"].includes(h.format)) {
    if (!h.handle) throw new Error("Contoh media header wajib diunggah");
    components.push({ type: "HEADER", format: h.format, example: { header_handle: [h.handle] } });
  }
  components.push(bodyComponent);
  if (input.footer) components.push({ type: "FOOTER", text: input.footer });
  if (input.buttons && input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text, url: b.url }
          : b.type === "PHONE_NUMBER"
            ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone }
            : { type: "QUICK_REPLY", text: b.text },
      ),
    });
  }

  const res = await fetch(`${GRAPH}/${ch.wabaId}/message_templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ch.token}` },
    body: JSON.stringify({
      name: input.templateName,
      language: input.language,
      category: input.category,
      components,
    }),
    cache: "no-store",
  });
  if (!res.ok) await graphError(res);
  const j = (await res.json()) as { id?: string; status?: string };
  return { id: j.id ?? "", status: (j.status ?? "PENDING").toUpperCase() };
}

// Upload a sample media file to Meta (Resumable Upload API) → header_handle used when
// submitting an IMAGE/VIDEO/DOCUMENT header template for review.
export async function uploadTemplateSample(token: string, file: File): Promise<string> {
  const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
  if (!appId) throw new Error("META_APP_ID belum di-set");
  const start = new URL(`${GRAPH}/${appId}/uploads`);
  start.searchParams.set("file_name", file.name || "header");
  start.searchParams.set("file_length", String(file.size));
  start.searchParams.set("file_type", file.type);
  const s1 = await fetch(start, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!s1.ok) await graphError(s1);
  const { id } = (await s1.json()) as { id?: string };
  if (!id) throw new Error("Upload ke Meta gagal dimulai");
  const s2 = await fetch(`${GRAPH}/${id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
  });
  if (!s2.ok) await graphError(s2);
  const { h } = (await s2.json()) as { h?: string };
  if (!h) throw new Error("Meta tidak mengembalikan handle media");
  return h;
}
