"use server";

import { errorMessage, userError } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { broadcasts, channels, contacts, flows, passwordResetTokens, products, tags, templates, tenants, users } from "./db/schema";
import { requireAbility, type Role } from "./rbac";
import {
  assertCanAddAgent,
  assertCanAddChannel,
  assertCanAddKb,
  assertFlowNodesAllowed,
  hasFeature,
  requireFeature,
} from "./entitlements";
import { requireSession, type Session } from "./session";
import { findTemplate } from "./flow-templates";
import { CHAT_MIME } from "./chat-attachments";
import { normalizePhone } from "./phone";
import { registerTelegramWebhook, deleteTelegramWebhook, getTelegramBot } from "./telegram";
import { encryptCreds, decryptCreds } from "./channel-crypto";
import { createWaTemplateOnMeta, listWaChannelCreds, uploadTemplateSample, type CreateWaTemplateInput } from "./wa-templates";
import { getConversation } from "./queries";
import { compileGraph, starterGraph, validateRuntimeNodes, type RuntimeNode } from "./flow-graph";
import { applyFlowBroadcast, prepareFlowBroadcast, type FlowBroadcastInfo, type FlowBroadcastResult } from "./flow-broadcast";
import { conflictMessage, findFlowConflicts, triggerInfo, type FlowTriggerInfo } from "./flow-conflicts";
import { ACTING_TENANT_COOKIE, COOKIE_MAX_AGE, IMPERSONATE_COOKIE, SESSION_COOKIE, signSession, authCookieOptions, authCookieDelete } from "./auth";
import { normalizeBusinessHours, type BusinessHours } from "./business-hours";
import { normalizeWebSettings, type WebSettings } from "./web-settings";
import { deleteUpload, saveImage } from "./uploads";
import { writeAudit } from "./audit";
import {
  FB_OAUTH_COOKIE,
  getInstagramAccount,
  getPageInfo,
  listPages,
  subscribePageToApp,
  unsubscribePageFromApp,
  verifyOAuthSession,
} from "./facebook";
import {
  ensureWaPhoneRegistered,
  exchangeWaCode,
  subscribeWabaToApp,
} from "./whatsapp";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

async function queueWelcomeEmail(input: {
  tenantId: string | null;
  userId: string;
  recipient: string;
  name: string;
  business: string;
}) {
  if (!input.tenantId) return;
  try {
    const response = await fetch(`${ENGINE}/notifications/welcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({
        tenant_id: input.tenantId,
        user_id: input.userId,
        recipient: input.recipient,
        name: input.name,
        business: input.business,
      }),
      cache: "no-store",
    });
    if (!response.ok) console.error("welcome email queue failed", response.status);
  } catch {
    // Registration should succeed even if notifications are temporarily unavailable.
    console.error("welcome email queue unavailable");
  }
}

// --- Auth ---
// Catatan: Next.js menyensor pesan Error yang di-throw dari Server Action di
// production (digest only). Kembalikan { error } agar pesan sampai ke form.
export async function login(email: string, password: string): Promise<{ error: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });
  if (!user || !user.passwordHash || user.status !== "active") {
    return { error: "Email atau password salah" };
  }
  const okPw = await bcrypt.compare(password, user.passwordHash);
  if (!okPw) return { error: "Email atau password salah" };

  const token = await signSession({
    sub: user.id,
    role: user.role as Role,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, authCookieOptions(COOKIE_MAX_AGE));
  // Landing per-role: admin platform → konsol platform, client → dashboard tenant.
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function requestPasswordReset(email: string): Promise<{ ok: true; resetToken?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) return { ok: true };

  const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (!user || user.status !== "active") return { ok: true };

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

  // Development may expose a local test link; production always delivers by email.
  if (process.env.NODE_ENV !== "production" && process.env.APP_ENV !== "production") return { ok: true, resetToken: rawToken };
  try {
    const response = await fetch(`${ENGINE}/notifications/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Token": process.env.SERVICE_TOKEN ?? "" },
      body: JSON.stringify({ user_id: user.id, token: rawToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw userError("email unavailable");
  } catch {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    throw userError("Layanan email reset belum tersedia. Coba lagi nanti.");
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  if (!token || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
    throw userError("Link reset password tidak valid atau sudah kedaluwarsa");
  }
  if (!password || password.length < 6) throw userError("Password minimal 6 karakter");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date().toISOString();
  const [validToken] = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
    .limit(1);

  if (!validToken) throw userError("Link reset password tidak valid atau sudah kedaluwarsa");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.id, validToken.id), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .returning({ id: passwordResetTokens.id });
    if (!claimed) throw userError("Link reset password sudah dipakai atau kedaluwarsa");
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, validToken.userId));
    await tx.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, validToken.userId), isNull(passwordResetTokens.usedAt)));
  });

  return { ok: true };
}

const TRIAL_DAYS = 14;

// Self-signup: bikin tenant baru + user owner (role client), lalu login otomatis.
export async function register(input: { business: string; name: string; email: string; password: string }) {
  const business = input.business.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!business) throw userError("Nama bisnis wajib diisi");
  if (!name) throw userError("Nama wajib diisi");
  if (!EMAIL_RE.test(email)) throw userError("Email tidak valid");
  if (!input.password || input.password.length < 6) throw userError("Password minimal 6 karakter");

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw userError("Email sudah terdaftar");

  // Slug unik dari nama bisnis (fallback "tenant"), tambah sufiks -2, -3, ... bila bentrok.
  const base = business.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "tenant";
  let slug = base;
  for (let i = 2; ; i++) {
    const taken = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  let user: typeof users.$inferSelect;
  try {
    user = await db.transaction(async (tx) => {
      // New signups: 14-day Pro trial, then the session drops them to Basic until they pay.
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: business,
          slug,
          plan: "pro",
          planExpiresAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
          settings: { trial: true },
        })
        .returning();
      const [u] = await tx
        .insert(users)
        .values({ tenantId: tenant.id, name, email, passwordHash, role: "client", status: "active" })
        .returning();
      return u;
    });
  } catch (e) {
    console.error("register failed", e);
    throw userError("Gagal mendaftar. Coba lagi beberapa saat lagi.");
  }

  await queueWelcomeEmail({
    tenantId: user.tenantId,
    userId: user.id,
    recipient: user.email,
    name: user.name,
    business,
  });

  const token = await signSession({
    sub: user.id,
    role: user.role as Role,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, authCookieOptions(COOKIE_MAX_AGE));
  redirect("/dashboard");
}

