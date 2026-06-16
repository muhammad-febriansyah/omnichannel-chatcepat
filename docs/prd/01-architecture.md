# 01 — Arsitektur

Dependensi baca: `00-overview.md`.

## Peta servis

```
                         ┌──────────────────────────┐
   WA unofficial ───────►│                          │
   (whatsmeow socket)    │      GO GATEWAY          │
                         │  - whatsmeow sessions    │
   Meta webhooks ───────►│  - Meta webhook receiver │──┐ publish: message.inbound
   (WA Cloud, IG, FB)    │  - Telegram getUpdates   │  │
                         │  - WS server → dashboard │  │
                         └──────────────────────────┘  │
                              ▲                          ▼
                consume:      │                   ┌─────────────┐
                message.      │                   │   REDIS     │
                outbound      │                   │ Streams +   │
                              │                   │ Pub/Sub     │
                              │                   └─────────────┘
                              │                          │ consume: message.inbound
                              │                          ▼
                         ┌────┴─────────────────────────────────┐
   publish:              │            PYTHON ENGINE             │
   message.outbound  ◄───│  - decision pipeline (lihat 05)     │
   realtime.event        │  - AI agent + RAG (lihat 06)        │
                         │  - persist conversation/message     │
                         │  - broadcast worker                 │
                         └─────────────────────────────────────┘
                              │ read/write
                              ▼
                         ┌─────────────┐        ┌──────────────────┐
                         │ POSTGRES    │◄───────│   NEXT.JS WEB    │
                         │ + pgvector  │ r/w    │  - dashboard     │
                         └─────────────┘        │  - BFF / actions │
                                                │  - subscribe WS  │
                                                └──────────────────┘
```

## Tanggung jawab & batas

### Go Gateway (`/gateway`)
> KEPUTUSAN: semua I/O channel disatukan di Go. Alasan: whatsmeow butuh Go + konkurensi tinggi; menyatukan webhook Meta di sini bikin satu titik normalisasi pesan, jadi engine cuma kenal satu format internal.

- **Inbound:** terima dari whatsmeow (event), webhook Meta (HTTP), Telegram. Normalisasi ke `InboundMessage` (schema di `09`). Publish ke stream `message.inbound`.
- **Outbound:** konsumsi stream `message.outbound`, kirim lewat channel yang sesuai (whatsmeow `SendMessage` / Meta Graph POST / Telegram sendMessage).
- **Realtime:** WebSocket server untuk dashboard. Subscribe Redis Pub/Sub channel `realtime.<tenant_id>`, push ke klien yang terhubung. (Go unggul di WS jangka panjang — dipakai sekalian.)
- **Session store:** tabel milik whatsmeow (`whatsmeow_*`), terpisah dari skema domain.
- **TIDAK** menulis tabel domain. Status pengiriman (sent/delivered/read) dia publish sebagai event, engine yang persist.

### Python Engine (`/engine`)
- Consumer `message.inbound`. Jalankan **decision pipeline** (`05`).
- Pemilik tulis tabel: `conversations`, `messages`, `conversation_states`, `broadcast_recipients`.
- AI agent + RAG (`06`): panggil LLM, retrieve dari pgvector, eksekusi tool.
- Broadcast worker: ambil batch, throttle, publish `message.outbound` per penerima.
- Publish `realtime.event` (pesan baru, status berubah) ke Pub/Sub.

### Next.js Web (`/web`)
- Dashboard + BFF. Pemilik tulis tabel admin: `tenants`, `users`, `contacts`, `channels`, `flows`, `broadcasts`, `tags`.
- Server Actions untuk CRUD; Route Handlers untuk OAuth callback (embedded signup) & integrasi.
- Subscribe WS gateway untuk inbox realtime.
- **Tidak** memproses pesan masuk; itu domain engine.

## Komunikasi antar servis

| Jalur | Mekanisme | Contoh |
|---|---|---|
| Gateway → Engine | Redis Stream `message.inbound` (consumer group) | pesan masuk |
| Engine → Gateway | Redis Stream `message.outbound` | perintah kirim |
| Engine → Web | Redis Pub/Sub `realtime.<tenant>` → WS | pesan baru muncul live |
| Web → Engine | REST internal (`/internal/v1/...`) | trigger broadcast, test flow |
| Semua → DB | Postgres | — |

> KEPUTUSAN: Redis **Streams** (bukan list) untuk inbound/outbound supaya ada consumer group, ack, dan replay. Pub/Sub khusus realtime (boleh hilang, fire-and-forget).

## Idempotensi

- Setiap `InboundMessage` punya `dedup_key = channel_id + provider_message_id`. Engine cek `messages.provider_message_id` unik sebelum proses.
- Outbound punya `idempotency_key`; gateway skip kalau sudah pernah kirim.

## Deploy (acuan)

- 3 servis kontainer terpisah + Postgres + Redis.
- Gateway: stateful-ish (koneksi WA) → jangan auto-scale sembarangan; pakai sticky/sharding per tenant kalau >1 instance.
- Engine & Web: stateless → horizontal scale bebas.
- `docker-compose` untuk dev; tiap servis punya `Dockerfile` sendiri.

> TODO PRODUK: kalau mau hemat ops di awal, official-only channel sebenarnya tidak butuh Go (webhook bisa di engine). Go jadi wajib begitu unofficial whatsmeow masuk. Pertimbangkan launch official dulu (engine handle webhook), tambah Go gateway saat unofficial dirilis.
