import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { channels } from "./db/schema";
import { decryptCreds } from "./channel-crypto";
import { GRAPH, graphError } from "./whatsapp";

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
  channelId: string;
  channelName: string;
};

export type WaChannelCreds = { id: string; name: string; wabaId: string; token: string };

type GraphComponent = { type?: string; text?: string };
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
      const body = (t.components ?? []).find((c) => c.type === "BODY")?.text ?? "";
      out.push({
        id: t.id ?? "",
        name: t.name ?? "",
        language: t.language ?? "id",
        status: (t.status ?? "PENDING").toUpperCase(),
        category: t.category ?? "",
        body,
        variableCount: countVariables(body),
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
  const components: Record<string, unknown>[] = [bodyComponent];
  if (input.footer) components.push({ type: "FOOTER", text: input.footer });

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