export async function logout() {
  const store = await cookies();
  store.delete(authCookieDelete(SESSION_COOKIE));
  store.delete(authCookieDelete(ACTING_TENANT_COOKIE));
  redirect("/login");
}

// --- Admin platform god-mode: tenant switcher ---
// Daftar tenant untuk dropdown switcher (admin platform only).
export async function listTenants(): Promise<{ id: string; name: string; slug: string }[]> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) return [];
  try {
    return await db.query.tenants.findMany({
      columns: { id: true, name: true, slug: true },
      orderBy: (t, { asc }) => asc(t.name),
    });
  } catch {
    return []; // DB tak tersedia → switcher kosong, app tetap jalan.
  }
}

// Set tenant aktif yang dilihat admin platform (impersonasi). Hanya admin.
export async function setActingTenant(tenantId: string) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya admin platform");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!t) throw userError("Tenant tidak ditemukan");
  const store = await cookies();
  store.set(ACTING_TENANT_COOKIE, tenantId, authCookieOptions(COOKIE_MAX_AGE));
  revalidatePath("/", "layout");
}

// Mulai impersonasi: admin platform "masuk sebagai tenant" → operasikan menu omnichannel.
// Set acting tenant + flag impersonasi, lalu arahkan ke dashboard tenant.
export async function startImpersonation(tenantId: string) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya admin platform");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!t) throw userError("Tenant tidak ditemukan");
  const store = await cookies();
  const opts = authCookieOptions(COOKIE_MAX_AGE);
  store.set(ACTING_TENANT_COOKIE, tenantId, opts);
  store.set(IMPERSONATE_COOKIE, tenantId, opts);
  await writeAudit(session, {
    action: "impersonate.start",
    targetType: "tenant",
    targetId: tenantId,
    targetLabel: t.name,
    tenantId,
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Keluar impersonasi: hapus flag, kembali ke konsol platform.
export async function stopImpersonation() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya admin platform");
  const store = await cookies();
  store.delete(authCookieDelete(IMPERSONATE_COOKIE));
  revalidatePath("/", "layout");
  redirect("/admin");
}

// Tulis ulang cookie sesi (JWT) supaya name/avatar terbaru kebawa ke topbar tanpa re-login.
async function reissueSession(
  session: Session,
  patch: { name?: string; avatarUrl?: string | null },
) {
  const token = await signSession({
    sub: session.id,
    role: session.role as Role,
    tenantId: session.tenantId,
    name: patch.name ?? session.name,
    email: session.email,
    avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : session.avatarUrl,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, authCookieOptions(COOKIE_MAX_AGE));
}

// --- Profil sendiri (self-service; semua role yang login). ---
// avatarUrl: undefined = tidak diubah, null/"" = hapus foto, string = ganti foto.
// Foto lama dihapus dari disk saat diganti/dihapus.
export async function updateProfile(input: {
  name: string;
  avatarUrl?: string | null;
  password?: string;
}) {
  const session = await requireSession();
  const name = input.name.trim();
  if (!name) throw userError("Nama wajib diisi");
  if (name.length > 120) throw userError("Nama maksimal 120 karakter");

  const current = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!current) throw userError("User tidak ditemukan");

  const patch: Record<string, unknown> = { name, updatedAt: new Date().toISOString() };

  const newAvatar = input.avatarUrl === undefined ? undefined : input.avatarUrl || null;
  const avatarChanged = newAvatar !== undefined && newAvatar !== current.avatarUrl;
  if (avatarChanged) patch.avatarUrl = newAvatar;

  if (input.password) {
    if (input.password.length < 6) throw userError("Password minimal 6 karakter");
    patch.passwordHash = await bcrypt.hash(input.password, 10);
  }

  await db.update(users).set(patch).where(eq(users.id, session.id));

  // Hapus file foto lama (hanya aset lokal /uploads) setelah DB sukses.
  if (avatarChanged && current.avatarUrl) await deleteUpload(current.avatarUrl);

  await reissueSession(session, {
    name,
    avatarUrl: avatarChanged ? newAvatar : current.avatarUrl,
  });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
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
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!input.name.trim()) throw userError("Nama channel wajib");
  await assertCanAddChannel(session, input.type); // lock: batas channel per paket & per jenis (admin bypass)

  // WA Official (input manual): validasi token ke Graph, pastikan nomor ter-register,
  // subscribe app ke WABA (tanpa ini webhook tak pernah datang), dan pakai
  // phone_number_id sebagai external_id (kunci resolver webhook di gateway).
  if (input.type === "wa_official") {
    const phoneNumberId = input.credentials.phone_number_id?.trim() ?? "";
    const wabaId = input.credentials.waba_id?.trim() ?? "";
    const token = input.credentials.access_token?.trim() ?? "";
    if (!phoneNumberId || !wabaId || !token) {
      throw userError("Phone Number ID, WABA ID, dan Access Token wajib diisi");
    }
    await prepareWaOfficial({ phoneNumberId, wabaId, token, pin: input.credentials.pin?.trim() });
    input.credentials = { phone_number_id: phoneNumberId, waba_id: wabaId, access_token: token };
    input.externalId = phoneNumberId;
  }

  // Facebook / Instagram (input manual): same result as "Login dengan Facebook" —
  // token checked against the Page, webhook subscribed, and external_id set to what
  // Meta sends as entry.id (Page ID for FB, Instagram account ID for IG). Without it
  // the gateway can't match incoming messages to this channel.
  if (input.type === "facebook" || input.type === "instagram") {
    const pageId = input.credentials.page_id?.trim() ?? "";
    const token = input.credentials.access_token?.trim() ?? "";
    if (!pageId || !token) throw userError("Page ID dan Page Access Token wajib diisi");
    const page = await getPageInfo(pageId, token);
    let externalId = page.id;
    if (input.type === "instagram") {
      const igId = await getInstagramAccount(page.id, token);
      if (!igId) throw userError(`Page "${page.name}" belum tertaut akun Instagram Professional. Tautkan dulu di Meta Business.`);
      externalId = igId;
    }
    await assertChannelNotLinked(input.type, externalId);
    await subscribePageToApp(page.id, token);
    input.credentials = { page_id: page.id, access_token: token };
    input.externalId = externalId;
  }

  // Telegram: verify the bot token first, and refuse a bot that is already connected
  // (Telegram keeps one webhook per bot — a second channel would silently steal it).
  if (input.type === "telegram") {
    const token = input.credentials.bot_token?.trim() ?? "";
    const bot = await getTelegramBot(token);
    await assertChannelNotLinked("telegram", bot.id);
    input.credentials = { bot_token: token };
    input.externalId = bot.id;
  }

  // unofficial butuh scan QR (gateway) → pending; lainnya langsung connected kalau creds ada.
  const status = input.type === "wa_unofficial" ? "pending" : "connected";
  const [row] = await db
    .insert(channels)
    .values({
      tenantId: session.tenantId,
      type: input.type,
      name: input.name.trim(),
      status,
      credentials: encryptCreds(input.credentials), // AES-256-GCM at-rest
      externalId: input.externalId || null,
      // Balas otomatis: unofficial default OFF (nomor pribadi rawan banned bila
      // auto-reply) — harus di-ON-kan sadar risiko. Channel resmi default ON.
      autoReplyEnabled: input.type !== "wa_unofficial",
      autoReplyMode: "hybrid",
      defaultFlowId: null,
    })
    .returning({ id: channels.id });

  // Telegram: daftarkan webhook ke Bot API supaya pesan masuk diterima gateway.
  // Butuh TELEGRAM_WEBHOOK_BASE (URL publik gateway).
  if (input.type === "telegram") {
    const base = process.env.TELEGRAM_WEBHOOK_BASE;
    if (!base) {
      // Tanpa webhook, Telegram tak tahu ke mana kirim update → inbound tak pernah
      // datang. Jangan tandai "connected" palsu; set pending.
      await db
        .update(channels)
        .set({ status: "pending" })
        .where(and(eq(channels.id, row.id), eq(channels.tenantId, session.tenantId)));
      revalidatePath("/channels");
      throw userError(
        "Channel dibuat (pending), tapi webhook Telegram belum didaftarkan: TELEGRAM_WEBHOOK_BASE belum diset.",
      );
    }
    try {
      const { secret } = await registerTelegramWebhook(input.credentials.bot_token, base, row.id);
      await db
        .update(channels)
        .set({ credentials: encryptCreds({ ...input.credentials, tg_secret: secret }) })
        .where(and(eq(channels.id, row.id), eq(channels.tenantId, session.tenantId)));
    } catch (e) {
      await db
        .update(channels)
        .set({ status: "pending" })
        .where(and(eq(channels.id, row.id), eq(channels.tenantId, session.tenantId)));
      const msg = errorMessage(e) ?? "tidak diketahui";
      throw userError(
        `Channel dibuat, tapi webhook Telegram gagal didaftarkan: ${msg}. Cek TELEGRAM_WEBHOOK_BASE & bot token.`,
      );
    }
  }

  revalidatePath("/channels");
  // wa_unofficial → lanjut ke halaman pairing QR; lainnya langsung selesai.
  redirect(input.type === "wa_unofficial" ? `/channels/${row.id}/pair` : "/channels");
}

