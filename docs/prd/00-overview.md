# 00 — Overview

## Visi

ChatCepat = satu inbox untuk semua channel chat bisnis, dengan **balas otomatis cerdas (AI sales agent)**, **broadcast yang patuh aturan**, dan **kolaborasi agen**. Target pasar: UMKM & enterprise Indonesia.

## Scope v1

**Termasuk:**
- Omnichannel inbox: WhatsApp (official + unofficial), Instagram DM, Facebook Messenger, Telegram.
- Auto-reply bertingkat: flow builder → rule keyword → AI agent → handoff.
- AI agent (gaya Halo AI): paham konteks, panggil tool (cek ongkir, buat invoice, cek pembayaran), RAG dari knowledge base, guardrails, takeover manual.
- Kontak + broadcast **compliant** (opt-in wajib).
- Multi-tenant, RBAC 4 role.
- Realtime dashboard (pesan masuk live, status agen).

**Tidak termasuk v1 (backlog):**
- AI Voice (inbound/outbound call).
- Integrasi marketplace (Shopee/Tokopedia chat).
- Pipeline CRM penuh (cukup tag + status percakapan dulu).

## Glossary

| Istilah | Arti |
|---|---|
| Tenant | Satu bisnis pelanggan ChatCepat (punya banyak user) |
| Channel | Satu koneksi ke platform chat (1 nomor WA, 1 akun IG, dst) |
| Conversation | Thread antara satu kontak dan satu tenant pada satu channel |
| Takeover | Agen manusia ambil alih percakapan dari bot |
| Service window | Jendela 24 jam setelah kontak chat terakhir (balasan gratis di WA official) |
| Opt-in | Status persetujuan kontak untuk dihubungi (wajib untuk broadcast) |
| Official channel | WA via Meta Cloud API (aman, berbayar per pesan) |
| Unofficial channel | WA via whatsmeow (gratis, risiko banned) |

## Role (ringkas — detail di `03-rbac.md`)

| Tingkat | Role | Inti |
|---|---|---|
| Platform | **Super Admin** | Kelola semua tenant, paket, billing global |
| Tenant | **Owner/Admin** | Connect channel, kelola user, atur flow, billing tenant |
| Tenant | **Supervisor** | Assign chat, monitoring, laporan |
| Tenant | **Agent** | Handle & balas chat yang di-assign |

## Modul fungsional → file

| Modul | File |
|---|---|
| Arsitektur servis | `01-architecture.md` |
| Data & performa | `02-data-model.md` |
| Hak akses | `03-rbac.md` |
| Channel | `04-channels.md` |
| Alur pesan | `05-message-flow.md` |
| Auto-reply & AI | `06-ai-agent-autoreply.md` |
| Kontak & broadcast | `07-contacts-broadcast.md` |
| Frontend | `08-frontend.md` |
| Kontrak API | `09-api-contracts.md` |

## Non-functional target

- Pesan masuk → tampil di dashboard < 2 dtk (p95).
- Gateway tahan ≥ 500 koneksi WA unofficial per instance.
- Query list (inbox, kontak) < 200 ms (p95) — dijamin lewat index + eager loading (`02`).
- Zero N+1 pada endpoint list mana pun.
