import "server-only";
// Meta signed_request (data deletion / deauthorize callbacks): "<sig>.<payload>",
// both base64url; sig = HMAC-SHA256(payload, app secret). Unsigned or tampered
// requests return null so nobody can trigger these endpoints on someone's behalf.
import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaSignedRequest = { user_id: string; algorithm: string; issued_at?: number };

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function parseSignedRequest(signed: string, appSecret: string): MetaSignedRequest | null {
  if (!signed || !appSecret) return null;
  const [sigPart, payloadPart, extra] = signed.split(".");
  if (!sigPart || !payloadPart || extra !== undefined) return null;
  const expected = createHmac("sha256", appSecret).update(payloadPart).digest();
  const got = b64url(sigPart);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const data = JSON.parse(b64url(payloadPart).toString("utf8")) as Partial<MetaSignedRequest>;
    if (String(data.algorithm).toUpperCase() !== "HMAC-SHA256" || !data.user_id) return null;
    return { user_id: String(data.user_id), algorithm: "HMAC-SHA256", issued_at: Number(data.issued_at) || undefined };
  } catch {
    return null;
  }
}

// Stable confirmation code for one request: same user + time → same code, nothing stored.
export function confirmationCode(userId: string, issuedAt: number | undefined, appSecret: string): string {
  const h = createHmac("sha256", appSecret).update(`del:${userId}:${issuedAt ?? 0}`).digest("hex");
  return `DEL-${h.slice(0, 12).toUpperCase()}`;
}

export function metaAppSecret(): string {
  return process.env.FB_APP_SECRET || process.env.META_APP_SECRET || "";
}
