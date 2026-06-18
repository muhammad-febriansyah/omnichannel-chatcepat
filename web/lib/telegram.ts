// Registrasi webhook Telegram (Bot API) saat connect channel.
// Tanpa ini, Telegram tak tahu ke mana kirim update → pesan masuk tak pernah datang.

const API = "https://api.telegram.org";

export interface TelegramWebhookResult {
  secret: string;
}

// setWebhook → arahkan bot ke gateway /webhooks/telegram/{channelId}.
// secret_token: dikirim balik Telegram di header X-Telegram-Bot-Api-Secret-Token
// untuk verifikasi (gateway membandingkan dgn creds.tg_secret).
export async function registerTelegramWebhook(
  botToken: string,
  webhookBase: string,
  channelId: string,
): Promise<TelegramWebhookResult> {
  const secret = crypto.randomUUID().replace(/-/g, "");
  const url = `${webhookBase.replace(/\/+$/, "")}/webhooks/telegram/${channelId}`;
  const res = await fetch(`${API}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `setWebhook gagal (HTTP ${res.status})`);
  }
  return { secret };
}

// Lepas webhook saat channel dihapus/diputus.
export async function deleteTelegramWebhook(botToken: string): Promise<void> {
  await fetch(`${API}/bot${botToken}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false }),
    cache: "no-store",
  }).catch(() => {});
}
