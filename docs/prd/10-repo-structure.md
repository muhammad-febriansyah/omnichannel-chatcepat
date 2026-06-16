# 10 — Repo Structure & Scaffolding

Dependensi: `01-architecture.md`, `09-api-contracts.md`. Acuan struktur monorepo + tooling dev.

> KEPUTUSAN: **monorepo**, satu folder, tiga servis dengan toolchain terisolasi. Alasan: servis terikat lewat kontrak event (`09`) → perubahan schema = commit atomic lintas servis; Claude Code bisa lihat seluruh sistem; solo/tim kecil = overhead polyrepo tak terbayar. Polyrepo hanya dipertimbangkan kalau ada tim terpisah per servis.

## Struktur folder

```
chatcepat/
├── CLAUDE.md                    # konvensi global + peta servis (root)
├── docker-compose.yml          # postgres + redis + 3 servis, sekali jalan
├── Makefile                    # task dev (up, migrate, contracts, ...)
├── .env.example                # template env semua servis
├── .github/workflows/ci.yml    # CI dengan path-filter
│
├── docs/
│   └── prd/                     # PRD modular (00–10 + CLAUDE.md)
│
├── contracts/                   # ★ SUMBER KEBENARAN event schema (09)
│   ├── events.schema.json       # JSON Schema: inbound/outbound/status/realtime
│   └── generated/               # output generator (jangan edit manual)
│       ├── python/              # → engine/app/contracts (symlink/copy)
│       ├── typescript/
│       └── go/
│
├── gateway/                     # GO
│   ├── go.mod
│   ├── Dockerfile
│   ├── CLAUDE.md
│   ├── cmd/gateway/main.go
│   └── internal/
│       ├── channels/            # adapter: whatsmeow, wa_cloud, ig, fb, telegram
│       ├── bus/                 # redis streams + pubsub
│       ├── ws/                  # websocket server → dashboard
│       └── contracts/           # tipe ter-generate (dari contracts/)
│
├── engine/                      # PYTHON
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── CLAUDE.md
│   ├── alembic.ini
│   ├── migrations/              # ★ Alembic = skema kanonik (02)
│   └── app/
│       ├── main.py              # FastAPI
│       ├── consumers/           # message.inbound, broadcast worker
│       ├── pipeline/            # decision pipeline (05)
│       ├── ai/                  # AI agent + RAG (06)
│       ├── services/            # business logic
│       ├── repositories/        # akses DB (eager loading di sini)
│       ├── models/              # SQLAlchemy
│       └── contracts/           # tipe ter-generate
│
└── web/                         # NEXT.JS
    ├── package.json
    ├── Dockerfile
    ├── CLAUDE.md
    ├── drizzle.config.ts        # introspect dari DB (02)
    └── lib/
        ├── db/                  # drizzle schema (hasil introspect) + relations
        └── contracts/           # tipe ter-generate
```

Prinsip:
- Tiap servis punya manifest dependensi & Dockerfile sendiri → bukan "3 bahasa diaduk", tapi 3 servis bersih satu atap.
- `contracts/generated/*` di-commit (biar build gak butuh generator), tapi **jangan diedit manual** — selalu regenerate dari `events.schema.json`.
- Migration cuma di `engine/migrations` (Alembic). Web introspect, Go tak punya migration domain.

## contracts/ — satu schema, tiga bahasa

`contracts/events.schema.json` = JSON Schema untuk semua event di `09` (`InboundMessage`, `OutboundCommand`, `MessageStatus`, `RealtimeEvent`). Generate tipe per bahasa:

| Bahasa | Tool | Output |
|---|---|---|
| Python (Pydantic v2) | `datamodel-code-generator` | `engine/app/contracts/events.py` |
| TypeScript | `json-schema-to-typescript` (`json2ts`) | `web/lib/contracts/events.ts` |
| Go | `go-jsonschema` (omissis) | `gateway/internal/contracts/events.go` |

Perintah (lihat target `make contracts`):
```bash
# Python → Pydantic v2
datamodel-codegen \
  --input contracts/events.schema.json --input-file-type jsonschema \
  --output-model-type pydantic_v2.BaseModel \
  --output engine/app/contracts/events.py

# TypeScript
npx json-schema-to-typescript contracts/events.schema.json \
  -o web/lib/contracts/events.ts

# Go
go-jsonschema -p contracts contracts/events.schema.json \
  > gateway/internal/contracts/events.go
```
> Alternatif satu tool untuk ketiganya: **quicktype** (`quicktype -l python|typescript|go ...`). Pakai kalau mau seragam; tool spesifik di atas hasilnya lebih idiomatik per bahasa.

