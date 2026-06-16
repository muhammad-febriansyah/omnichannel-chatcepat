# 03 — RBAC (Role & Permission)

Dependensi: `00-overview.md`, `02-data-model.md`.

## Role

`users.role` enum: `super_admin`, `admin`, `supervisor`, `agent`.

- **super_admin** — platform (tenant_id NULL). Lintas tenant.
- **admin** — owner workspace tenant.
- **supervisor** — manajer operasional tenant.
- **agent** — CS tenant.

> KEPUTUSAN: role flat per user (bukan RBAC dinamis penuh) untuk v1. Cukup untuk kebutuhan sekarang; bisa di-upgrade ke permission granular nanti tanpa ubah skema (tambah tabel `role_permissions`).

## Matriks permission

| Ability | super_admin | admin | supervisor | agent |
|---|:--:|:--:|:--:|:--:|
| `tenant.manage` (CRUD tenant, paket, billing global) | ✓ | – | – | – |
| `platform.monitor` (gateway, sistem) | ✓ | – | – | – |
| `channel.connect` (WA official/unofficial, IG/FB/TG) | ✓ | ✓ | – | – |
| `channel.view` | ✓ | ✓ | ✓ | – |
| `flow.manage` (auto-reply, AI agent config) | – | ✓ | – | – |
| `knowledge.manage` (KB AI agent) | – | ✓ | – | – |
| `user.manage` (CRUD user & role tenant) | – | ✓ | – | – |
| `billing.tenant` | – | ✓ | – | – |
| `contact.manage` (CRUD, import, opt-in) | – | ✓ | ✓ | – |
| `contact.view` | – | ✓ | ✓ | ✓ |
| `broadcast.manage` (buat, kirim) | – | ✓ | ✓ | – |
| `conversation.assign` (distribusi ke agen) | – | ✓ | ✓ | – |
| `conversation.view_all` (semua percakapan) | – | ✓ | ✓ | – |
| `conversation.view_assigned` (yang di-assign saja) | – | ✓ | ✓ | ✓ |
| `conversation.takeover` (ambil alih dari bot, balas) | – | ✓ | ✓ | ✓ |
| `report.view` | ✓ | ✓ | ✓ | – |
| `audit.view` | ✓ | ✓ | – | – |

## Penegakan

- **Server-side wajib.** Cek ability di Server Action / Route Handler (Next.js) dan di endpoint internal engine. UI hide/disable hanya kosmetik.
- Helper `can(user, 'broadcast.manage')` map role → set ability (tabel statis di kode).
- **Scope data agen:** `agent` hanya lihat `conversations` di mana `assigned_agent_id = user.id` ATAU `handler = 'bot'` belum di-assign (opsional, tergantung kebijakan tenant). Default: hanya yang di-assign.

> TODO PRODUK: apakah agent boleh lihat antrian percakapan belum di-assign (untuk "claim" sendiri), atau hanya yang sudah didistribusikan supervisor? Default PRD: hanya yang di-assign.

## Channel & role (relevan ke `04`)

- Connect channel = `channel.connect` → admin saja. Embedded signup official maupun scan QR unofficial dua-duanya di balik permission ini.
- Saat banned/disconnect terdeteksi gateway → engine update `channels.status` → notif ke admin (goey-toast + badge), bukan ke agent.

## Audit

Aksi sensitif wajib tulis `audit_logs`: connect/disconnect channel, kirim broadcast, ubah role user, hapus kontak massal, export kontak.
