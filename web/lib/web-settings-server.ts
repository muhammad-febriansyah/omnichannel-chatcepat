import "server-only";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { tenants } from "./db/schema";
import { getSession } from "./session";
import { DEFAULT_WEB_SETTINGS, normalizeWebSettings, tenantWebDefaults, type WebSettings } from "./web-settings";

// Tenant: default branding = nama tenant (bukan ChatCepat platform).
function pickWebSettings(t?: { name?: string; settings: unknown }): WebSettings {
  const base = tenantWebDefaults(t?.name ?? "Workspace");
  return normalizeWebSettings((t?.settings as Record<string, unknown> | undefined)?.web_settings, base);
}

async function readTenant(where: ReturnType<typeof eq>): Promise<WebSettings> {
  try {
    const t = await db.query.tenants.findFirst({ where });
    return pickWebSettings(t);
  } catch {
    return DEFAULT_WEB_SETTINGS;
  }
}

export async function getWebSettingsByTenant(tenantId: string): Promise<WebSettings> {
  return readTenant(eq(tenants.id, tenantId));
}

export async function getWebSettingsBySlug(slug: string): Promise<WebSettings> {
  return readTenant(eq(tenants.slug, slug));
}

// Branding publik (landing/login/opt-in untuk pengunjung anonim).
// Ambil tenant platform: env PLATFORM_TENANT_SLUG, fallback tenant tertua.
export async function getPublicWebSettings(): Promise<WebSettings> {
  try {
    const slug = process.env.PLATFORM_TENANT_SLUG;
    const t = slug
      ? await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
      : await db.query.tenants.findFirst({ orderBy: asc(tenants.createdAt) });
    // Platform: default = ChatCepat (DEFAULT_WEB_SETTINGS), bukan nama tenant.
    return normalizeWebSettings((t?.settings as Record<string, unknown> | undefined)?.web_settings);
  } catch {
    return DEFAULT_WEB_SETTINGS;
  }
}

// Web settings tenant user yang login (untuk metadata app).
// Pengunjung publik → branding platform dari DB, bukan default hardcoded.
export async function getActiveWebSettings(): Promise<WebSettings> {
  const session = await getSession();
  if (session?.tenantId) return getWebSettingsByTenant(session.tenantId);
  return getPublicWebSettings();
}

// Bangun objek Metadata Next dari WebSettings.
export function metadataFrom(ws: WebSettings): Metadata {
  // metadataBase: resolusi URL absolut utk OG/Twitter image (crawler butuh absolut).
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const title = ws.seo.title || ws.siteName;
  const description = ws.seo.description || ws.description;
  const keywords = ws.seo.keywords
    ? ws.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : undefined;
  const ogImages = ws.seo.ogImage ? [{ url: ws.seo.ogImage }] : undefined;
  // Favicon dari DB di semua slot (favicon, shortcut, apple-touch).
  // Prioritas: faviconUrl khusus → fallback ke logo brand (juga dari DB).
  const iconUrl = ws.faviconUrl || ws.logoUrl || undefined;
  const icons = iconUrl ? { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } : undefined;
  const twitterHandle = ws.social.twitter
    ? `@${ws.social.twitter.replace(/^.*\/(@)?/, "").replace(/^@/, "")}`
    : undefined;

  return {
    metadataBase: new URL(base),
    applicationName: ws.siteName,
    title: { default: title, template: `%s · ${ws.siteName}` },
    description,
    keywords,
    icons,
    authors: [{ name: ws.siteName }],
    creator: ws.siteName,
    publisher: ws.siteName,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: base,
      title,
      description,
      siteName: ws.siteName,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      site: twitterHandle,
      creator: twitterHandle,
      title,
      description,
      images: ws.seo.ogImage ? [ws.seo.ogImage] : undefined,
    },
  };
}
