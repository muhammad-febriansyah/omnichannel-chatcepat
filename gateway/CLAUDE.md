# CLAUDE.md — gateway (Go)

Semua I/O channel hidup di sini. Baca root `CLAUDE.md` + `docs/prd/04-channels.md`, `09-api-contracts.md`.

## Aturan

- Stateless kecuali session store whatsmeow (tabel sendiri via `sqlstore`, terpisah dari skema domain).
- **TIDAK menyentuh tabel domain** (conversations/messages). Hanya: terima → normalisasi → publish Redis Stream; konsumsi outbound → kirim. Status pengiriman dipublish sebagai event, engine yang persist.
- Satu goroutine per koneksi WA unofficial. Webhook Meta lewat HTTP handler biasa.
- Graceful reconnect + backoff untuk whatsmeow.
- Throttle outbound unofficial (jeda acak) — rawan banned.
- **Deteksi ban/logout unofficial.** Event `events.PermanentDisconnect` (LoggedOut/TemporaryBan/ConnectFailure/ClientOutdated/StreamReplaced) → lepas sesi (stop kirim) + publish realtime `channel.status`. Durable `channels.status` ditulis web (gateway tak sentuh tabel domain).

## Adapter pattern

`internal/channels/` — satu adapter per `channel.type`. Implement:

```go
type ChannelAdapter interface {
    Send(ctx context.Context, cmd OutboundCommand) (providerMessageID string, err error)
}
```

Inbound di-handle per-adapter (socket event / webhook), dinormalisasi ke `InboundMessage`.

## Struktur

- `cmd/gateway/` — entrypoint.
- `internal/channels/` — adapter: whatsmeow, wa_cloud, ig, fb, telegram.
- `internal/bus/` — Redis Streams (consumer group) + Pub/Sub.
- `internal/ws/` — WebSocket server → dashboard, subscribe `realtime.<tenant>`.
- `internal/contracts/` — tipe event ter-generate (jangan edit; `make contracts`).

## Endpoint (publik)

| Method | Path |
|---|---|
| GET/POST | `/webhooks/meta/wa` `/ig` `/fb` (verify `X-Hub-Signature-256`) |
| POST | `/webhooks/telegram/{channel_id}` |
| POST | `/channels/{id}/connect-unofficial` → balikan QR |
| GET | `/channels/{id}/qr` (SSE sampai paired) |
| WS | `/ws?tenant={id}&token={jwt}` |