// One account = one channel, platform-wide (the webhook resolver matches on external_id).
async function assertChannelNotLinked(type: ChannelType, externalId: string): Promise<void> {
  const dup = await db.query.channels.findFirst({
    where: and(eq(channels.type, type), eq(channels.externalId, externalId)),
    columns: { id: true },
  });
  if (dup) throw userError("Akun ini sudah terhubung sebagai channel. Putuskan dulu channel lama bila ingin menghubungkan ulang.");
}

// Validasi + siapkan nomor WA Official sebelum disimpan sebagai channel:
//  1. phone_number_id belum dipakai channel lain (resolver webhook butuh external_id unik).
//  2. token valid + nomor ter-register Cloud API (register pakai PIN bila belum).
//  3. app ter-subscribe ke WABA supaya webhook pesan masuk aktif.
async function prepareWaOfficial(input: {
  phoneNumberId: string;
  wabaId: string;
  token: string;
  pin?: string;
}): Promise<{ name: string }> {
  const dup = await db.query.channels.findFirst({
    where: and(eq(channels.type, "wa_official"), eq(channels.externalId, input.phoneNumberId)),
    columns: { id: true },
  });
  if (dup) throw userError("Nomor WhatsApp ini sudah terhubung sebagai channel");

  const info = await ensureWaPhoneRegistered(input.phoneNumberId, input.token, input.pin);
  await subscribeWabaToApp(input.wabaId, input.token);
  return { name: info.verifiedName || info.displayPhoneNumber || "WhatsApp" };
}

// --- Toggle balas otomatis (flow + AI) per-channel. Engine baca kolom ini di
// pipeline inbound (OFF → skip decide). Web pemilik tabel channels. ---
export async function setChannelAutoReply(channelId: string, enabled: boolean) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await db
    .update(channels)
    .set({ autoReplyEnabled: enabled, updatedAt: sql`now()` })
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  revalidatePath("/channels");
  revalidatePath("/flows");
}

export type FallbackAction = "ai" | "message" | "silent";

// Automation → Pengaturan balasan: what happens when no flow matches, for every account
// in the workspace. The assistant is the workspace default (menu Asisten AI), so any
// per-channel pick is cleared.
export async function setReplyFallback(input: { action: FallbackAction; message: string | null }) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!["ai", "message", "silent"].includes(input.action)) throw userError("Pilihan balasan tidak valid");
  await db
    .update(channels)
    .set({
      fallbackAction: input.action,
      fallbackMessage: (input.message ?? "").trim().slice(0, 500) || null,
      aiAgentId: null,
      defaultFlowId: null,
      updatedAt: sql`now()`,
    })
    .where(eq(channels.tenantId, session.tenantId));
  revalidatePath("/flows");
}

// --- Ubah nama channel (halaman /channels/[id]/edit). ---
export async function renameChannel(id: string, name: string): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const clean = name.trim();
  if (!clean) throw userError("Nama channel wajib diisi");
  if (clean.length > 80) throw userError("Nama channel maksimal 80 karakter");
  const hit = await db
    .update(channels)
    .set({ name: clean, updatedAt: sql`now()` })
    .where(and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)))
    .returning({ id: channels.id });
  if (!hit.length) throw userError("Channel tidak ditemukan");
  revalidatePath("/channels");
}

