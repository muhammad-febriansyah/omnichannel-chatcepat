import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";

// Status koneksi channel yang boleh di-set service (mirror enum channel_status DB).
const ALLOWED = ["connected", "disconnected", "pending", "banned"] as const;
type ChannelStatus = (typeof ALLOWED)[number];

// POST /api/internal/channels/status — dipanggil gateway (service-to-service) saat
// nomor WA unofficial banned/logout/putus permanen. Auth via X-Service-Token (BUKAN
// sesi user — tak ada browser saat ban terjadi). channels tabel milik web, jadi
// persist status durable di sini supaya badge tetap benar tanpa dashboard dibuka.
export async function POST(request: Request) {
  const token = request.headers.get("x-service-token");
  const expected = process.env.SERVICE_TOKEN;
  if (!expected || token !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { channel_id?: unknown; status?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const channelId = typeof body.channel_id === "string" ? body.channel_id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!channelId || !ALLOWED.includes(status as ChannelStatus)) {
    return new Response("channel_id + status (enum) wajib", { status: 400 });
  }

  // Update by channel_id (UUID unik global) — sumbernya gateway tepercaya, bukan
  // input user, jadi tak perlu scope tenant. Enum sudah divalidasi di atas.
  const updated = await db
    .update(channels)
    .set({ status: status as ChannelStatus, updatedAt: sql`now()` })
    .where(eq(channels.id, channelId))
    .returning({ id: channels.id });

  if (updated.length === 0) {
    return new Response("channel tidak ditemukan", { status: 404 });
  }
  return Response.json({ ok: true, channel_id: channelId, status });
}
