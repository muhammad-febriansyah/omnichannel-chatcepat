"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { broadcasts, channels, contacts, flows, tags, templates, tenants, users } from "./db/schema";
import { requireAbility, type Role } from "./rbac";
import { requireSession, type Session } from "./session";
import { getConversation } from "./queries";
import { COOKIE_MAX_AGE, SESSION_COOKIE, signSession } from "./auth";
import { normalizeBusinessHours, type BusinessHours } from "./business-hours";
import { normalizeWebSettings, type WebSettings } from "./web-settings";

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
  // Landing per-role: super_admin → konsol platform, agent → inbox, sisanya dashboard.
  redirect(user.role === "super_admin" ? "/admin" : user.role === "agent" ? "/inbox" : "/dashboard");
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
  const [row] = await db
    .insert(channels)
    .values({
      tenantId: session.tenantId,
      type: input.type,
      name: input.name.trim(),
      status,
      credentials: input.credentials,
      externalId: input.externalId || null,
    })
    .returning({ id: channels.id });
  revalidatePath("/channels");
  // wa_unofficial → lanjut ke halaman pairing QR; lainnya langsung selesai.
  redirect(input.type === "wa_unofficial" ? `/channels/${row.id}/pair` : "/channels");
}

// --- WA unofficial: simpan device JID hasil pairing (dipanggil dari halaman QR). ---
export async function attachWaDevice(channelId: string, jid: string) {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (!jid.trim()) throw new Error("JID device kosong");

  const [ch] = await db
    .select({ credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  if (!ch) throw new Error("Channel tidak ditemukan");

  const creds = { ...(ch.credentials as Record<string, unknown>), device_jid: jid };
  await db
    .update(channels)
    .set({ status: "connected", externalId: jid, credentials: creds, updatedAt: sql`now()` })
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  revalidatePath("/channels");
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

  // Channel WAJIB milik tenant ini — cegah broadcast lewat channel tenant lain.
  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, input.channelId), eq(channels.tenantId, session.tenantId)),
    columns: { id: true },
  });
  if (!channel) throw new Error("Channel tidak ditemukan");

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
      "X-Tenant-Id": session.tenantId,
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
  await assertConvOwned(session, conversationId);
  const res = await fetch(`${ENGINE}/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
      "X-Tenant-Id": session.tenantId ?? "",
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

// --- Contacts CRUD (web tulis tabel contacts, 07). RBAC contact.manage. ---
type OptInStatusInput = "opted_in" | "opted_out" | "unknown";
export interface ContactInput {
  name: string;
  phone: string;
  optInStatus: OptInStatusInput;
  tags: string[];
}

function normTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
}

export async function createContact(input: ContactInput) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name && !phone) throw new Error("Nama atau nomor telepon wajib diisi");
  const optedIn = input.optInStatus === "opted_in";
  try {
    await db.insert(contacts).values({
      tenantId: session.tenantId,
      name: name || null,
      phone: phone || null,
      optInStatus: input.optInStatus,
      optInSource: optedIn ? "form" : null,
      optInAt: optedIn ? new Date().toISOString() : null,
      tags: normTags(input.tags),
    });
  } catch {
    throw new Error("Nomor telepon sudah terdaftar untuk tenant ini");
  }
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function updateContact(id: string, input: ContactInput) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name && !phone) throw new Error("Nama atau nomor telepon wajib diisi");
  try {
    await db
      .update(contacts)
      .set({
        name: name || null,
        phone: phone || null,
        optInStatus: input.optInStatus,
        tags: normTags(input.tags),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, session.tenantId)));
  } catch {
    throw new Error("Nomor telepon sudah terdaftar untuk tenant ini");
  }
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function deleteContact(id: string) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, session.tenantId)));
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function importContacts(
  rows: { name: string; phone: string }[],
): Promise<{ inserted: number; skipped: number }> {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const clean = rows
    .map((r) => ({ name: (r.name ?? "").trim(), phone: (r.phone ?? "").trim() }))
    .filter((r) => r.name || r.phone);
  if (!clean.length) throw new Error("Tidak ada baris valid untuk diimport");
  if (clean.length > 5000) throw new Error("Maksimal 5.000 baris per import");

  // Import → opt-in TIDAK otomatis (consent wajib eksplisit). Status unknown, sumber import.
  const seen = new Set<string>();
  const values = clean
    .filter((r) => {
      if (!r.phone) return true;
      if (seen.has(r.phone)) return false;
      seen.add(r.phone);
      return true;
    })
    .map((r) => ({
      tenantId: session.tenantId!,
      name: r.name || null,
      phone: r.phone || null,
      optInStatus: "unknown" as const,
      optInSource: "import" as const,
      tags: [] as string[],
    }));

  const ins = await db.insert(contacts).values(values).onConflictDoNothing().returning({ id: contacts.id });
  revalidatePath("/contacts");
  return { inserted: ins.length, skipped: clean.length - ins.length };
}

// --- Tim / Users (kelola user & role, 03). RBAC user.manage. ---
type TenantRole = "admin" | "supervisor" | "agent";
type UserStatusInput = "active" | "invited" | "disabled";
const ASSIGNABLE_ROLES: TenantRole[] = ["admin", "supervisor", "agent"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(input: {
  name: string;
  email: string;
  role: TenantRole;
  password: string;
}) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Nama wajib diisi");
  if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
  if (!input.password || input.password.length < 6) throw new Error("Password minimal 6 karakter");
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error("Role tidak valid");
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    await db.insert(users).values({
      tenantId: session.tenantId,
      name,
      email,
      passwordHash,
      role: input.role,
      status: "active",
    });
  } catch {
    throw new Error("Email sudah terdaftar");
  }
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUser(
  id: string,
  input: { name: string; role: TenantRole; status: UserStatusInput; password?: string },
) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi");
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error("Role tidak valid");
  if (id === session.id && input.status !== "active") {
    throw new Error("Tidak bisa menonaktifkan akun sendiri");
  }
  const patch: Record<string, unknown> = {
    name,
    role: input.role,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  if (input.password) {
    if (input.password.length < 6) throw new Error("Password minimal 6 karakter");
    patch.passwordHash = await bcrypt.hash(input.password, 10);
  }
  await db.update(users).set(patch).where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)));
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function deleteUser(id: string) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (id === session.id) throw new Error("Tidak bisa menghapus akun sendiri");
  await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)));
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

// --- Platform: aktifkan / suspend tenant (super_admin, tenant.manage). ---
export async function setTenantStatus(id: string, status: "active" | "suspended") {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  await db
    .update(tenants)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tenants.id, id));
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${id}`);
}