// --- Facebook/Instagram OAuth: finalisasi pilih Page → subscribe webhook + simpan channel. ---
// Dipanggil dari halaman pilih Page setelah callback OAuth. User token long-lived dibaca
// dari cookie httpOnly (FB_OAUTH_COOKIE), bukan input user → tak bisa dipalsu.
export async function connectMetaPage(pageId: string): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");

  const store = await cookies();
  const sealed = store.get(FB_OAUTH_COOKIE)?.value;
  const oauth = sealed ? await verifyOAuthSession(sealed) : null;
  if (!oauth || oauth.tenantId !== session.tenantId) {
    throw userError("Sesi OAuth kedaluwarsa, ulangi Login dengan Facebook");
  }

  // Ambil ulang daftar Page pakai user token → temukan Page Access Token utk pageId.
  const pages = await listPages(oauth.userToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw userError("Page tidak ditemukan atau akses dicabut");


  // Resolver gateway match inbound pakai entry.id webhook:
  //   facebook  → entry.id = Page ID
  //   instagram → entry.id = Instagram Business Account ID (BUKAN Page ID)
  // Jadi utk IG, external_id harus IG account id yg ter-link ke Page.
  let externalId = page.id;
  if (oauth.platform === "instagram") {
    const igId = await getInstagramAccount(page.id, page.access_token);
    if (!igId) {
      throw userError(
        `Page "${page.name}" belum tertaut akun Instagram Professional. Tautkan IG ke Page dulu di Meta Business.`,
      );
    }
    externalId = igId;
  }
  // Already a channel in this workspace → "Hubungkan ulang": refresh token + status,
  // keep the channel (name, history, settings). Otherwise a new channel.
  const own = await db.query.channels.findFirst({
    where: and(eq(channels.tenantId, session.tenantId), eq(channels.type, oauth.platform), eq(channels.externalId, externalId)),
    columns: { id: true },
  });
  if (!own) {
    await assertCanAddChannel(session, oauth.platform); // lock: maks akun FB/IG per paket
    await assertChannelNotLinked(oauth.platform, externalId);
  }

  // Subscribe app ke webhook Page — wajib supaya pesan masuk diteruskan ke gateway.
  await subscribePageToApp(page.id, page.access_token);

  // Page Access Token dipakai kirim balasan (FB & IG messaging via page token).
  const credentials = encryptCreds({ access_token: page.access_token, page_id: page.id });
  if (own) {
    await db
      .update(channels)
      .set({ status: "connected", credentials, updatedAt: sql`now()` })
      .where(and(eq(channels.id, own.id), eq(channels.tenantId, session.tenantId)));
  } else {
    await db.insert(channels).values({
      tenantId: session.tenantId,
      type: oauth.platform,
      name: page.name,
      status: "connected",
      credentials,
      externalId,
    });
  }

  store.delete(authCookieDelete(FB_OAUTH_COOKIE));
  revalidatePath("/channels");
  redirect("/channels?connected=1");
}

// --- WhatsApp Cloud Embedded Signup: finalisasi (tukar code → subscribe → register → simpan). ---
// Dipanggil dari client setelah FB JS SDK selesai. code, wabaId, phoneNumberId dari SDK.
export async function connectWhatsAppEmbedded(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  pin?: string;
}): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!input.code || !input.wabaId || !input.phoneNumberId) {
    throw userError("Data Embedded Signup tidak lengkap");
  }
  await assertCanAddChannel(session, "wa_official");

  // 1. Tukar code → business token (non-expiring).
  const token = await exchangeWaCode(input.code);

  // 2. Cek duplikat, register nomor (PIN bila belum), subscribe app ke WABA.
  const { name } = await prepareWaOfficial({
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    token,
    pin: input.pin,
  });

  // external_id = phone_number_id (resolver gateway WA). credentials utk kirim balasan.
  await db.insert(channels).values({
    tenantId: session.tenantId,
    type: "wa_official",
    name,
    status: "connected",
    credentials: encryptCreds({
      access_token: token,
      phone_number_id: input.phoneNumberId,
      waba_id: input.wabaId,
    }),
    externalId: input.phoneNumberId,
  });

  revalidatePath("/channels");
}

// --- Putuskan (logout) channel: unsubscribe webhook Meta (best-effort) + hapus row. ---
export async function disconnectChannel(id: string): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");

  const [ch] = await db
    .select({ type: channels.type, credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)));
  if (!ch) throw userError("Channel tidak ditemukan");

  // Meta (FB/IG): lepas subscription webhook Page supaya berhenti kirim event.
  // Best-effort — kegagalan Graph tak boleh menghalangi penghapusan channel.
  if (ch.type === "facebook" || ch.type === "instagram") {
    try {
      const creds = decryptCreds(ch.credentials as Record<string, unknown>);
      const pageId = typeof creds.page_id === "string" ? creds.page_id : "";
      const token = typeof creds.access_token === "string" ? creds.access_token : "";
      if (pageId && token) await unsubscribePageFromApp(pageId, token);
    } catch {
      /* abaikan — tetap hapus channel */
    }
  }

  // Telegram: lepas webhook di Bot API supaya Telegram berhenti push ke gateway
  // untuk channel yang dihapus. Best-effort — kegagalan tak boleh blokir penghapusan.
  if (ch.type === "telegram") {
    try {
      const creds = decryptCreds(ch.credentials as Record<string, unknown>);
      const token = typeof creds.bot_token === "string" ? creds.bot_token : "";
      if (token) await deleteTelegramWebhook(token);
    } catch {
      /* abaikan — tetap hapus channel */
    }
  }

  await db.delete(channels).where(and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)));
  revalidatePath("/channels");
}

