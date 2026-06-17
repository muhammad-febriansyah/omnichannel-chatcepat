import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";

// GET /api/channels/[id]/pair — proxy SSE pairing QR dari gateway (server-to-server,
// hindari CORS + sembunyikan GATEWAY_URL dari browser). Auth + tenant scope di sini.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await requireSession();
  if (!session.tenantId || !can(session, "channel.connect")) {
    return new Response("forbidden", { status: 403 });
  }

  const [ch] = await db
    .select({ id: channels.id, type: channels.type })
    .from(channels)
    .where(and(eq(channels.id, id), eq(channels.tenantId, session.tenantId)));
  if (!ch) return new Response("not found", { status: 404 });
  if (ch.type !== "wa_unofficial") {
    return new Response("channel bukan wa_unofficial", { status: 400 });
  }

  const gateway = process.env.GATEWAY_URL ?? "http://localhost:8080";
  let upstream: Response;
  try {
    upstream = await fetch(`${gateway}/channels/${id}/connect-unofficial`, {
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
    });
  } catch {
    return new Response("gateway tidak dapat dihubungi", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("gateway error", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
