import "server-only";
import { createHmac } from "crypto";

// Short-lived token for the gateway WebSocket (realtime.<tenant>): "<tenant>.<exp>.<hmac>".
// Signed with WS_JWT_SECRET (same env on the gateway: internal/ws/ws.go validToken).
export function realtimeToken(tenantId: string, ttlSeconds = 12 * 3600): string {
  const secret = process.env.WS_JWT_SECRET || process.env.SERVICE_TOKEN || "";
  // Expiry rounded up to the hour: the token stays identical across page refreshes,
  // so the client doesn't reconnect the WebSocket on every router.refresh().
  const exp = Math.ceil((Date.now() / 1000 + ttlSeconds) / 3600) * 3600;
  const payload = `${tenantId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