// --- WA unofficial: simpan device JID hasil pairing (dipanggil dari halaman QR). ---
export async function attachWaDevice(channelId: string, jid: string) {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!jid.trim()) throw userError("JID device kosong");

  const [ch] = await db
    .select({ credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  if (!ch) throw userError("Channel tidak ditemukan");

  // Decrypt existing dulu (back-compat) → merge device_jid → encrypt ulang semua.
  const plain = decryptCreds(ch.credentials as Record<string, unknown>);
  const creds = encryptCreds({ ...plain, device_jid: jid });
  await db
    .update(channels)
    .set({ status: "connected", externalId: jid, credentials: creds, updatedAt: sql`now()` })
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  revalidatePath("/channels");
}

// --- Broadcast: estimasi audience (opt-in dipaksa). ---
export async function previewAudience(tags: string[]): Promise<number> {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
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

export async function sendReply(
  conversationId: string,
  body: string,
  attachment?: { url: string; mime: string; filename: string } | null,
) {
  const session = await requireSession();
  await assertConvOwned(session, conversationId);
  // Only this tenant's chat uploads (never an arbitrary URL from the client).
  if (attachment) {
    if (!attachment.url.startsWith(`/uploads/${session.tenantId}/chat/`) || attachment.url.includes("..")) {
      throw userError("Lampiran tidak valid");
    }
    if (!CHAT_MIME[attachment.mime]) throw userError("Format lampiran tidak didukung");
  }
  if (!body.trim() && !attachment) throw userError("Tulis pesan atau lampirkan file");
  const res = await fetch(`${ENGINE}/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
      "X-Tenant-Id": session.tenantId ?? "",
    },
    body: JSON.stringify({
      body,
      media: attachment ? { url: attachment.url, mime: attachment.mime, filename: attachment.filename.slice(0, 120) } : null,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = raw;
    try {
      msg = (JSON.parse(raw) as { detail?: string }).detail ?? raw;
    } catch {
      /* plain text */
    }
    throw userError(msg || "Gagal mengirim pesan");
  }
  revalidatePath(`/inbox/${conversationId}`);
}

// Mulai percakapan baru ke 1 nomor (compose). Kirim pesan pertama via engine.
// Return conversationId — navigasi dilakukan client (hindari NEXT_REDIRECT di toast).
export async function startConversation(input: {
  channelId: string;
  phone: string;
  name?: string;
  type?: "text" | "template";
  body?: string;
  templateName?: string;
  templateLang?: string;
}): Promise<{ conversationId: string }> {
  const session = await requireSession();
  requireAbility(session, "conversation.takeover");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");

  // Channel wajib milik tenant (cegah IDOR lintas-tenant).
  const ch = await db.query.channels.findFirst({
    where: and(eq(channels.id, input.channelId), eq(channels.tenantId, session.tenantId)),
    columns: { id: true, status: true },
  });
  if (!ch) throw userError("Channel tidak ditemukan");
  if (ch.status !== "connected") throw userError("Channel belum terhubung");

  const res = await fetch(`${ENGINE}/conversations/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
      "X-Tenant-Id": session.tenantId,
    },
    body: JSON.stringify({
      channel_id: input.channelId,
      phone: input.phone,
      name: input.name || null,
      type: input.type ?? "text",
      body: input.body ?? null,
      template_name: input.templateName ?? null,
      template_lang: input.templateLang ?? "id",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw userError(`Gagal memulai percakapan${msg ? `: ${msg}` : ""}`);
  }
  const json = (await res.json().catch(() => null)) as { data?: { conversation_id?: string } } | null;
  const convId = json?.data?.conversation_id;
  if (!convId) throw userError("Gagal memulai percakapan");
  revalidatePath("/inbox");
  return { conversationId: String(convId) };
}

// --- AI Agent (06) ---
export async function addKnowledge(title: string, text: string) {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await assertCanAddKb(session); // lock: batas dokumen knowledge base per paket (admin bypass)
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
    throw userError(`Gagal memproses dokumen${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath("/flows");
}

export async function deleteKnowledge(docId: string) {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const res = await fetch(`${ENGINE}/knowledge/${docId}`, {
    method: "DELETE",
    headers: {
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
      "X-Tenant-Id": session.tenantId,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw userError(`Gagal menghapus dokumen${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath("/flows");
}

// Status AI (LLM terkonfigurasi di engine?) — untuk indikator aktif/nonaktif di UI.
export async function aiAgentStatus(): Promise<boolean> {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  try {
    const res = await fetch(`${ENGINE}/ai-agent/status`, {
      headers: { "X-Service-Token": process.env.SERVICE_TOKEN ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const j = await res.json();
    return Boolean(j?.data?.enabled);
  } catch {
    return false;
  }
}

// --- Flows (06) ---
// Flow builder is open to plans with Otomasi or Broadcast (broadcast lives in flows);
// what each flow may do is checked again on save.
async function requireAutomationOrBroadcast(session: Session): Promise<void> {
  if (await hasFeature(session, "broadcast")) return;
  await requireFeature(session, "automation", "Otomasi");
}

export async function createFlow() {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await requireAutomationOrBroadcast(session); // lock: fitur otomasi/flow per paket (admin bypass)
  const [row] = await db
    .insert(flows)
    .values({
      tenantId: session.tenantId,
      name: "Flow Baru",
      status: "draft",
      trigger: "welcome",
      // New flows open on the canvas: trigger (pesan pertama) → greeting.
      definition: (() => {
        const graph = starterGraph();
        return { nodes: compileGraph(graph).nodes, ui: graph };
      })(),
    })
    .returning({ id: flows.id });
  redirect(`/flows/${row.id}`);
}

// Start a flow from a template (Automation → Template). Saved as draft so the user
// reviews/edits it on the canvas before activating.
export async function createFlowFromTemplate(templateId: string) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const tpl = findTemplate(templateId);
  if (!tpl) throw userError("Template tidak ditemukan");
  const graph = tpl.build();
  const isBroadcast = graph.nodes.some((n) => n.type === "trigger" && (n.data as { kind?: string }).kind === "broadcast");
  if (isBroadcast) await requireFeature(session, "broadcast", "Broadcast");
  else await requireFeature(session, "automation", "Otomasi");
  await assertFlowNodesAllowed(session, graph.nodes.map((n) => n.type));
  const compiled = compileGraph(graph);
  const [row] = await db
    .insert(flows)
    .values({
      tenantId: session.tenantId,
      name: tpl.title,
      status: "draft",
      trigger: compiled.trigger,
      definition: { nodes: compiled.nodes, ui: graph },
    })
    .returning({ id: flows.id });
  revalidatePath("/flows");
  redirect(`/flows/${row.id}`);
}

export type FlowClash = { name: string; reason: string };

// Active flows of this workspace as trigger info (for the one-account-one-flow rule).
async function activeFlowTriggers(tenantId: string): Promise<FlowTriggerInfo[]> {
  const rows = await db
    .select({ id: flows.id, name: flows.name, trigger: flows.trigger, definition: flows.definition })
    .from(flows)
    .where(and(eq(flows.tenantId, tenantId), eq(flows.status, "active")));
  return rows.map(triggerInfo);
}

async function accountNamer(tenantId: string): Promise<(id: string) => string> {
  const rows = await db
    .select({ id: channels.id, name: channels.name })
    .from(channels)
    .where(eq(channels.tenantId, tenantId));
  const names = new Map(rows.map((r) => [r.id, r.name]));
  return (id) => (names.has(id) ? `"${names.get(id)}"` : "terpilih");
}

// Other ACTIVE flows that answer the same messages on the same account (save dialog).
export async function flowTriggerClashes(
  id: string,
  trigger: "keyword" | "button" | "welcome" | "fallback" | "comment" | "broadcast",
  keywords: string[],
  accounts: string[] = [],
  posts: string[] = [],
): Promise<FlowClash[]> {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) return [];
  const mine: FlowTriggerInfo = {
    id,
    name: "",
    kind: trigger,
    channels: accounts,
    keywords: keywords.map((k) => k.trim().toLowerCase()).filter(Boolean),
    posts,
  };
  const [others, name] = await Promise.all([activeFlowTriggers(session.tenantId), accountNamer(session.tenantId)]);
  return findFlowConflicts(mine, others, name)
    .slice(0, 5)
    .map((c) => ({ name: c.flowName, reason: `akun ${c.account} — ${c.reason}` }));
}

// --- Hapus flow (daftar Automation). Broadcast terjadwal dari flow ini dibatalkan. ---
export async function deleteFlow(id: string): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const tenantId = session.tenantId;
  await db.transaction(async (tx) => {
    const own = await tx
      .select({ id: flows.id, name: flows.name })
      .from(flows)
      .where(and(eq(flows.id, id), eq(flows.tenantId, tenantId)));
    if (!own.length) throw userError("Flow tidak ditemukan");
    // A pending broadcast of this flow must not go out after the flow is gone.
    await applyFlowBroadcast(tx, session, id, own[0].name, "draft", null);
    await tx.delete(flows).where(and(eq(flows.id, id), eq(flows.tenantId, tenantId)));
  });
  revalidatePath("/flows");
}

export async function saveFlow(
  id: string,
  input: {
    name: string;
    status: "draft" | "active";
    trigger: "keyword" | "button" | "welcome" | "fallback" | "comment" | "broadcast";
    definition: unknown;
  },
): Promise<FlowBroadcastResult> {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!input.name.trim()) throw userError("Nama flow wajib diisi");
  if (!["draft", "active"].includes(input.status)) throw userError("Status flow tidak valid");
  if (!["keyword", "button", "welcome", "fallback", "comment", "broadcast"].includes(input.trigger)) throw userError("Jenis pemicu tidak valid");
  if (input.trigger !== "broadcast" && input.status === "active") await requireFeature(session, "automation", "Otomasi");
  const definition = input.definition as {
    nodes?: unknown;
    menu?: { prompt?: unknown; saveAs?: unknown; invalidText?: unknown; options?: unknown[] };
  };
  // Runtime nodes are what the engine executes — reject broken wiring server-side.
  const runtimeError = validateRuntimeNodes(definition?.nodes);
  if (runtimeError) throw userError(runtimeError);
  // Only steps included in the tenant's plan (canvas nodes; fall back to runtime types).
  const ui = (input.definition as { ui?: { nodes?: { type?: unknown }[] } })?.ui?.nodes;
  const kinds = (Array.isArray(ui) ? ui : (definition?.nodes as { type?: unknown }[]) ?? []).map((n) => String(n?.type ?? ""));
  await assertFlowNodesAllowed(session, kinds);
  if (definition?.menu) {
    const menu = definition.menu;
    if (typeof menu.prompt !== "string" || !menu.prompt.trim()) throw userError("Pesan menu wajib diisi");
    if (!Array.isArray(menu.options) || menu.options.length < 2 || menu.options.length > 10) {
      throw userError("Menu harus punya 2–10 pilihan");
    }
    if (typeof menu.saveAs !== "string" || !/^[a-zA-Z0-9_]+$/.test(menu.saveAs.trim())) {
      throw userError("Nama variabel menu tidak valid");
    }
    const codes = new Set<string>();
    const labels = new Set<string>();
    for (const rawOption of menu.options) {
      if (!rawOption || typeof rawOption !== "object") throw userError("Format pilihan menu tidak valid");
      const option = rawOption as { code?: unknown; label?: unknown; response?: unknown };
      const code = typeof option.code === "string" ? option.code.trim() : "";
      const label = typeof option.label === "string" ? option.label.trim() : "";
      const response = typeof option.response === "string" ? option.response.trim() : "";
      if (!/^[a-zA-Z0-9_]+$/.test(code) || !label || !response) {
        throw userError("Setiap pilihan harus punya kode, label, dan balasan");
      }
      if (codes.has(code.toLowerCase()) || labels.has(label.toLowerCase())) {
        throw userError("Kode dan label pilihan menu harus unik");
      }
      codes.add(code.toLowerCase());
      labels.add(label.toLowerCase());
    }
  }
  // One account, one flow per trigger: an active flow may not answer the same
  // messages on the same account as another active flow.
  if (input.status === "active" && input.trigger !== "broadcast") {
    const mine = triggerInfo({ id, name: input.name, trigger: input.trigger, definition: input.definition });
    const [others, name] = await Promise.all([activeFlowTriggers(session.tenantId), accountNamer(session.tenantId)]);
    const conflict = findFlowConflicts(mine, others, name)[0];
    if (conflict) throw userError(conflictMessage(conflict));
  }
  // Broadcast trigger: validate + snapshot before anything is written.
  const nodes = definition.nodes as RuntimeNode[];
  const snapshot = input.status === "active" ? await prepareFlowBroadcast(session, nodes) : null;
  const tenantId = session.tenantId;
  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(flows)
      .set({
        name: input.name,
        status: input.status,
        trigger: input.trigger,
        definition: input.definition as object,
        updatedAt: sql`now()`,
      })
      .where(and(eq(flows.id, id), eq(flows.tenantId, tenantId)))
      .returning({ id: flows.id });
    if (!updated.length) throw userError("Flow tidak ditemukan");
    return applyFlowBroadcast(tx, session, id, input.name, input.status, snapshot);
  });
  revalidatePath(`/flows/${id}`);
  revalidatePath("/flows");
  return result;
}

// Save dialog of a broadcast flow: who would receive it and whether it already went out.
export async function flowBroadcastInfo(flowId: string, tags: string[]): Promise<FlowBroadcastInfo> {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  const empty: FlowBroadcastInfo = { recipients: 0, pending: null, sent: null };
  if (!session.tenantId) return empty;
  const conds = [eq(contacts.tenantId, session.tenantId), eq(contacts.optInStatus, "opted_in")];
  if (tags.length) conds.push(sql`${contacts.tags} && ${tags}`);
  const [count, rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(contacts).where(and(...conds)),
    db.query.broadcasts.findMany({
      where: and(eq(broadcasts.tenantId, session.tenantId), eq(broadcasts.flowId, flowId)),
      columns: { status: true, scheduledAt: true, stats: true, updatedAt: true },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
      limit: 5,
    }),
  ]);
  const pending = rows.find((b) => b.status === "scheduled" || b.status === "draft");
  const sent = rows.find((b) => b.status === "running" || b.status === "done");
  const stats = (sent?.stats ?? {}) as Record<string, number>;
  return {
    recipients: Number(count[0]?.n ?? 0),
    pending: pending ? { scheduledAt: pending.scheduledAt } : null,
    sent: sent ? { at: sent.updatedAt, sent: stats.sent ?? 0, total: stats.total ?? 0 } : null,
  };
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
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (!name && !phone) throw userError("Nama atau nomor telepon wajib diisi");
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
    throw userError("Nomor telepon sudah terdaftar untuk tenant ini");
  }
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function updateContact(id: string, input: ContactInput) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (!name && !phone) throw userError("Nama atau nomor telepon wajib diisi");
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
    throw userError("Nomor telepon sudah terdaftar untuk tenant ini");
  }
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function deleteContact(id: string) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, session.tenantId)));
  revalidatePath("/contacts");
}

