# 02 — Data Model, Index & Eager Loading

Dependensi: `01-architecture.md`. Ini file paling kritikal untuk performa.

## Sumber kebenaran skema

> KEPUTUSAN: skema kanonik dipegang **satu** tempat: migration **Alembic** di engine (`/engine/migrations`). Next.js **introspect** skema itu via `drizzle-kit pull` → tipe Drizzle ter-generate. Go tidak punya migration domain (cuma whatsmeow sqlstore). Alasan: satu pemilik DDL mencegah drift; dua ORM menulis DDL = bencana.

Aturan: tidak ada `CREATE/ALTER TABLE` di luar Alembic. Drizzle hanya `select/insert/update`.

## Multi-tenancy (row-level)

Semua tabel domain punya `tenant_id UUID NOT NULL REFERENCES tenants(id)`.

- **Python:** scope otomatis lewat session event / query helper `tenant_scoped(stmt, tenant_id)` yang menambah `WHERE tenant_id = :tid`. Jangan pernah query tabel domain tanpa tenant filter.
- **Next.js:** wrapper `db.scoped(tenantId)` yang inject kondisi sama. Tenant id diambil dari sesi auth, tidak pernah dari input user.
- Pertimbangkan Postgres **RLS policy** sebagai jaring pengaman lapis kedua (set `app.tenant_id` per koneksi). Opsional tapi disarankan untuk enterprise.

## Tabel inti

Ringkas — tipe & kolom utama. (PK semua `id UUID DEFAULT gen_random_uuid()`, plus `created_at`, `updated_at TIMESTAMPTZ`.)

### tenants
`name`, `slug` (unik), `plan` (enum: pro/business/enterprise), `status`, `settings JSONB`.

### users
`tenant_id` (nullable — Super Admin punya NULL), `name`, `email` (unik global), `password_hash`, `role` (enum, lihat `03`), `status`, `last_active_at`.

### channels
`tenant_id`, `type` (enum: `wa_official`, `wa_unofficial`, `instagram`, `facebook`, `telegram`), `name`, `status` (enum: `connected`/`disconnected`/`pending`/`banned`), `credentials JSONB` (terenkripsi — token, phone_number_id, waba_id, dst), `external_id` (phone number id / page id / bot id), `meta JSONB`.

### contacts
`tenant_id`, `phone` (E.164, nullable untuk IG/FB), `external_id` (psid/ig id), `name`, `opt_in_status` (enum: `opted_in`/`opted_out`/`unknown`), `opt_in_source` (enum: `import`/`form`/`click_to_chat`/`qr`/`inbound`), `opt_in_at`, `tags TEXT[]`, `attributes JSONB`, `last_contacted_at`.

### conversations
`tenant_id`, `channel_id`, `contact_id`, `status` (enum: `open`/`pending`/`resolved`/`snoozed`), `handler` (enum: `bot`/`agent`/`idle`), `assigned_agent_id` (nullable FK users), `last_message_at`, `last_message_preview`, `unread_count`, `service_window_expires_at` (nullable, untuk WA official).

### messages
`tenant_id`, `conversation_id`, `direction` (enum: `inbound`/`outbound`), `sender` (enum: `contact`/`bot`/`agent`/`system`), `agent_id` (nullable), `type` (enum: `text`/`image`/`file`/`template`/`interactive`), `body TEXT`, `media JSONB`, `provider_message_id` (unik per channel), `status` (enum: `queued`/`sent`/`delivered`/`read`/`failed`), `idempotency_key`, `created_at`.

### conversation_states
State machine flow per percakapan. `conversation_id` (unik), `flow_id` (nullable), `current_node_id`, `context JSONB` (variabel kumpulan jawaban), `expires_at`.

### flows
`tenant_id`, `name`, `status` (draft/active), `trigger` (enum: `keyword`/`welcome`/`fallback`), `definition JSONB` (graph node+edge — lihat `06`), `version`.

### knowledge_documents  (AI agent RAG)
`tenant_id`, `source_type` (file/url/faq/manual), `title`, `status` (processing/ready), `meta JSONB`.

### knowledge_chunks
`tenant_id`, `document_id`, `content TEXT`, `embedding vector(1536)` (pgvector), `token_count`.

### broadcasts
`tenant_id`, `channel_id`, `name`, `template_id` (nullable, untuk official), `body_snapshot TEXT`, `status` (enum: `draft`/`scheduled`/`running`/`done`/`failed`), `scheduled_at`, `audience_filter JSONB`, `stats JSONB` (total/sent/failed). Snapshot isi pesan saat dibuat (jangan join ke template yang bisa berubah).

### broadcast_recipients
`tenant_id`, `broadcast_id`, `contact_id`, `status` (enum: `pending`/`sent`/`delivered`/`failed`/`skipped_optout`), `message_id` (nullable), `error`.

### tags
`tenant_id`, `name`, `color`. (Kontak pakai array `tags`; tabel ini untuk master + warna.)

### audit_logs
`tenant_id`, `actor_id`, `action`, `entity`, `entity_id`, `diff JSONB`, `created_at`. (Untuk jejak: siapa connect channel, kirim broadcast, dll.)

