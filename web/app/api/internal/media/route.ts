import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { UPLOAD_DIR } from "@/lib/uploads";
import { CHAT_MIME } from "@/lib/chat-attachments";

export const runtime = "nodejs";

// Same cap as outbound chat attachments (WhatsApp media limit).
const MAX_BYTES = 16 * 1024 * 1024;

function validToken(got: string | null): boolean {
  const expected = process.env.SERVICE_TOKEN;
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/internal/media — called by the gateway (service-to-service) for an
// attachment a customer sent (photo, voice note, video, document, sticker).
// Multipart: channel_id + file. Stored under UPLOAD_DIR/<tenant>/chat/ like agent
// uploads, so the inbox renders it through /uploads/...
export async function POST(request: Request) {
  if (!validToken(request.headers.get("x-service-token"))) {
    return new Response("unauthorized", { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const channelId = form?.get("channel_id");
  const file = form?.get("file");
  if (typeof channelId !== "string" || !channelId || !(file instanceof File)) {
    return new Response("channel_id + file wajib", { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return new Response("ukuran file tidak valid", { status: 413 });
  }

  // Tenant comes from the channel row, never from the caller.
  const [ch] = await db
    .select({ tenantId: channels.tenantId })
    .from(channels)
    .where(eq(channels.id, channelId));
  if (!ch) return new Response("channel tidak ditemukan", { status: 404 });

  // "audio/ogg; codecs=opus" → "audio/ogg". Unknown types are kept as .bin, which
  // /uploads serves as a download (never inline), so nothing runs in the browser.
  const mime = (file.type.split(";")[0] ?? "").trim().toLowerCase();
  const ext = CHAT_MIME[mime]?.[0] ?? "bin";

  const dir = path.join(UPLOAD_DIR, ch.tenantId, "chat");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return Response.json({ url: `/uploads/${ch.tenantId}/chat/${name}`, mime: mime || "application/octet-stream" });
}