// --- Pengaturan: jam kerja & out-of-office (05). RBAC flow.manage (config admin). ---
export async function saveBusinessHours(input: BusinessHours) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const business_hours = normalizeBusinessHours(input);
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
  const settings = { ...((t?.settings as Record<string, unknown>) ?? {}), business_hours };
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, session.tenantId));
  revalidatePath("/settings/business-hours");
}

// --- Inbox: aksi state percakapan (lewat engine; conversations engine-owned, 01). ---
// Pastikan percakapan milik tenant sesi sebelum panggil engine (engine internal API
// percaya BFF; tenant scope WAJIB di-enforce di sini agar tak bocor lintas tenant).
async function assertConvOwned(session: Session, conversationId: string): Promise<void> {
  const conv = await getConversation(session, conversationId);
  if (!conv) throw new Error("Percakapan tidak ditemukan");
}

async function convAction(
  conversationId: string,
  action: string,
  session: Session,
  body?: unknown,
): Promise<void> {
  await assertConvOwned(session, conversationId);
  const res = await fetch(`${ENGINE}/conversations/${conversationId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
      "X-Tenant-Id": session.tenantId ?? "",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Aksi gagal${msg ? `: ${msg}` : ""}`);
  }
}

export async function resolveConversation(conversationId: string) {
  const session = await requireSession();
  await convAction(conversationId, "resolve", session);
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

export async function reopenConversation(conversationId: string) {
  const session = await requireSession();
  await convAction(conversationId, "reopen", session);
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

export async function returnToBot(conversationId: string) {
  const session = await requireSession();
  await convAction(conversationId, "return-to-bot", session);
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

export async function takeoverConversation(conversationId: string) {
  const session = await requireSession();
  // takeover = assign ke diri sendiri (handler=agent).
  await convAction(conversationId, "assign", session, { agent_id: session.id });
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

export async function assignConversation(conversationId: string, agentId: string) {
  const session = await requireSession();
  requireAbility(session, "conversation.assign");
  await convAction(conversationId, "assign", session, { agent_id: agentId });
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

// --- Akuisisi kontak: opt-in form publik (07). Consent eksplisit → opted_in, sumber form. ---
export async function createOptIn(
  slug: string,
  input: { name: string; phone: string },
): Promise<void> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!phone) throw new Error("Nomor telepon wajib diisi");
  if (!/^[0-9+\-\s]{6,32}$/.test(phone)) throw new Error("Nomor telepon tidak valid");

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
  if (!tenant || tenant.status !== "active") throw new Error("Workspace tidak ditemukan");

  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.tenantId, tenant.id), eq(contacts.phone, phone)),
  });
  const now = new Date().toISOString();
  if (existing) {
    // Kontak sudah ada → catat consent (opted_in).
    await db
      .update(contacts)
      .set({ optInStatus: "opted_in", optInSource: "form", optInAt: now, updatedAt: now, name: existing.name ?? (name || null) })
      .where(eq(contacts.id, existing.id));
    return;
  }
  await db.insert(contacts).values({
    tenantId: tenant.id,
    name: name || null,
    phone,
    optInStatus: "opted_in",
    optInSource: "form",
    optInAt: now,
    tags: [],
  });
}

