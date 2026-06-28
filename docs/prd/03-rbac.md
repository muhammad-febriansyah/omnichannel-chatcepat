# 03 — RBAC (Role & Permission)

Dependensi: `00-overview.md`, `02-data-model.md`.

> Model **flat 2 role** sejak migration `0006_roles_2` (sebelumnya 4 role:
> `super_admin/admin/supervisor/agent`). Sumber kebenaran matriks: engine
> `app/rbac.py`; mirror di `web/lib/rbac.ts` — JAGA SINKRON.

## Role

`users.role` enum: `admin`, `client`.

- **admin** — operator platform (`tenant_id` NULL). God-mode: `can()` short-circuit
  `True` untuk ability apa pun. Kelola paket/tenant lintas tenant + bisa impersonasi
  tenant untuk support.
- **client** — akun tenant pelanggan. Akses penuh ke workspace-nya sendiri (dibatasi
  ke `tenant_id` miliknya), tanpa ability khusus platform.

> KEPUTUSAN: role flat per user (bukan RBAC dinamis penuh) untuk v1. Pemisahan
> operasional di dalam tenant (mis. CS vs manajer) ditunda — semua user tenant =
> `client`. Bisa di-upgrade ke permission granular nanti tanpa ubah skema (tambah
> tabel `role_permissions`).

## Matriks permission

`admin` = god-mode → semua ability `True` (kolom admin di bawah mendokumentasikan
ability *platform* eksplisit di `ROLE_ABILITIES`, tapi `can()` mengembalikan `True`
untuk admin apa pun ability-nya).

| Ability | admin | client |
|---|:--:|:--:|
| `tenant.manage` (CRUD tenant, paket, billing global) | ✓ | – |
| `platform.monitor` (gateway, sistem) | ✓ | – |
| `channel.connect` (WA official/unofficial, IG/FB/TG) | ✓ | ✓ |
| `channel.view` | ✓ | ✓ |
| `flow.manage` (auto-reply, AI agent config) | ✓¹ | ✓ |
| `knowledge.manage` (KB AI agent) | ✓¹ | ✓ |
| `product.manage` (katalog produk) | ✓¹ | ✓ |
| `user.manage` (CRUD user tenant) | ✓¹ | ✓ |
| `billing.tenant` | ✓¹ | ✓ |
| `contact.manage` (CRUD, import, opt-in) | ✓¹ | ✓ |
| `contact.view` | ✓¹ | ✓ |
| `broadcast.manage` (buat, kirim) | ✓¹ | ✓ |
| `conversation.assign` (distribusi) | ✓¹ | ✓ |
| `conversation.view_all` (semua percakapan) | ✓¹ | ✓ |
| `conversation.view_assigned` | ✓¹ | ✓ |
| `conversation.takeover` (ambil alih bot, balas) | ✓¹ | ✓ |
| `report.view` | ✓ | ✓ |
| `audit.view` | ✓ | ✓ |

¹ Lewat god-mode `can()`, bukan dari set ability platform eksplisit admin. Berlaku
saat admin mengimpersonasi/menolong tenant.

## Penegakan

- **Server-side wajib.** Cek ability di Server Action / Route Handler (Next.js) dan
  di endpoint internal engine. UI hide/disable hanya kosmetik.
- Helper `can(role, 'broadcast.manage')` map role → set ability (tabel statis di
  kode). `admin` → `True` untuk semua; `client` → cek set ability tenant.
- **Scope data tenant:** `client` melihat seluruh data dalam `tenant_id`-nya sendiri
  (termasuk semua `conversations`). Isolasi lintas-tenant dipaksa otomatis oleh
  tenant scope (`02`), bukan oleh role. Tidak ada lagi penyaringan per-agen di
  level role (role `agent` sudah dihapus).

## Channel & role (relevan ke `04`)

- Connect channel = `channel.connect` → admin & client. Embedded signup official
  maupun scan QR unofficial dua-duanya di balik permission ini.
- Saat banned/disconnect terdeteksi gateway → engine update `channels.status` →
  notif ke pemilik workspace (goey-toast + badge).

## Audit

Aksi sensitif wajib tulis `audit_logs`: connect/disconnect channel, kirim broadcast,
ubah user, hapus kontak massal, export kontak, impersonasi tenant oleh admin.
