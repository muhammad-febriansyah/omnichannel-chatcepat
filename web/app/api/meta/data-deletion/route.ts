import { confirmationCode, metaAppSecret, parseSignedRequest } from "@/lib/meta-signed-request";

export const runtime = "nodejs";

// POST /api/meta/data-deletion — Meta "Data Deletion Request" callback. Called when a
// Facebook user removes ChatCepat and asks for their data to be deleted. Body:
// form-encoded signed_request. Reply = status page URL + confirmation code (Meta spec).
//
// ChatCepat does not store Facebook profile data keyed by the app-scoped user id it
// receives here: Page tokens are deleted when the workspace disconnects the channel,
// and customer messages belong to the workspace that received them. So the request
// is verified, logged for audit, and answered with a status page explaining that.
export async function POST(request: Request) {
  const secret = metaAppSecret();
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const data = typeof signed === "string" ? parseSignedRequest(signed, secret) : null;
  if (!data) return Response.json({ error: "invalid signed_request" }, { status: 400 });

  const code = confirmationCode(data.user_id, data.issued_at, secret);
  console.info(`meta data-deletion request user=${data.user_id} code=${code}`);
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  return Response.json({ url: `${base}/data-deletion?code=${code}`, confirmation_code: code });
}