export async function importContacts(
  rows: { name: string; phone: string }[],
): Promise<{ inserted: number; skipped: number }> {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");

  const clean = rows
    .map((r) => ({ name: (r.name ?? "").trim(), phone: normalizePhone(r.phone ?? "") }))
    .filter((r) => r.name || r.phone);
  if (!clean.length) throw userError("Tidak ada baris valid untuk diimport");
  if (clean.length > 5000) throw userError("Maksimal 5.000 baris per import");

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

// --- Tim / Users (kelola anggota workspace, 03). RBAC user.manage. ---
// Semua anggota tenant berrole "client" (akses penuh). admin = platform, tak dibuat di sini.
type UserStatusInput = "active" | "invited" | "disabled";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw userError("Nama wajib diisi");
  if (!EMAIL_RE.test(email)) throw userError("Email tidak valid");
  if (!input.password || input.password.length < 6) throw userError("Password minimal 6 karakter");
  await assertCanAddAgent(session); // lock: batas anggota tim per paket (admin bypass)
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    await db.insert(users).values({
      tenantId: session.tenantId,
      name,
      email,
      passwordHash,
      role: "client",
      status: "active",
    });
  } catch {
    throw userError("Email sudah terdaftar");
  }
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUser(
  id: string,
  input: { name: string; status: UserStatusInput; password?: string },
) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw userError("Nama wajib diisi");
  if (id === session.id && input.status !== "active") {
    throw userError("Tidak bisa menonaktifkan akun sendiri");
  }
  const patch: Record<string, unknown> = {
    name,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  if (input.password) {
    if (input.password.length < 6) throw userError("Password minimal 6 karakter");
    patch.passwordHash = await bcrypt.hash(input.password, 10);
  }
  await db.update(users).set(patch).where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)));
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function deleteUser(id: string) {
  const session = await requireSession();
  requireAbility(session, "user.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (id === session.id) throw userError("Tidak bisa menghapus akun sendiri");
  await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)));
  revalidatePath("/settings/users");
}