Aturan: ubah event = edit `events.schema.json` → `make contracts` → commit. Jangan pernah ubah tipe event langsung di servis.

## docker-compose.yml

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: chatcepat
      POSTGRES_PASSWORD: chatcepat
      POSTGRES_DB: chatcepat
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatcepat"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  engine:
    build: ./engine
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    ports: ["8000:8000"]
    volumes: ["./engine:/app"]          # hot reload dev
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  gateway:
    build: ./gateway
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    ports: ["8080:8080"]               # webhook + WS

  web:
    build: ./web
    env_file: .env
    depends_on: [engine]
    ports: ["3000:3000"]
    volumes: ["./web:/app", "/app/node_modules"]
    command: "npm run dev"

volumes:
  pgdata:
```

> Catatan: `engine` yang jalankan `alembic upgrade head` saat start = single owner migration. Gateway/web tunggu DB ready, tidak migrate.

## Makefile

```makefile
.PHONY: up down dev logs migrate makemigration contracts seed fmt

up:                ## nyalakan semua servis
	docker compose up -d

down:
	docker compose down

dev:               ## up + ikuti log
	docker compose up

logs:
	docker compose logs -f

migrate:           ## jalankan migration (Alembic)
	docker compose exec engine alembic upgrade head

makemigration:     ## buat migration baru: make makemigration m="add contacts"
	docker compose exec engine alembic revision --autogenerate -m "$(m)"

contracts:         ## generate tipe event ke 3 bahasa dari events.schema.json
	datamodel-codegen --input contracts/events.schema.json --input-file-type jsonschema \
	  --output-model-type pydantic_v2.BaseModel --output engine/app/contracts/events.py
	npx json-schema-to-typescript contracts/events.schema.json -o web/lib/contracts/events.ts
	go-jsonschema -p contracts contracts/events.schema.json > gateway/internal/contracts/events.go

introspect:        ## sinkron skema Drizzle dari DB (setelah migrate)
	docker compose exec web npx drizzle-kit pull

seed:
	docker compose exec engine python -m app.seed

fmt:               ## format semua servis
	docker compose exec engine ruff format .
	docker compose exec web npm run format
	cd gateway && gofmt -w .
```

## .env.example

```dotenv
# shared
DATABASE_URL=postgresql+asyncpg://chatcepat:chatcepat@postgres:5432/chatcepat
DATABASE_URL_SYNC=postgresql://chatcepat:chatcepat@postgres:5432/chatcepat   # alembic
REDIS_URL=redis://redis:6379/0
SERVICE_TOKEN=change-me                     # auth antar servis (09)

# engine
LLM_PROVIDER=                               # TODO PRODUK (06)
LLM_API_KEY=
EMBEDDING_MODEL=

# gateway
META_APP_SECRET=                            # verifikasi webhook (04)
META_VERIFY_TOKEN=
WS_JWT_SECRET=

# web
NEXTAUTH_SECRET=
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
ENGINE_INTERNAL_URL=http://engine:8000/internal/v1
```

## CI (path-filter)

`.github/workflows/ci.yml` — hanya build/test servis yang berubah:
```yaml
# pakai dorny/paths-filter untuk deteksi perubahan per folder
# - gateway/**  → go test ./...
# - engine/**   → pytest + ruff
# - web/**      → npm test + lint + tsc
# - contracts/**→ regenerate + cek diff (gagal kalau lupa make contracts)
```
> Tambahkan job yang jalankan `make contracts` lalu `git diff --exit-code` — biar PR yang ubah schema tapi lupa regenerate langsung ketahuan.

## Dev workflow (alur harian)

```
git clone → cp .env.example .env → make up
make migrate            # skema awal
make contracts          # tipe event
make introspect         # drizzle sync
# kerja per servis; Claude Code baca CLAUDE.md root + per-folder
```

## CLAUDE.md bertingkat

- Root `CLAUDE.md` (sudah ada) = konvensi global + peta servis.
- `gateway/CLAUDE.md`, `engine/CLAUDE.md`, `web/CLAUDE.md` = aturan spesifik servis (pola Service-Repository di engine, no-modal/goey-toast di web, adapter pattern di gateway). Claude Code otomatis baca yang relevan dengan folder yang dikerjakan.
