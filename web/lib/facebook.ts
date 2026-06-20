// Facebook/Instagram OAuth + Graph API helper (server-only).
// Flow: user klik "Login dengan Facebook" → dialog OAuth Meta → callback tukar code
// jadi user token long-lived → list Page (beserta Page Access Token) → user pilih Page →
// subscribe Page ke app (webhook) + simpan channel. Tanpa copy-paste token manual.
//
// ENV wajib (server):
//   FB_APP_ID        — App ID Meta (fallback META_APP_ID)
//   FB_APP_SECRET    — App Secret Meta (fallback META_APP_SECRET)
//   APP_BASE_URL     — origin publik web (mis. https://www.chatcepat.id)
//   NEXTAUTH_SECRET  — dipakai menandatangani state OAuth (anti-CSRF)

import { SignJWT, jwtVerify } from "jose";

export const GRAPH_VERSION = "v25.0";
// Cookie httpOnly penyimpan user token long-lived antara callback → halaman pilih Page.
export const FB_OAUTH_COOKIE = "cc_fb_oauth";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Webhook field yang di-subscribe per Page. Sinkron dgn yang di-handle gateway
// (handleMessenger) + dashboard Meta. messages = pesan masuk (wajib).
const SUBSCRIBED_FIELDS = "messages,messaging_postbacks,message_deliveries,message_reads";

// Scope OAuth minimal per platform. pages_show_list + pages_messaging wajib;
// pages_manage_metadata untuk subscribe webhook; pages_read_engagement untuk profil.
const SCOPES: Record<"facebook" | "instagram", string> = {
  facebook: "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement",
  instagram:
    "pages_show_list,pages_manage_metadata,instagram_basic,instagram_manage_messages,pages_messaging",
};

export type MetaPlatform = "facebook" | "instagram";

export interface FbPage {
  id: string;
  name: string;
  access_token: string;
  picture?: string;
}

function appId(): string {
  const v = process.env.FB_APP_ID ?? process.env.META_APP_ID;
  if (!v) throw new Error("FB_APP_ID belum di-set");
  return v;
}

function appSecret(): string {
  const v = process.env.FB_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!v) throw new Error("FB_APP_SECRET belum di-set");
  return v;
}

function baseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

// redirect_uri OAuth — HARUS persis terdaftar di Meta App → Facebook Login → Valid OAuth Redirect URIs.
export function redirectUri(): string {
  return `${baseUrl()}/api/channels/facebook/oauth/callback`;
}

function stateSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET wajib di production");
    return new TextEncoder().encode("dev-secret-change-me-in-production");
  }
  return new TextEncoder().encode(s);
}

// --- State OAuth (anti-CSRF): JWT singkat berisi tenant/user/platform ---

export async function signState(payload: {
  tenantId: string;
  userId: string;
  platform: MetaPlatform;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret());
}

export async function verifyState(
  token: string,
): Promise<{ tenantId: string; userId: string; platform: MetaPlatform } | null> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload as { tenantId: string; userId: string; platform: MetaPlatform };
  } catch {
    return null;
  }
}

// Token user long-lived disimpan sementara (cookie httpOnly) di antara callback → halaman pilih Page.
export async function signOAuthSession(payload: {
  tenantId: string;
  userToken: string;
  platform: MetaPlatform;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(stateSecret());
}

export async function verifyOAuthSession(
  token: string,
): Promise<{ tenantId: string; userToken: string; platform: MetaPlatform } | null> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload as { tenantId: string; userToken: string; platform: MetaPlatform };
  } catch {
    return null;
  }
}

// --- OAuth dialog ---

export function authDialogUrl(state: string, platform: MetaPlatform): string {
  const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", appId());
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("scope", SCOPES[platform]);
  u.searchParams.set("response_type", "code");
  return u.toString();
}

// --- Graph API ---

async function graphError(res: Response): Promise<never> {
  let msg = `${res.status}`;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? msg;
  } catch {
    /* non-JSON */
  }
  throw new Error(`Graph API: ${msg}`);
}

// Tukar code → token user short-lived → long-lived (page token turunannya jadi non-expiring).
export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", appId());
  shortUrl.searchParams.set("client_secret", appSecret());
  shortUrl.searchParams.set("redirect_uri", redirectUri());
  shortUrl.searchParams.set("code", code);
  const shortRes = await fetch(shortUrl, { cache: "no-store" });
  if (!shortRes.ok) await graphError(shortRes);
  const short = (await shortRes.json()) as { access_token: string };

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId());
  longUrl.searchParams.set("client_secret", appSecret());
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const longRes = await fetch(longUrl, { cache: "no-store" });
  if (!longRes.ok) await graphError(longRes);
  const long = (await longRes.json()) as { access_token: string };
  return long.access_token;
}

// Daftar Page yang dikelola user (id, nama, Page Access Token, foto).
export async function listPages(userToken: string): Promise<FbPage[]> {
  const url = new URL(`${GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,picture{url}");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) await graphError(res);
  const j = (await res.json()) as {
    data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }[];
  };
  return (j.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
    picture: p.picture?.data?.url,
  }));
}

// Subscribe app ke webhook Page → pesan masuk mulai dikirim ke callback gateway.
export async function subscribePageToApp(pageId: string, pageToken: string): Promise<void> {
  const url = new URL(`${GRAPH}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", SUBSCRIBED_FIELDS);
  url.searchParams.set("access_token", pageToken);
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) await graphError(res);
}
