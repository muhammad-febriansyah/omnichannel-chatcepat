# CLAUDE.md — engine (Python, FastAPI + SQLAlchemy 2.0 async)

Otak sistem. Baca root `CLAUDE.md` + `docs/prd/02,05,06,07`.

## Pola wajib

- **Service → Repository.** Route tipis, logika di `services/`, akses DB di `repositories/`.
- **Action** terisolasi untuk operasi domain (mis. `HandleInboundMessage`, `RunBroadcastBatch`) — satu action = satu transaksi.
- Async di mana-mana (`async def`, `AsyncSession`). Jangan campur sync ORM.
- **Eager loading wajib** di `repositories/`: `selectinload()` koleksi, `joinedload()` many-to-one. Dilarang lazy-load dalam loop.
- Validasi I/O pakai **Pydantic v2**.
- **Tenant scope otomatis** — helper `tenant_scoped(stmt, tenant_id)`. Jangan query tabel domain tanpa tenant filter.

## Skema kanonik

- `migrations/` (Alembic) = **satu-satunya pemilik DDL**. Tidak ada `CREATE/ALTER TABLE` di luar sini.
- `models/` SQLAlchemy mengikuti migration.

## Tabel yang ditulis engine

`conversations`, `messages`, `conversation_states`, `broadcast_recipients`. (Tabel admin ditulis web — lihat `01`.)

## Struktur

- `consumers/` — `message.inbound` consumer (group "engine"), broadcast worker.
- `pipeline/` — decision pipeline (`05`): dedup → resolve → persist → publish RT → decide → reply.
- `ai/` — AI agent + RAG (`06`): retrieve pgvector (filter tenant_id dulu), prompt, tools, guardrails.
- `services/`, `repositories/`, `models/`.
- `contracts/` — tipe event ter-generate (jangan edit; `make contracts`).
