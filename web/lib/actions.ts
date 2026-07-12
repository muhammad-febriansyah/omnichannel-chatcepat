"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { broadcasts, channels, contacts, flows, products, tags, templates, tenants, users } from "./db/schema";
import { requireAbility, type Role } from "./rbac";
import { requireSession, type Session } from "./session";
import { registerTelegramWebhook, deleteTelegramWebhook } from "./telegram";
import { encryptCreds, decryptCreds } from "./channel-crypto";
import {
  listApiCoAccounts as fetchApiCoAccounts,
  type ApiCoAccountsResult,
  createApiCoTemplate,
  submitApiCoTemplate,
  type CreateTemplateInput,
} from "./apico-server";
import { getConversation } from "./queries";
import { ACTING_TENANT_COOKIE, COOKIE_MAX_AGE, IMPERSONATE_COOKIE, SESSION_COOKIE, signSession, authCookieOptions, authCookieDelete } from "./auth";
import { normalizeBusinessHours, type BusinessHours } from "./business-hours";
import { normalizeWebSettings, type WebSettings } from "./web-settings";
import { deleteUpload } from "./uploads";
import { writeAudit } from "./audit";
import {
  FB_OAUTH_COOKIE,
  getInstagramAccount,
  listPages,
  subscribePageToApp,
  unsubscribePageFromApp,
  verifyOAuthSession,
} from "./facebook";
import {
  exchangeWaCode,
  getWaPhoneInfo,
  registerWaPhone,
  subscribeWabaToApp,
} from "./whatsapp";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

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

// Self-signup: bikin tenant baru + user owner (role client), lalu login otomatis.
export async function register(input: { business: string; name: string; email: string; password: string }) {
  const business = input.business.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!business) throw new Error("Nama bisnis wajib diisi");
  if (!name) throw new Error("Nama wajib diisi");
  if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
  if (!input.password || input.password.length < 6) throw new Error("Password minimal 6 karakter");

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new Error("Email sudah terdaftar");

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
      const [tenant] = await tx.insert(tenants).values({ name: business, slug }).returning();
      const [u] = await tx
        .insert(users)
        .values({ tenantId: tenant.id, name, email, passwordHash, role: "client", status: "active" })
        .returning();
      return u;
    });
  } catch {
    throw new Error("Gagal mendaftar. Coba lagi.");
  }

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
  if (!session.isPlatformAdmin) throw new Error("Hanya admin platform");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!t) throw new Error("Tenant tidak ditemukan");
  const store = await cookies();
  store.set(ACTING_TENANT_COOKIE, tenantId, authCookieOptions(COOKIE_MAX_AGE));
  revalidatePath("/", "layout");
}

// Mulai impersonasi: admin platform "masuk sebagai tenant" → operasikan menu omnichannel.
// Set acting tenant + flag impersonasi, lalu arahkan ke dashboard tenant.
export async function startImpersonation(tenantId: string) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw new Error("Hanya admin platform");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!t) throw new Error("Tenant tidak ditemukan");
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
  if (!session.isPlatformAdmin) throw new Error("Hanya admin platform");
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
  if (!name) throw new Error("Nama wajib diisi");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");

  const current = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!current) throw new Error("User tidak ditemukan");

  const patch: Record<string, unknown> = { name, updatedAt: new Date().toISOString() };

  const newAvatar = input.avatarUrl === undefined ? undefined : input.avatarUrl || null;
  const avatarChanged = newAvatar !== undefined && newAvatar !== current.avatarUrl;
  if (avatarChanged) patch.avatarUrl = newAvatar;

  if (input.password) {
    if (input.password.length < 6) throw new Error("Password minimal 6 karakter");
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
  // Transport provider: undefined = integrasi langsung (Meta/Telegram), "apico" = via api.co.id.
  provider?: "apico";
}) {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (!input.name.trim()) throw new Error("Nama channel wajib");

  // Cegah channel phantom: provider apico HANYA boleh untuk akun yang benar-benar
  // terhubung di api.co.id. Validasi external_id ke daftar resmi + ambil nilai dari
  // sumber tepercaya (jangan percaya input mentah). Tanpa ini channel "Terhubung" palsu
  // → tak ada resource di api.co.id → pesan masuk tak pernah datang.
  if (input.provider === "apico") {
    const { accounts, error } = await fetchApiCoAccounts(input.type);
    // Bedakan gagal-menghubungi dari kosong-beneran: dulu keduanya jadi "Belum ada
    // akun" yang menyesatkan saat penyebab asli key salah/endpoint/network.
    if (error) {
      throw new Error(`Gagal menghubungi api.co.id: ${error}`);
    }
    if (accounts.length === 0) {
      throw new Error("Belum ada akun untuk tipe ini di api.co.id. Hubungkan dulu di dashboard api.co.id.");
    }
    const match = accounts.find((a) => a.externalId === input.externalId);
    if (!match) {
      throw new Error("Akun tidak ditemukan di api.co.id. Pilih dari daftar yang tersedia.");
    }
    input.externalId = match.externalId;
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
      // meta.provider dibaca gateway untuk pilih adapter transport (apico vs Meta langsung).
      meta: input.provider ? { provider: input.provider } : {},
      // Balas otomatis: unofficial default OFF (nomor pribadi rawan banned bila
      // auto-reply) — harus di-ON-kan sadar risiko. Channel resmi default ON.
      autoReplyEnabled: input.type !== "wa_unofficial",
    })
    .returning({ id: channels.id });

  // Telegram: daftarkan webhook ke Bot API supaya pesan masuk diterima gateway.
  // Butuh TELEGRAM_WEBHOOK_BASE (URL publik gateway).
  if (input.type === "telegram") {
    const base = process.env.TELEGRAM_WEBHOOK_BASE;
    if (!base) {
      // Tanpa webhook, Telegram tak tahu ke mana kirim update → inbound tak pernah
      // datang. Jangan tandai "connected" palsu (mirip phantom apico); set pending.
      await db
        .update(channels)
        .set({ status: "pending" })
        .where(and(eq(channels.id, row.id), eq(channels.tenantId, session.tenantId)));
      revalidatePath("/channels");
      throw new Error(
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
      const msg = e instanceof Error ? e.message : "tidak diketahui";
      throw new Error(
        `Channel dibuat, tapi webhook Telegram gagal didaftarkan: ${msg}. Cek TELEGRAM_WEBHOOK_BASE & bot token.`,
      );
    }
  }

  revalidatePath("/channels");
  // wa_unofficial → lanjut ke halaman pairing QR; lainnya langsung selesai.
  redirect(input.type === "wa_unofficial" ? `/channels/${row.id}/pair` : "/channels");
}

