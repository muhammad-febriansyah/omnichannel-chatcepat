"use server";
// Recent Facebook Page / Instagram posts for the comment-trigger post picker in the
// flow builder. Picking from a list avoids pasting IDs by hand — an Instagram URL
// only shows the shortcode, never the media ID that comment webhooks carry.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { requireAbility } from "@/lib/rbac";
import { userError } from "@/lib/action-error";
import { decryptCreds } from "@/lib/channel-crypto";
import { GRAPH_VERSION } from "@/lib/facebook";

export type SocialPost = {
  id: string;
  caption: string;
  image: string | null;
  link: string | null;
  createdAt: string | null;
};

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function listChannelPosts(channelId: string): Promise<SocialPost[]> {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");

  const [ch] = await db
    .select({ type: channels.type, externalId: channels.externalId, credentials: channels.credentials })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.tenantId, session.tenantId)));
  if (!ch || (ch.type !== "facebook" && ch.type !== "instagram")) throw userError("Akun Facebook/Instagram tidak ditemukan");

  const creds = decryptCreds(ch.credentials as Record<string, unknown>);
  const token = typeof creds.access_token === "string" ? creds.access_token : "";
  const pageId = typeof creds.page_id === "string" ? creds.page_id : "";
  if (!token) throw userError("Token akun kosong. Hubungkan ulang akun ini.");

  const url =
    ch.type === "instagram"
      ? new URL(`${GRAPH}/${ch.externalId}/media`)
      : new URL(`${GRAPH}/${pageId || ch.externalId}/posts`);
  url.searchParams.set(
    "fields",
    ch.type === "instagram"
      ? "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
      : "id,message,full_picture,permalink_url,created_time",
  );
  url.searchParams.set("limit", "25");
  url.searchParams.set("access_token", token);

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>[]; error?: { message?: string } };
  if (!res.ok) throw userError(`Gagal mengambil postingan: ${json.error?.message ?? res.status}`);

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return (json.data ?? []).map((p) =>
    ch.type === "instagram"
      ? {
          id: String(p.id),
          caption: str(p.caption) ?? "",
          // Videos/Reels: media_url is the video file, so show the thumbnail instead.
          image: p.media_type === "VIDEO" ? str(p.thumbnail_url) : str(p.media_url),
          link: str(p.permalink),
          createdAt: str(p.timestamp),
        }
      : {
          id: String(p.id),
          caption: str(p.message) ?? "",
          image: str(p.full_picture),
          link: str(p.permalink_url),
          createdAt: str(p.created_time),
        },
  );
}
