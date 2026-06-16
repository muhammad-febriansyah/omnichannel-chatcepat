# ChatCepat — PRD (Modular)

Omnichannel customer-experience SaaS: balas otomatis + AI sales agent, broadcast compliant, multi-tenant. Channel WhatsApp (official Meta Cloud API **dan** unofficial whatsmeow), Instagram, Facebook, Telegram.

Dokumen ini **dipecah per modul** supaya gampang dibaca Claude Code satu-satu (context window lebih ringan, fokus per fitur). Baca `CLAUDE.md` lebih dulu — itu kontrak konvensi yang berlaku di semua modul.

## Stack

| Layer | Teknologi | Tanggung jawab |
|---|---|---|
| Gateway | **Go** (whatsmeow + webhook receiver) | Semua I/O channel, koneksi WA, WS realtime ke dashboard |
| Engine | **Python** (FastAPI + SQLAlchemy 2.0 async) | Auto-reply, AI agent, persist pesan, state percakapan |
| Web | **Next.js** (App Router, TypeScript) | Dashboard tenant, BFF, CRUD admin |
| UI | **shadcn/ui** + Tailwind | Komponen |
| Notif | **goey-toast** | Toast morphing (di atas Sonner + framer-motion) |
| Data | **PostgreSQL** | Single DB, isolasi multi-tenant via `tenant_id` (row-level) |
| Bus | **Redis** (Streams + Pub/Sub) | Queue inbound/outbound + fan-out realtime |
| Vektor | **pgvector** (extension Postgres) | Knowledge base AI agent (RAG) |

## Urutan baca

| # | File | Isi |
|---|---|---|
| — | `CLAUDE.md` | Konvensi wajib (baca pertama) |
| 00 | `00-overview.md` | Visi, scope, glossary, daftar role |
| 01 | `01-architecture.md` | Batas servis, alur data antar servis, queue, realtime |
| 02 | `02-data-model.md` | Skema, **index**, **eager loading**, multi-tenancy |
| 03 | `03-rbac.md` | Role + matriks permission |
| 04 | `04-channels.md` | Integrasi Meta + whatsmeow, embedded signup, abstraksi channel |
| 05 | `05-message-flow.md` | Alur pesan masuk, state machine percakapan, takeover |
| 06 | `06-ai-agent-autoreply.md` | Flow builder + AI agent (gaya Halo AI) + fallback chain |
| 07 | `07-contacts-broadcast.md` | Kontak compliant, opt-in, broadcast |
| 08 | `08-frontend.md` | Next.js + shadcn/ui + goey-toast, halaman & komponen |
| 09 | `09-api-contracts.md` | Kontrak antar servis, endpoint, schema event queue |
| 10 | `10-repo-structure.md` | Monorepo, docker-compose, Makefile, setup contracts/ |

## Cara pakai di Claude Code

1. Taruh seluruh folder di root repo (mis. `/docs/prd/`).
2. Mulai dari satu modul: `baca docs/prd/CLAUDE.md lalu docs/prd/02-data-model.md, implementasikan migration + model`.
3. Kerjakan per modul, jangan sekaligus — tiap modul sudah dirancang berdiri sendiri dengan dependensi yang disebut eksplisit di header.

## Status

Draft v1. Bagian yang ditandai `> KEPUTUSAN:` adalah pilihan arsitektur yang sudah diambil + alasannya. Bagian `> TODO PRODUK:` butuh keputusan bisnis dari kamu.
