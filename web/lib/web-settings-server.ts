import "server-only";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { tenants } from "./db/schema";
import { getSession } from "./session";
import { DEFAULT_WEB_SETTINGS, normalizeWebSettings, type WebSettings } from "./web-settings";

async function readTenant(where: ReturnType<typeof eq>): Promise<WebSettings> {
  try {
    const t = await db.query.tenants.findFirst({ where });
    return normalizeWebSettings((t?.settings as Record<string, unknown> | undefined)?.web_settings);
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

// Web settings tenant user yang login (untuk metadata app). Default kalau belum login.
export async function getActiveWebSettings(): Promise<WebSettings> {
  const session = await getSession();
  if (session?.tenantId) return getWebSettingsByTenant(session.tenantId);
  return DEFAULT_WEB_SETTINGS;
}

// Bangun objek Metadata Next dari WebSettings.
export function metadataFrom(ws: WebSettings): Metadata {
  return {
    title: ws.seo.title || ws.siteName,
    description: ws.seo.description,
    keywords: ws.seo.keywords,
    icons: ws.faviconUrl ? { icon: ws.faviconUrl } : undefined,
    openGraph: {
      title: ws.seo.title || ws.siteName,
      description: ws.seo.description,
      siteName: ws.siteName,
      images: ws.seo.ogImage ? [{ url: ws.seo.ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ws.seo.title || ws.siteName,
      description: ws.seo.description,
      images: ws.seo.ogImage ? [ws.seo.ogImage] : undefined,
    },
  };
}
