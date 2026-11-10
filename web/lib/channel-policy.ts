import "server-only";

// WhatsApp "unofficial" (QR pairing via WhatsApp Web) is not supported by WhatsApp.
// DISABLE_WA_UNOFFICIAL=1 hides it from Connect Channel and blocks new connections.
// Channels that are already connected keep working until they are removed.
export function waUnofficialEnabled(): boolean {
  const v = (process.env.DISABLE_WA_UNOFFICIAL ?? "").trim().toLowerCase();
  return !["1", "true", "yes", "on"].includes(v);
}