// Daftar akun api.co.id yang ASLI terhubung (utk picker connect channel). Tenant-scoped
// via session + butuh ability channel.connect. Mengembalikan [] kalau key/akun kosong.
export async function listApiCoAccounts(type: ChannelType): Promise<ApiCoAccountsResult> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  return fetchApiCoAccounts(type);
}

// --- Toggle balas otomatis (flow + AI) per-channel. Engine baca kolom ini di
// pipeline inbound (OFF → skip decide). Web pemilik tabel channels. ---
export async function setChannelAutoReply(channelId: string, enabled: boolean) {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db
    .update(channels)
    .set({ autoReplyEnabled: enabled, updatedAt: sql`now()` })
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  revalidatePath("/channels");
}

// --- Facebook/Instagram OAuth: finalisasi pilih Page → subscribe webhook + simpan channel. ---
// Dipanggil dari halaman pilih Page setelah callback OAuth. User token long-lived dibaca
// dari cookie httpOnly (FB_OAUTH_COOKIE), bukan input user → tak bisa dipalsu.
export async function connectMetaPage(pageId: string): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const store = await cookies();
  const sealed = store.get(FB_OAUTH_COOKIE)?.value;
  const oauth = sealed ? await verifyOAuthSession(sealed) : null;
  if (!oauth || oauth.tenantId !== session.tenantId) {
    throw new Error("Sesi OAuth kedaluwarsa, ulangi Login dengan Facebook");
  }

  // Ambil ulang daftar Page pakai user token → temukan Page Access Token utk pageId.
  const pages = await listPages(oauth.userToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new Error("Page tidak ditemukan atau akses dicabut");

  // Subscribe app ke webhook Page — wajib supaya pesan masuk diteruskan ke gateway.
  await subscribePageToApp(page.id, page.access_token);

  // Resolver gateway match inbound pakai entry.id webhook:
  //   facebook  → entry.id = Page ID
  //   instagram → entry.id = Instagram Business Account ID (BUKAN Page ID)
  // Jadi utk IG, external_id harus IG account id yg ter-link ke Page.
  let externalId = page.id;
  if (oauth.platform === "instagram") {
    const igId = await getInstagramAccount(page.id, page.access_token);
    if (!igId) {
      throw new Error(
        `Page "${page.name}" belum tertaut akun Instagram Professional. Tautkan IG ke Page dulu di Meta Business.`,
      );
    }
    externalId = igId;
  }

  // Page Access Token dipakai kirim balasan (FB & IG messaging via page token).
  await db.insert(channels).values({
    tenantId: session.tenantId,
    type: oauth.platform,
    name: page.name,
    status: "connected",
    credentials: encryptCreds({ access_token: page.access_token, page_id: page.id }),
    externalId,
  });

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
}): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (!input.code || !input.wabaId || !input.phoneNumberId) {
    throw new Error("Data Embedded Signup tidak lengkap");
  }

  // 1. Tukar code → business token (non-expiring).
  const token = await exchangeWaCode(input.code);

  // 2. Subscribe app ke WABA → webhook pesan aktif.
  await subscribeWabaToApp(input.wabaId, token);

  // 3. Register nomor ke Cloud API (best-effort — bisa sudah ter-register).
  try {
    await registerWaPhone(input.phoneNumberId, token, "000000");
  } catch {
    /* sudah register / butuh PIN custom → tetap lanjut simpan channel */
  }

  // 4. Nama channel dari display number.
  let name = "WhatsApp";
  try {
    const info = await getWaPhoneInfo(input.phoneNumberId, token);
    name = info.verifiedName || info.displayPhoneNumber || name;
  } catch {
    /* abaikan — pakai default */
  }

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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const [ch] = await db
    .select({ type: channels.type, credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)));
  if (!ch) throw new Error("Channel tidak ditemukan");

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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  if (!jid.trim()) throw new Error("JID device kosong");

  const [ch] = await db
    .select({ credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  if (!ch) throw new Error("Channel tidak ditemukan");

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

// --- Broadcast: buat draft + jalankan (engine guard opt-in, throttle). ---
export async function createAndRunBroadcast(input: {
  name: string;
  channelId: string;
  body: string;
  tags: string[];
  templateId?: string; // nama template HSM (WA official, di luar window 24 jam)
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
      templateId: input.templateId?.trim() || null,
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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  // Channel wajib milik tenant (cegah IDOR lintas-tenant).
  const ch = await db.query.channels.findFirst({
    where: and(eq(channels.id, input.channelId), eq(channels.tenantId, session.tenantId)),
    columns: { id: true, status: true },
  });
  if (!ch) throw new Error("Channel tidak ditemukan");
  if (ch.status !== "connected") throw new Error("Channel belum terhubung");

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
    throw new Error(`Gagal memulai percakapan${msg ? `: ${msg}` : ""}`);
  }
  const json = (await res.json().catch(() => null)) as { data?: { conversation_id?: string } } | null;
  const convId = json?.data?.conversation_id;
  if (!convId) throw new Error("Gagal memulai percakapan");
  revalidatePath("/inbox");
  return { conversationId: String(convId) };
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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Nama wajib diisi");
  if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
  if (!input.password || input.password.length < 6) throw new Error("Password minimal 6 karakter");
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
    throw new Error("Email sudah terdaftar");
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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi");
  if (id === session.id && input.status !== "active") {
    throw new Error("Tidak bisa menonaktifkan akun sendiri");
  }
  const patch: Record<string, unknown> = {
    name,
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

// --- Pengaturan Platform: branding situs publik (landing/login). Hanya admin platform. ---
// Target = tenant platform (env PLATFORM_TENANT_SLUG, fallback tenant tertua), bukan acting tenant.
export async function savePlatformWebSettings(input: WebSettings) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) throw new Error("Hanya admin platform");
  const slug = process.env.PLATFORM_TENANT_SLUG;
  const t = slug
    ? await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
    : await db.query.tenants.findFirst({ orderBy: (tt, { asc }) => asc(tt.createdAt) });
  if (!t) throw new Error("Tenant platform tidak ditemukan");
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

// Buat template WhatsApp (HSM) lewat api.co.id: create draft → submit ke Meta.
// HSM = sumber kebenaran di api.co.id (status disinkron Meta), bukan tabel lokal.
export async function createWaTemplate(input: CreateTemplateInput): Promise<{ status: string }> {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!input.templateName.trim()) throw new Error("Nama template wajib diisi");
  if (!input.body.trim()) throw new Error("Isi template wajib diisi");
  const created = await createApiCoTemplate(input);
  if ("error" in created) throw new Error(`Gagal membuat template: ${created.error}`);
  const submitted = await submitApiCoTemplate(created.id);
  if ("error" in submitted)
    throw new Error(`Template dibuat tapi gagal submit ke Meta: ${submitted.error}`);
  revalidatePath("/templates");
  return { status: submitted.status };
}

export async function deleteTemplate(id: string) {
  const session = await requireSession();
  requireAbility(session, "broadcast.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
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
  if (!name) throw new Error("Nama produk wajib");
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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  await db.insert(products).values({ tenantId: session.tenantId, ...normalizeProduct(input) });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, input: ProductInput) {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
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
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.tenantId, session.tenantId)))
    .returning({ photos: products.photos });
  if (row) await Promise.all((row.photos ?? []).map((url) => deleteUpload(url)));
  revalidatePath("/products");
}
