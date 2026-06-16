"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { broadcasts, channels, contacts, flows, tenants, users } from "./db/schema";
import { requireAbility, type Role } from "./rbac";
import { requireSession } from "./session";
import { COOKIE_MAX_AGE, SESSION_COOKIE, signSession } from "./auth";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

// --- Auth ---
export async function login(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });
  if (!user || !user.passwordHash || user.status !== "active") {
    throw new Error("Email atau password salah");
  }
  const okPw = await bcrypt.compare(password, user.passwordHash);
  if (!okPw) throw new Error("Email atau password salah");

  const token = await signSession({
    sub: user.id,
    role: user.role as Role,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  redirect("/dashboard");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

type ChannelType = "wa_official" | "wa_unofficial" | "instagram" | "facebook" | "telegram";

// --- Channel connect (web tulis tabel channels, 01). RBAC channel.connect (03). ---
export async function createChannel(input: {
  type: ChannelType;
  name: string;
  credentials: Record<string, string>;
  externalId?: string;
}) {
  const session = await requireSession();
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
  const session = await requireSession();
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
  const session = await requireSession();
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
  const session = await requireSession();
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

// --- AI Agent (06) ---
export async function savePersona(persona: string) {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
  const settings = { ...((t?.settings as Record<string, unknown>) ?? {}), ai_persona: persona };
  await db.update(tenants).set({ settings }).where(eq(tenants.id, session.tenantId));
  revalidatePath("/ai-agent");
}

export async function addKnowledge(title: string, text: string) {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const res = await fetch(`${ENGINE}/knowledge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    body: JSON.stringify({ tenant_id: session.tenantId, title, text }),
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Gagal memproses dokumen${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath("/ai-agent");
}

export async function previewAi(
  message: string,
  persona: string,
): Promise<{ enabled: boolean; answer: string | null; kb_used?: boolean }> {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) return { enabled: false, answer: null };
  const res = await fetch(`${ENGINE}/ai-agent/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    body: JSON.stringify({ tenant_id: session.tenantId, message, persona }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal menjalankan preview");
  const j = await res.json();
  return j.data;
}

// --- Flows (06) ---
export async function createFlow() {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const [row] = await db
    .insert(flows)
    .values({
      tenantId: session.tenantId,
      name: "Flow Baru",
      status: "draft",
      trigger: "keyword",
      definition: {
        nodes: [
          { id: "start", type: "trigger", trigger: { kind: "keyword", match: ["menu"] }, next: "greet" },
          { id: "greet", type: "send_text", text: "Halo 👋 ada yang bisa dibantu?", next: "handoff" },
          { id: "handoff", type: "handoff", to: "agent" },
        ],
      },
    })
    .returning({ id: flows.id });
  redirect(`/flows/${row.id}`);
}

export async function saveFlow(
  id: string,
  input: {
    name: string;
    status: "draft" | "active";
    trigger: "keyword" | "welcome" | "fallback";
    definition: unknown;
  },
) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db
    .update(flows)
    .set({
      name: input.name,
      status: input.status,
      trigger: input.trigger,
      definition: input.definition as object,
    })
    .where(and(eq(flows.id, id), eq(flows.tenantId, session.tenantId)));
  revalidatePath(`/flows/${id}`);
  revalidatePath("/flows");
}
