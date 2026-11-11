// Flow trigger "Broadcast terjadwal" → broadcasts row (server only, not a server action).
//
// Saving an ACTIVE broadcast flow schedules one broadcast for it (snapshot of the
// first message, audience filter, send time). The engine worker starts it when the
// time comes (opt-in contacts only, built at send time) and parks every recipient's
// conversation on the "Pesan Broadcast" step so replies continue the flow.
// - Saving again before it starts updates the schedule/snapshot.
// - Once it started, saving never sends again.
// - Saving as draft / switching trigger cancels a broadcast that has not started.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { userError } from "./action-error";
import { db } from "./db";
import { broadcasts, channels, contacts } from "./db/schema";
import { assertBroadcastQuota, requireFeature } from "./entitlements";
import type { RuntimeNode } from "./flow-graph";
import type { Session } from "./session";
import { listWaTemplates } from "./wa-templates";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BroadcastSnapshot = {
  channelId: string;
  bodySnapshot: string;
  templateId: string | null;
  templateLang: string | null;
  templateParams: Record<string, unknown>;
  scheduledAt: string;
  audienceFilter: Record<string, unknown>;
  flowNodeId: string;
};

export type FlowBroadcastResult =
  | { state: "none" }
  | { state: "scheduled" | "updated"; scheduledAt: string }
  | { state: "sent" }
  | { state: "cancelled" };

// Grace for "send now" saves and clock skew.
const PAST_GRACE_MS = 60_000;

function broadcastTrigger(nodes: RuntimeNode[]) {
  const trigger = nodes.find((n) => n.type === "trigger");
  if (trigger?.trigger?.kind !== "broadcast") return null;
  return trigger;
}

// Validate the broadcast flow and build what the broadcasts row stores. Throws a
// readable error when something is missing. Null = not a broadcast flow.
export async function prepareFlowBroadcast(session: Session, nodes: RuntimeNode[]): Promise<BroadcastSnapshot | null> {
  const trigger = broadcastTrigger(nodes);
  if (!trigger || !session.tenantId) return null;
  await requireFeature(session, "broadcast", "Broadcast");

  const t = trigger.trigger as { channels?: string[]; tags?: string[]; schedule_at?: string | null };
  const channelId = t.channels?.[0];
  if (!channelId) throw userError("Pilih akun WhatsApp pengirim di Pemicu Broadcast");
  const msg = nodes.find((n) => n.id === trigger.next);
  if (!msg || msg.type !== "broadcast_message") throw userError("Langkah pertama broadcast harus Pesan Broadcast");

  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)),
    columns: { id: true, type: true, status: true },
  });
  if (!channel) throw userError("Akun WhatsApp pengirim tidak ditemukan");
  if (!["wa_official", "wa_unofficial"].includes(channel.type)) throw userError("Broadcast hanya untuk WhatsApp");
  if (channel.status !== "connected") throw userError("Akun WhatsApp pengirim belum terhubung");

  const at = t.schedule_at ? new Date(t.schedule_at) : new Date();
  if (Number.isNaN(at.getTime())) throw userError("Jadwal broadcast tidak valid");
  if (at.getTime() < Date.now() - PAST_GRACE_MS) throw userError("Jadwal broadcast sudah lewat. Pilih waktu yang akan datang.");

  const tags = (t.tags ?? []).map((x) => String(x).trim()).filter(Boolean);
  const base = {
    channelId,
    scheduledAt: (at.getTime() < Date.now() ? new Date() : at).toISOString(),
    audienceFilter: tags.length ? { tags } : {},
    flowNodeId: String(msg.id),
  };

  if (channel.type === "wa_unofficial") {
    const text = String(msg.text ?? "").trim();
    if (!text) throw userError("Isi Pesan Broadcast masih kosong");
    const media = String(msg.media_url ?? "").trim();
    if (media && !/^(https?:\/\/|\/uploads\/)/.test(media)) throw userError("URL gambar broadcast tidak valid");
    return { ...base, bodySnapshot: text, templateId: null, templateLang: null, templateParams: media ? { media_url: media } : {} };
  }

  // WA Official: template must be APPROVED on this WABA; snapshot how it is filled.
  const tplIn = (msg.template ?? {}) as { name?: string; lang?: string; header_url?: string; params?: { source?: string; value?: string; fallback?: string }[] };
  if (!tplIn.name) throw userError("Pilih template WhatsApp di Pesan Broadcast");
  const { templates: approved } = await listWaTemplates(session.tenantId, { status: "APPROVED", channelId });
  const tpl = approved.find((x) => x.name === tplIn.name && (!tplIn.lang || x.language === tplIn.lang));
  if (!tpl) throw userError(`Template ${tplIn.name} belum disetujui Meta atau bukan milik akun ini`);
  const params = Array.isArray(tplIn.params) ? tplIn.params : [];
  if (params.length !== tpl.variableCount) throw userError(`Template butuh ${tpl.variableCount} nilai variabel`);
  for (const [i, p] of params.entries()) {
    if (!["static", "contact_name", "contact_phone"].includes(String(p.source))) throw userError("Sumber variabel tidak valid");
    if (p.source === "static" && !String(p.value ?? "").trim()) throw userError(`Isi nilai variabel {{${i + 1}}}`);
  }
  const needsMedia = ["IMAGE", "VIDEO", "DOCUMENT"].includes(tpl.headerFormat);
  const headerUrl = String(tplIn.header_url ?? "").trim();
  if (needsMedia && !/^https:\/\//.test(headerUrl)) throw userError("Template ini butuh media header (URL https)");
  return {
    ...base,
    bodySnapshot: tpl.body,
    templateId: tpl.name,
    templateLang: tpl.language,
    templateParams: {
      header: needsMedia ? { format: tpl.headerFormat, link: headerUrl } : undefined,
      body: params.map((p) => ({ source: p.source, value: String(p.value ?? "").trim(), fallback: String(p.fallback ?? "").trim() || "Kak" })),
      buttons: tpl.buttons.flatMap((b, index) => (b.type === "QUICK_REPLY" ? [{ index, type: "QUICK_REPLY", text: b.text }] : [])),
    },
  };
}

