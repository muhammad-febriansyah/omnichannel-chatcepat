# 05 — Message Flow & State Machine

Dependensi: `01`, `02`, `04`. Ini implementasi dari diagram alur yang sudah disepakati.

## Alur pesan masuk (decision pipeline)

Dijalankan engine saat konsumsi `message.inbound`:

```
1. DEDUP        cek messages.provider_message_id — kalau ada, stop (idempoten).
2. RESOLVE      cari/buat contact (by external_id/phone, per tenant+channel).
                cari/buat conversation aktif (uq_conv_open).
3. PERSIST      simpan message (direction=inbound, sender=contact).
                update conversation.last_message_at, unread_count++,
                service_window_expires_at = now + 24h (kalau wa_official).
4. PUBLISH RT   realtime.event → dashboard (pesan baru muncul live).
5. DECIDE       ┌─ handler == 'agent'?  → STOP auto-reply (agen pegang).
                ├─ di tengah flow? (conversation_states ada & belum expired)
                │      → lanjut node berikutnya (06).
                ├─ cocok trigger keyword/welcome?  → mulai flow (06).
                ├─ AI agent aktif?  → jalankan AI agent (06).
                └─ else → fallback: pesan default / handoff ke agen.
6. REPLY        hasil decide → message.outbound (kalau ada balasan).
                simpan message (direction=outbound, sender=bot).
```

> Catatan: langkah 5 = node "Cocokkan balasan" + "Ada agen handle?" di diagram. Urutan cek **takeover dulu** — kalau agen sudah ambil alih, bot diam.

## State machine: `conversations.handler`

```
        ┌──────────────────────────────────────────────┐
        ▼                                                │
   ┌────────┐  agen takeover    ┌────────┐  agen resolve/release
   │  bot   │ ────────────────► │ agent  │ ──────────────────────► idle/resolved
   └────────┘                   └────────┘
        ▲                            │
        │  handback ke bot (opsional)│
        └────────────────────────────┘
```

| handler | Arti | Auto-reply jalan? |
|---|---|---|
| `bot` | Bot/AI yang pegang | Ya |
| `agent` | Agen manusia pegang | **Tidak** |
| `idle` | Belum ada yang pegang (mis. di luar jam kerja) | Tergantung config |

Transisi:
- `bot → agent`: agen klik "Ambil alih" / AI agent eskalasi (handoff). Set `assigned_agent_id`.
- `agent → bot`: agen klik "Kembalikan ke bot" (opsional).
- Auto-resolve: tidak ada aktivitas X jam → `status=resolved`, `handler=idle`.

## State machine: flow percakapan (`conversation_states`)

Saat kontak masuk ke flow (mis. pilih menu), simpan posisi:
```jsonc
{
  "conversation_id": "uuid",
  "flow_id": "uuid",
  "current_node_id": "node_pilih_menu",
  "context": { "menu": "katalog", "nama": "Budi" },
  "expires_at": "2026-06-16T04:00:00Z"  // flow hangus kalau idle terlalu lama
}
```
- Tiap pesan masuk saat state aktif → lanjut dari `current_node_id`.
- State expired → flow direset, balik ke trigger awal.

## Jam kerja & out-of-office

- Tenant set jam kerja per channel (`channels.meta.business_hours`).
- Di luar jam: `handler` default `idle` + balasan auto "di luar jam operasional" (opsional) atau tetap AI agent (config admin).

## Assignment (distribusi ke agen)

- Manual: supervisor assign dari inbox.
- Auto (opsional v1.1): round-robin agen online, atau by tag/channel.
- Saat assign → `realtime.event` ke agen tujuan (toast "percakapan baru").

## Failure & retry

- Outbound gagal (channel down/banned) → `messages.status=failed`, retry dengan backoff (maks 3x). Setelah itu notif admin + tandai conversation perlu perhatian.
- Inbound yang tak bisa diproses (error AI) → tetap tersimpan, fallback ke handoff agen, jangan hilang.

## Realtime event (ke dashboard)

| Event | Trigger | Penerima |
|---|---|---|
| `message.new` | pesan inbound/outbound persisted | semua user tenant yang lihat conv |
| `conversation.updated` | status/handler/assignment berubah | tenant |
| `conversation.assigned` | di-assign ke agen | agen tujuan |
| `channel.status` | channel connect/disconnect/banned | admin |
