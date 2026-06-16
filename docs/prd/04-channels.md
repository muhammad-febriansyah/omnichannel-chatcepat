# 04 — Channel Integration

Dependensi: `01-architecture.md`, `02-data-model.md`. Semua I/O channel hidup di Go gateway.

## Abstraksi channel

Engine & web hanya kenal format internal. Gateway adapter per `channel.type` menerjemahkan ke/dari format internal.

```
InboundMessage  ◄── adapter ◄── [whatsmeow | wa_cloud | instagram | facebook | telegram]
OutboundCommand ──► adapter ──► [ ... ]
```

Interface (Go):
```go
type ChannelAdapter interface {
    Send(ctx context.Context, cmd OutboundCommand) (providerMessageID string, err error)
    // Inbound di-handle per-adapter (socket event / webhook), dinormalisasi ke InboundMessage
}
```

## 1. WhatsApp Official (Meta Cloud API)

### Onboarding (multi-tenant → Tech Provider + Embedded Signup)
- ChatCepat = **Tech Provider** Meta. Tenant connect nomor **mereka sendiri** lewat **Embedded Signup** (popup OAuth Facebook) di dashboard.
- Output signup: `waba_id`, `phone_number_id`, akses token tenant. Simpan terenkripsi di `channels.credentials`.
- Prasyarat tenant: Business Manager terverifikasi; 1 nomor = 1 Business Manager.
- App ChatCepat butuh: Business Verification + App Review (`whatsapp_business_messaging`) + 2 video demo (kirim pesan & buat template).

> TODO PRODUK: jadi Tech Provider langsung (tanpa markup, beban verifikasi penuh) **atau** lewat BSP (360dialog/Twilio, lebih cepat, ada markup). PRD ini netral; field `credentials` muat dua-duanya.

### Inbound
- Webhook `POST /webhooks/meta/wa` di gateway. Verifikasi `X-Hub-Signature-256`.
- Verifikasi challenge `GET` saat setup (`hub.verify_token`).
- Normalisasi → `InboundMessage`.

### Outbound
- Dalam **service window 24 jam** (kontak chat terakhir < 24 jam): boleh free-form text → gratis.
- Di luar window: wajib **template** pre-approved (kategori marketing/utility/auth → kena charge per pesan).
- Engine set `conversations.service_window_expires_at` tiap pesan masuk; cek sebelum kirim. Kalau di luar window & bukan template → tolak / paksa pilih template.

### Template
- Tabel template sinkron dari Meta (status approved/pending/rejected). Broadcast official wajib pakai template approved.

## 2. WhatsApp Unofficial (whatsmeow)

### Onboarding
- Admin klik "Connect" → gateway buat device whatsmeow → tampilkan **QR** (atau pair code) → admin scan pakai HP.
- Session disimpan whatsmeow `sqlstore` (tabel `whatsmeow_*`). Tidak perlu scan ulang tiap restart.
- `channels.status = connected` saat pairing sukses.

### Inbound/Outbound
- Inbound: event handler whatsmeow (`events.Message`) → normalisasi.
- Outbound: `client.SendMessage`. Tidak ada konsep template/window — semua free-form.

### Risiko (tampilkan di UI)
- Tidak ada service window / template. Tapi **rawan banned** kalau dipakai blast.
- Gateway harus throttle outbound unofficial (jeda acak antar pesan), batasi volume.
- Deteksi disconnect/logout → `status = disconnected/banned` → notif admin.

> KEPUTUSAN: broadcast lewat channel unofficial **dibatasi keras** (rate rendah, hanya ke opt-in). Lihat `07`.

## 3. Instagram & Facebook (Meta Graph API)
- Webhook `POST /webhooks/meta/ig` & `/webhooks/meta/fb`. Sama verifikasi signature.
- Kontak diidentifikasi `external_id` (PSID/IG-scoped ID), `phone` NULL.
- Window 24 jam standar Messenger berlaku (mirip WA official di luar itu butuh tag/pesan berbayar).

## 4. Telegram
- Bot via `getUpdates` (long-poll) atau webhook. Token bot di `channels.credentials`.
- Paling sederhana; tanpa window/template.

## Normalisasi: InboundMessage (lihat schema lengkap di `09`)

```jsonc
{
  "channel_id": "uuid",
  "channel_type": "wa_official",
  "provider_message_id": "wamid.xxx",
  "from": { "external_id": "628xxx", "phone": "+628xxx", "name": "Budi" },
  "type": "text",
  "body": "halo mau pesan",
  "media": null,
  "timestamp": "2026-06-16T03:00:00Z"
}
```

## Status channel & health

- Gateway kirim heartbeat status tiap koneksi. Engine simpan ke `channels.status` + `meta.last_seen`.
- Dashboard tampilkan badge per channel: connected (hijau) / pending (kuning) / disconnected / banned (merah).
- Semua perubahan status → `realtime.event` → toast ke admin.
