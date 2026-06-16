"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { broadcasts, channels, contacts } from "./db/schema";
import { requireAbility } from "./rbac";
import { getSession } from "./session";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

type ChannelType = "wa_official" | "wa_unofficial" | "instagram" | "facebook" | "telegram";

// --- Channel connect (web tulis tabel channels, 01). RBAC channel.connect (03). ---
export async function createChannel(input: {
  type: ChannelType;
  name: string;
  credentials: Record<string, string>;
  externalId?: string;
}) {
  const session = await getSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (!input.name.trim()) throw new Error("Nama channel wajib");

  // unofficial butuh scan QR (gateway) → pending; lainnya langsung connected kalau creds ada.
  const status = input.type === "wa_unofficial" ? "pending" : "connected";
  await db.insert(channels).values({
    tenantId: session.tenantId,
    type: input.type,
    name: input.name.trim(),
    status,
    credentials: input.credentials,
    externalId: input.externalId || null,
  });
  revalidatePath("/channels");
  redirect("/channels");
}

// --- Broadcast: estimasi audience (opt-in dipaksa). ---
export async function previewAudience(tags: string[]): Promise<number> {
  const session = await getSession();
  if (!session.tenantId) return 0;
  try {
    const conds = [
      eq(contacts.tenantId, session.tenantId),
      eq(contacts.optInStatus, "opted_in"),
    ];
    if (tags.length) conds.push(sql`${contacts.tags} && ${tags}`);
    const r = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(contacts)
      .where(and(...conds));
    return Number(r[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

// --- Broadcast: buat draft + jalankan (engine guard opt-in, throttle). ---
export async function createAndRunBroadcast(input: {
  name: string;
  channelId: string;
  body: string;
  tags: string[];
}) {
  const session = await getSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const [row] = await db
    .insert(broadcasts)
    .values({
      tenantId: session.tenantId,
      channelId: input.channelId,
      name: input.name.trim(),
      bodySnapshot: input.body,
      status: "draft",
      audienceFilter: input.tags.length ? { tags: input.tags } : {},
    })
    .returning({ id: broadcasts.id });

  const res = await fetch(`${ENGINE}/broadcasts/${row.id}/run`, {
    method: "POST",
    headers: {
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Gagal menjalankan broadcast${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}

export async function sendReply(conversationId: string, body: string) {
  const session = await getSession();
  const res = await fetch(`${ENGINE}/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    body: JSON.stringify({ body }),
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Gagal mengirim pesan${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath(`/inbox/${conversationId}`);
}