## INDEX — wajib

Buat di migration. Komposit selalu **diawali `tenant_id`** karena semua query difilter tenant.

```sql
-- conversations: inbox list (paling sering, urut terbaru)
CREATE INDEX idx_conv_inbox        ON conversations (tenant_id, status, last_message_at DESC);
CREATE INDEX idx_conv_assigned     ON conversations (tenant_id, assigned_agent_id, last_message_at DESC);
CREATE INDEX idx_conv_channel      ON conversations (tenant_id, channel_id);
CREATE UNIQUE INDEX uq_conv_open   ON conversations (channel_id, contact_id) WHERE status != 'resolved';

-- messages: ambil thread + cek dedup
CREATE INDEX idx_msg_thread        ON messages (conversation_id, created_at DESC);
CREATE UNIQUE INDEX uq_msg_provider ON messages (channel_id, provider_message_id);
CREATE INDEX idx_msg_status        ON messages (tenant_id, status) WHERE status IN ('queued','failed');

-- contacts: list + filter opt-in + cari nomor
CREATE UNIQUE INDEX uq_contact_phone ON contacts (tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contact_optin     ON contacts (tenant_id, opt_in_status);
CREATE INDEX idx_contact_tags      ON contacts USING GIN (tags);
CREATE INDEX idx_contact_attrs     ON contacts USING GIN (attributes);

-- channels
CREATE INDEX idx_channel_lookup    ON channels (tenant_id, type, status);

-- broadcast
CREATE INDEX idx_bcast_sched       ON broadcasts (tenant_id, status, scheduled_at);
CREATE INDEX idx_bcast_recip       ON broadcast_recipients (broadcast_id, status);

-- conversation_states (lookup cepat saat pesan masuk)
CREATE UNIQUE INDEX uq_state_conv  ON conversation_states (conversation_id);

-- RAG: index pgvector
CREATE INDEX idx_kchunk_vec ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kchunk_tenant ON knowledge_chunks (tenant_id, document_id);

-- audit
CREATE INDEX idx_audit ON audit_logs (tenant_id, created_at DESC);
```

Catatan:
- `channel_id` di `uq_msg_provider` dan `uq_conv_open` perlu kolom `channel_id` ikut tersimpan di tabel terkait (tambahkan jika belum).
- `ivfflat` perlu `ANALYZE` setelah data masuk; untuk dataset kecil boleh tanpa index (seq scan cukup).

## EAGER LOADING — wajib (anti N+1)

Aturan keras: **tidak ada lazy-load di dalam loop**. Endpoint list apa pun harus eager-load semua relasi yang dirender.

### Python (SQLAlchemy 2.0 async)

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

# Inbox: conversations + contact (many-to-one) + channel + last agent
stmt = (
    select(Conversation)
    .where(Conversation.tenant_id == tid, Conversation.status == "open")
    .options(
        joinedload(Conversation.contact),       # many-to-one → JOIN
        joinedload(Conversation.channel),        # many-to-one → JOIN
        joinedload(Conversation.assigned_agent), # many-to-one → JOIN
    )
    .order_by(Conversation.last_message_at.desc())
    .limit(30)
)

# Thread: messages koleksi → selectinload (hindari row blow-up dari JOIN)
stmt = (
    select(Conversation)
    .where(Conversation.id == conv_id)
    .options(selectinload(Conversation.messages))
)
```

Pedoman:
- **many-to-one / one-to-one → `joinedload`** (satu JOIN, hemat).
- **one-to-many / many-to-many → `selectinload`** (query terpisah `IN (...)`, hindari ledakan baris & duplikasi).
- Jangan campur `joinedload` ke koleksi besar — bikin baris berlipat.

### Next.js (Drizzle relational query)

```ts
// Inbox dengan relasi tereager dalam satu panggilan
const inbox = await db.query.conversations.findMany({
  where: and(eq(conversations.tenantId, tid), eq(conversations.status, 'open')),
  with: {
    contact: true,
    channel: { columns: { id: true, type: true, name: true } },
    assignedAgent: { columns: { id: true, name: true } },
  },
  orderBy: [desc(conversations.lastMessageAt)],
  limit: 30,
})
```
- Definisikan `relations()` Drizzle untuk semua FK supaya `with` bisa dipakai.
- Untuk list, **selalu** batasi `columns` relasi yang besar; jangan tarik `messages` penuh di list inbox.

## Pagination

- **Keyset/cursor**, bukan OFFSET, untuk list besar (inbox, kontak, pesan). Cursor = `(last_message_at, id)`.
- shadcn DataTable dikonfigurasi server-side; kirim cursor lewat query param.

## Aturan query (checklist Claude Code)

- [ ] Setiap query tabel domain difilter `tenant_id`.
- [ ] Setiap endpoint list eager-load relasi yang dirender (zero N+1).
- [ ] List pakai keyset pagination + index yang sesuai.
- [ ] Tidak ada `SELECT *` untuk relasi besar — pilih kolom.
- [ ] Filter yang sering (status, opt_in, assigned_agent) punya index komposit diawali `tenant_id`.