// --- Pengaturan website/brand (logo, SEO, sosmed). RBAC billing.tenant (admin). ---
export async function saveWebSettings(input: WebSettings) {
  const session = await requireSession();
  requireAbility(session, "billing.tenant");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const web_settings = normalizeWebSettings(input);
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
  const settings = { ...((t?.settings as Record<string, unknown>) ?? {}), web_settings };
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, session.tenantId));
  revalidatePath("/settings/web");
}

// --- Tag & Label (segmentasi kontak, web-owned). RBAC contact.manage. ---
export async function createTag(input: { name: string; color: string }) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw new Error("Nama tag wajib diisi");
  await db.insert(tags).values({ tenantId: session.tenantId, name, color: input.color || null });
  revalidatePath("/tags");
  redirect("/tags");
}

export async function updateTag(id: string, input: { name: string; color: string }) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw new Error("Nama tag wajib diisi");
  await db
    .update(tags)
    .set({ name, color: input.color || null, updatedAt: new Date().toISOString() })
    .where(and(eq(tags.id, id), eq(tags.tenantId, session.tenantId)));
  revalidatePath("/tags");
  redirect("/tags");
}

export async function deleteTag(id: string) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.tenantId, session.tenantId)));
  revalidatePath("/tags");
  redirect("/tags");
}

// --- Template Pesan (08): WA HSM + balasan cepat ---
type TemplateInput = {
  name: string;
  kind: "hsm" | "quick_reply";
  category?: string;
  language?: string;
  body: string;
};

function normalizeTemplate(input: TemplateInput) {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name) throw new Error("Nama template wajib diisi");
  if (!body) throw new Error("Isi template wajib diisi");
  const isHsm = input.kind === "hsm";
  return {
    name,
    body,
    kind: input.kind,
    // HSM perlu approval Meta → draft; balasan cepat langsung aktif.
    status: (isHsm ? "draft" : "approved") as "draft" | "approved",
    category: isHsm ? input.category?.trim() || null : null,
    language: isHsm ? input.language?.trim() || null : null,
  };
}

export async function createTemplate(input: TemplateInput) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const v = normalizeTemplate(input);
  await db.insert(templates).values({ tenantId: session.tenantId, ...v });
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const v = normalizeTemplate(input);
  await db
    .update(templates)
    .set({ ...v, updatedAt: new Date().toISOString() })
    .where(and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)));
  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(id: string) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)));
  revalidatePath("/templates");
  redirect("/templates");
}