// Opt-in contacts the broadcast will reach (same filter the engine applies).
async function audienceSize(tx: Tx, tenantId: string, filter: Record<string, unknown>): Promise<number> {
  const tags = Array.isArray(filter.tags) ? filter.tags.map(String) : [];
  const conds = [eq(contacts.tenantId, tenantId), eq(contacts.optInStatus, "opted_in")];
  if (tags.length) conds.push(sql`${contacts.tags} && ${tags}`);
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(contacts).where(and(...conds));
  return Number(row?.n ?? 0);
}

// Inside the flow-save transaction: create / update / cancel the flow's broadcast.
export async function applyFlowBroadcast(
  tx: Tx,
  session: Session,
  flowId: string,
  flowName: string,
  status: "draft" | "active",
  snapshot: BroadcastSnapshot | null,
): Promise<FlowBroadcastResult> {
  const tenantId = session.tenantId!;
  const rows = await tx
    .select({ id: broadcasts.id, status: broadcasts.status })
    .from(broadcasts)
    .where(and(eq(broadcasts.tenantId, tenantId), eq(broadcasts.flowId, flowId)))
    .orderBy(desc(broadcasts.createdAt));
  const pending = rows.find((b) => b.status === "scheduled" || b.status === "draft");
  const started = rows.some((b) => b.status === "running" || b.status === "done");

  if (!snapshot || status !== "active") {
    if (!pending) return { state: "none" };
    await tx
      .update(broadcasts)
      .set({ status: "cancelled", updatedAt: sql`now()` })
      .where(and(eq(broadcasts.id, pending.id), inArray(broadcasts.status, ["scheduled", "draft"])));
    return { state: "cancelled" };
  }

  const values = { ...snapshot, name: flowName.trim() || "Broadcast", status: "scheduled" as const, flowId };
  if (pending || !started) {
    await assertBroadcastQuota(session, await audienceSize(tx, tenantId, snapshot.audienceFilter));
  }
  if (pending) {
    // Guarded: the worker may have started it a moment ago — then it's sent, not updated.
    const updated = await tx
      .update(broadcasts)
      .set({ ...values, updatedAt: sql`now()` })
      .where(and(eq(broadcasts.id, pending.id), inArray(broadcasts.status, ["scheduled", "draft"])))
      .returning({ id: broadcasts.id });
    return updated.length ? { state: "updated", scheduledAt: snapshot.scheduledAt } : { state: "sent" };
  }
  if (started) return { state: "sent" };
  await tx.insert(broadcasts).values({ tenantId, ...values });
  return { state: "scheduled", scheduledAt: snapshot.scheduledAt };
}

export type FlowBroadcastInfo = {
  recipients: number;
  pending: { scheduledAt: string | null } | null;
  sent: { at: string; sent: number; total: number } | null;
};
