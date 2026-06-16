# CLAUDE.md — ChatCepat (root)

Konvensi global + peta servis. Baca ini sebelum modul mana pun.
PRD lengkap: `docs/prd/` (mulai dari `docs/prd/CLAUDE.md`, lalu `00`→`10`).

## Peta servis

| Folder | Bahasa | Tanggung jawab |
|---|---|---|
| `gateway/` | Go | Semua I/O channel (whatsmeow, webhook Meta, Telegram), WS realtime |
| `engine/` | Python (FastAPI + SQLAlchemy 2.0 async) | Auto-reply, AI agent, persist pesan, broadcast worker. **Pemilik migration (Alembic = skema kanonik).** |
| `web/` | Next.js (App Router, TS) | Dashboard tenant, BFF, CRUD admin. Drizzle introspect skema. |
| `contracts/` | JSON Schema | **Sumber kebenaran event schema** (`09`). Generate tipe ke 3 bahasa. |

Tiap servis punya `CLAUDE.md` sendiri dengan aturan spesifik.

## Prinsip umum (wajib di semua servis)

- **Multi-tenant row-level.** Single DB. Tiap tabel domain punya `tenant_id` (UUID, NOT NULL, FK `tenants`). Tenant scope wajib otomatis, bukan manual per query. Lihat `docs/prd/02-data-model.md`.
- **Idempoten.** Semua consumer queue + webhook handler idempoten (dedup key). Pesan masuk bisa dobel.
- **Zero N+1.** Endpoint list wajib eager-load relasi yang dirender. `selectinload` koleksi, `joinedload` many-to-one (engine); Drizzle `with: {}` (web).
- **Index komposit selalu diawali `tenant_id`.** Keyset/cursor pagination, bukan OFFSET.
- **Uang = BIGINT** (rupiah penuh, no float).
- **Snapshot data transaksi.** Broadcast/invoice salin nilai, jangan join ke master yang berubah.
- **UTC di DB** (`TIMESTAMPTZ`), konversi WIB hanya di presentasi.

## Skema = satu pemilik

- DDL hanya di `engine/migrations` (Alembic). Tidak ada `CREATE/ALTER TABLE` di luar itu.
- Web `drizzle-kit pull` introspect dari DB. Drizzle hanya select/insert/update.
- Go tidak punya migration domain (cuma whatsmeow `sqlstore`).

## Event schema = satu pemilik

Ubah event = edit `contracts/events.schema.json` → `make contracts` → commit. Jangan ubah tipe event langsung di servis. `contracts/generated/*` di-commit tapi jangan edit manual.

## Yang TIDAK boleh

- Scraping nomor/kontak pihak ketiga tanpa consent. Lihat `docs/prd/07-contacts-broadcast.md`.
- Broadcast ke kontak non-opt-in. Blok di level data, bukan UI.
- Hardcode kredensial channel. Semua di `channels.credentials` (terenkripsi) atau secret manager.

## Penamaan

- Tabel/kolom DB: `snake_case`, plural tabel.
- Endpoint: `kebab-case`, REST, prefix `/v1`.
- Event queue: `domain.action` (`message.inbound`, `message.outbound`, `message.status`).
- TS: `camelCase` var, `PascalCase` tipe. Python: `snake_case`.
