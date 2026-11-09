import { metaAppSecret, parseSignedRequest } from "@/lib/meta-signed-request";

export const runtime = "nodejs";

// POST /api/meta/deauthorize — Meta "Deauthorize callback": a user removed the app
// from their Facebook account. Verified and logged; Page tokens stop working on
// Meta's side and the workspace sees the channel as disconnected on the next send.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const data = typeof signed === "string" ? parseSignedRequest(signed, metaAppSecret()) : null;
  if (!data) return new Response("invalid signed_request", { status: 400 });
  console.info(`meta deauthorize user=${data.user_id}`);
  return new Response("ok");
}
