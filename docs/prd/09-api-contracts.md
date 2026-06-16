# 09 — API Contracts & Event Schemas

Dependensi: `01`, `04`, `05`. Kontrak antar servis. Versi prefix `/v1`.

## Event queue (Redis Streams)

### Stream `message.inbound`  (Gateway → Engine)
```jsonc
{
  "event_id": "ulid",
  "dedup_key": "<channel_id>:<provider_message_id>",
  "channel_id": "uuid",
  "channel_type": "wa_official|wa_unofficial|instagram|facebook|telegram",
  "from": { "external_id": "628xxx", "phone": "+628xxx|null", "name": "Budi|null" },
  "type": "text|image|file|interactive",
  "body": "string|null",
  "media": { "url": "...", "mime": "...", "filename": "..." } ,
  "provider_message_id": "wamid.xxx",
  "timestamp": "ISO8601"
}
```
Consumer group: `engine`. Ack setelah persist.

### Stream `message.outbound`  (Engine → Gateway)
```jsonc
{
  "event_id": "ulid",
  "idempotency_key": "string",       // gateway skip kalau sudah kirim
  "channel_id": "uuid",
  "to": { "external_id": "628xxx", "phone": "+628xxx|null" },
  "type": "text|template|media",
  "body": "string|null",
  "template": { "name": "...", "lang": "id", "components": [...] },  // wa_official di luar window
  "media": { "url": "...", "mime": "..." },
  "conversation_id": "uuid"
}
```
Consumer group: `gateway`. Setelah kirim → publish status (lihat bawah).

### Stream `message.status`  (Gateway → Engine)
```jsonc
{ "idempotency_key": "string", "provider_message_id": "wamid.xxx",
  "status": "sent|delivered|read|failed", "error": "string|null", "timestamp": "ISO8601" }
```

### Pub/Sub `realtime.<tenant_id>`  (Engine → Web via Gateway WS)
```jsonc
{ "type": "message.new|conversation.updated|conversation.assigned|channel.status",
  "payload": { /* sesuai tipe */ } }
```

## REST internal (Web → Engine)  `/internal/v1`

Auth: service token (header `X-Service-Token`). Tidak diekspos publik.

| Method | Path | Fungsi |
|---|---|---|
| POST | `/broadcasts/{id}/run` | mulai broadcast (engine buat recipients + worker) |
| POST | `/flows/{id}/test` | jalankan flow ke nomor uji |
| POST | `/ai-agent/preview` | uji jawaban AI agent (admin) |
| POST | `/knowledge/{doc_id}/reindex` | re-embed dokumen |
| GET | `/conversations/{id}/messages` | thread (eager-loaded) untuk render server |

## Gateway HTTP (publik — webhook & WS)

| Method | Path | Fungsi |
|---|---|---|
| GET/POST | `/webhooks/meta/wa` | webhook WA Cloud (verify + receive) |
| GET/POST | `/webhooks/meta/ig` | Instagram |
| GET/POST | `/webhooks/meta/fb` | Facebook |
| POST | `/webhooks/telegram/{channel_id}` | Telegram |
| POST | `/channels/{id}/connect-unofficial` | mulai sesi whatsmeow → balikan QR |
| GET | `/channels/{id}/qr` | stream QR (SSE) sampai paired |
| WS | `/ws?tenant={id}&token={jwt}` | realtime dashboard |

## Web BFF (publik — dipakai dashboard)

Mayoritas via **Server Actions**; Route Handlers untuk yang butuh callback eksternal.

| Method | Path | Fungsi |
|---|---|---|
| GET/POST | `/api/auth/*` | login/sesi |
| GET | `/api/meta/embedded-signup/callback` | callback OAuth embedded signup → simpan credentials |
| Action | `contacts.create/update/delete/import` | CRUD kontak |
| Action | `broadcasts.create/schedule` | siapkan broadcast (run di engine) |
| Action | `flows.save` | simpan definition |
| Action | `channels.connectOfficial/connectUnofficial/disconnect` | kelola channel |
| Action | `users.invite/updateRole` | kelola user (admin) |

## Konvensi response

- Sukses: `{ "data": ... }`. Error: `{ "error": { "code": "...", "message": "..." } }` (message Bahasa Indonesia, aman ditampilkan).
- List: `{ "data": [...], "next_cursor": "..." }` (keyset, lihat `02`).
- Validasi: 422 + daftar field error (untuk rhf+zod di klien).

## Auth & keamanan

- User session: JWT (httpOnly cookie) di Web; WS pakai JWT short-lived.
- Service-to-service: token statis di env (rotasi berkala).
- Webhook Meta: verifikasi `X-Hub-Signature-256` wajib.
- Kredensial channel: enkripsi at-rest (`channels.credentials`), jangan pernah kirim ke klien.
- Rate limit webhook & WS per tenant.