export async function deletePlatformUser(id: string) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya admin platform");
  if (id === session.id) throw userError("Tidak bisa menghapus akun sendiri");

  const target = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, role: true },
  });
  if (!target) throw userError("Pengguna tidak ditemukan");
  if (target.role === "admin") throw userError("Akun admin platform tidak bisa dihapus dari sini");

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

// --- Platform: aktifkan / suspend tenant (admin platform, tenant.manage). ---
export async function setTenantStatus(id: string, status: "active" | "suspended") {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  await db
    .update(tenants)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tenants.id, id));
  await writeAudit(session, {
    action: status === "suspended" ? "tenant.suspend" : "tenant.activate",
    targetType: "tenant",
    targetId: id,
    targetLabel: t?.name,
    tenantId: id,
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${id}`);
}

// --- Pengaturan: jam kerja & out-of-office (05). RBAC flow.manage (config admin). ---
export async function saveBusinessHours(input: BusinessHours) {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
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
  if (!conv) throw userError("Percakapan tidak ditemukan");
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
    throw userError(`Aksi gagal${msg ? `: ${msg}` : ""}`);
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
  if (!phone) throw userError("Nomor telepon wajib diisi");
  if (!/^[0-9+\-\s]{6,32}$/.test(phone)) throw userError("Nomor telepon tidak valid");

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
  if (!tenant || tenant.status !== "active") throw userError("Workspace tidak ditemukan");

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
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const web_settings = normalizeWebSettings(input);
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
  const settings = { ...((t?.settings as Record<string, unknown>) ?? {}), web_settings };
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, session.tenantId));
  revalidatePath("/settings/web");
}

// --- Pengaturan Platform: branding situs publik (landing/login). Hanya admin platform. ---
// Target = tenant platform (env PLATFORM_TENANT_SLUG, fallback tenant tertua), bukan acting tenant.
export async function savePlatformWebSettings(input: WebSettings) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw userError("Hanya admin platform");
  const slug = process.env.PLATFORM_TENANT_SLUG;
  const t = slug
    ? await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
    : await db.query.tenants.findFirst({ orderBy: (tt, { asc }) => asc(tt.createdAt) });
  if (!t) throw userError("Tenant platform tidak ditemukan");
  const web_settings = normalizeWebSettings(input);
  const settings = { ...((t.settings as Record<string, unknown>) ?? {}), web_settings };
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, t.id));
  await writeAudit(session, { action: "platform.settings_update", targetType: "platform" });
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

// --- Tag & Label (segmentasi kontak, web-owned). RBAC contact.manage. ---
export async function createTag(input: { name: string; color: string }) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw userError("Nama tag wajib diisi");
  await db.insert(tags).values({ tenantId: session.tenantId, name, color: input.color || null });
  revalidatePath("/tags");
  redirect("/tags");
}

export async function updateTag(id: string, input: { name: string; color: string }) {
  const session = await requireSession();
  requireAbility(session, "contact.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw userError("Nama tag wajib diisi");
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
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.tenantId, session.tenantId)));
  revalidatePath("/tags");
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
  if (!name) throw userError("Nama template wajib diisi");
  if (!body) throw userError("Isi template wajib diisi");
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
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const v = normalizeTemplate(input);
  await db.insert(templates).values({ tenantId: session.tenantId, ...v });
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const v = normalizeTemplate(input);
  await db
    .update(templates)
    .set({ ...v, updatedAt: new Date().toISOString() })
    .where(and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)));
  revalidatePath("/templates");
  redirect("/templates");
}

// Buat template WhatsApp (HSM) langsung di WABA channel terpilih lewat Graph API.
// Meta = sumber kebenaran (status review), bukan tabel lokal.
export async function createWaTemplate(input: CreateWaTemplateInput): Promise<{ status: string }> {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  if (!input.templateName.trim()) throw userError("Nama template wajib diisi");
  if (!input.body.trim()) throw userError("Isi template wajib diisi");
  // Channel diambil dari DB dengan filter tenant sesi (cegah pakai WABA tenant lain).
  const [ch] = await listWaChannelCreds(session.tenantId, input.channelId);
  if (!ch) throw userError("Channel WhatsApp Official tidak ditemukan atau belum terhubung");
  const buttons = input.buttons ?? [];
  if (buttons.length > 10) throw userError("Maksimal 10 tombol");
  if (buttons.filter((b) => b.type === "URL").length > 2) throw userError("Maksimal 2 tombol link");
  if (buttons.filter((b) => b.type === "PHONE_NUMBER").length > 1) throw userError("Maksimal 1 tombol telepon");
  for (const b of buttons) {
    if (!b.text.trim() || b.text.length > 25) throw userError("Teks tombol wajib diisi, maksimal 25 karakter");
    if (b.type === "URL" && !/^https:\/\//.test(b.url)) throw userError("Link tombol harus diawali https://");
    if (b.type === "PHONE_NUMBER" && !/^\+?\d{8,15}$/.test(b.phone.replace(/[\s-]/g, "")))
      throw userError("Nomor telepon tombol tidak valid");
  }
  const { channelId: _channelId, ...rest } = input;
  void _channelId;
  const created = await createWaTemplateOnMeta(ch, rest);
  revalidatePath("/templates");
  return { status: created.status };
}

// Upload contoh media header (gambar/video/dokumen) ke Meta untuk review template.
// Balikkan handle yang disertakan saat submit template.
export async function uploadWaTemplateSample(channelId: string, form: FormData): Promise<{ handle: string }> {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw userError("Pilih file terlebih dulu");
  const allowed = ["image/jpeg", "image/png", "video/mp4", "application/pdf"];
  if (!allowed.includes(file.type)) throw userError("Format harus JPG, PNG, MP4, atau PDF");
  if (file.size > 16 * 1024 * 1024) throw userError("Ukuran maksimal 16 MB");
  const [ch] = await listWaChannelCreds(session.tenantId, channelId);
  if (!ch) throw userError("Channel WhatsApp Official tidak ditemukan atau belum terhubung");
  return { handle: await uploadTemplateSample(ch.token, file) };
}

// Upload gambar header broadcast → URL publik yang diambil Meta saat kirim.
export async function uploadBroadcastMedia(form: FormData): Promise<{ url: string }> {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw userError("Pilih gambar terlebih dulu");
  const rel = await saveImage(file, `broadcast/${session.tenantId}`);
  const base = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  return { url: `${base}${rel}` };
}

export async function deleteTemplate(id: string) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, session.tenantId)));
  revalidatePath("/templates");
}

// --- Produk (katalog) — RBAC product.manage. Foto = URL hasil upload (/api/products/upload).
export type ProductInput = {
  name: string;
  description?: string | null;
  priceIdr: number;
  sku?: string | null;
  stock: number;
  category?: string | null;
  photos: string[];
  active: boolean;
};

function normalizeProduct(input: ProductInput) {
  const name = input.name.trim();
  if (!name) throw userError("Nama produk wajib");
  const priceIdr = Math.max(0, Math.round(Number(input.priceIdr) || 0));
  const stock = Math.max(0, Math.round(Number(input.stock) || 0));
  const photos = (input.photos ?? []).filter((p) => typeof p === "string" && p.trim()).slice(0, 10);
  return {
    name,
    description: input.description?.trim() || null,
    priceIdr,
    sku: input.sku?.trim() || null,
    stock,
    category: input.category?.trim() || null,
    photos,
    active: Boolean(input.active),
  };
}

export async function createProduct(input: ProductInput) {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await requireFeature(session, "catalog", "Katalog Produk"); // lock: fitur katalog per paket (admin bypass)
  await db.insert(products).values({ tenantId: session.tenantId, ...normalizeProduct(input) });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, input: ProductInput) {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const data = normalizeProduct(input);

  // Hapus file foto lama yang dibuang user (hemat storage; abaikan kalau gagal).
  const [current] = await db
    .select({ photos: products.photos })
    .from(products)
    .where(and(eq(products.id, id), eq(products.tenantId, session.tenantId)));
  if (current) {
    const removed = (current.photos ?? []).filter((p) => !data.photos.includes(p));
    await Promise.all(removed.map((url) => deleteUpload(url)));
  }

  await db
    .update(products)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(and(eq(products.id, id), eq(products.tenantId, session.tenantId)));
  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(id: string) {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.tenantId, session.tenantId)))
    .returning({ photos: products.photos });
  if (row) await Promise.all((row.photos ?? []).map((url) => deleteUpload(url)));
  revalidatePath("/products");
}
