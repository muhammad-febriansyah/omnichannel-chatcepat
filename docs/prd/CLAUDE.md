# CLAUDE.md — Konvensi ChatCepat

Baca file ini sebelum modul mana pun. Aturan di sini berlaku global.

## Prinsip umum

- **Multi-tenant, row-level.** Single database. Setiap tabel milik tenant punya kolom `tenant_id` (UUID, NOT NULL, FK ke `tenants`). Tidak ada query lintas tenant kecuali di servis platform (Super Admin).
- **Tenant scope wajib otomatis**, bukan manual per query. Lihat `02-data-model.md`.
- **Idempoten.** Semua consumer queue dan webhook handler harus idempoten (pakai dedup key). Pesan masuk bisa dobel.
- **Uang dalam integer.** Simpan rupiah sebagai `BIGINT` (satuan rupiah penuh, bukan sen — tidak ada pecahan rupiah). Jangan pakai float.
- **Snapshot data transaksi.** Saat broadcast/invoice dibuat, salin nilai (nama template, harga, isi pesan) ke baris transaksi — jangan andalkan join ke master yang bisa berubah.
- **UTC di database, lokal di UI.** Semua timestamp `TIMESTAMPTZ`, disimpan UTC. Konversi ke WIB hanya di layer presentasi.

## Per servis

### Python (engine) — FastAPI + SQLAlchemy 2.0 async
- Pola **Service → Repository**. Route tipis, logika di service, akses DB di repository.
- **Action** terisolasi untuk operasi bermakna domain (mis. `HandleInboundMessage`, `RunBroadcastBatch`) — satu action = satu transaksi.
- Async di mana-mana (`async def`, `AsyncSession`). Jangan campur sync ORM call.
- **Eager loading wajib** untuk relasi yang dipakai: `selectinload()` untuk koleksi, `joinedload()` untuk many-to-one. Dilarang lazy-load di dalam loop. Lihat `02-data-model.md`.
- Validasi I/O pakai **Pydantic v2**.

### Go (gateway) — whatsmeow + net/http
- Stateless kecuali session store whatsmeow (tabel sendiri via `sqlstore`).
- Tidak menyentuh tabel domain (conversations/messages). Hanya: terima → normalisasi → publish ke Redis; konsumsi outbound → kirim.
- Satu goroutine per koneksi WA unofficial; webhook Meta lewat HTTP handler biasa.
- Graceful reconnect + backoff untuk whatsmeow.

### Next.js (web) — App Router + TypeScript
- ORM **Drizzle** (introspect skema kanonik dari Alembic — lihat `02-data-model.md`).
- Eager loading via relational query Drizzle (`with: {...}`), bukan query bertingkat manual.
- **Server Actions** untuk mutasi CRUD admin; Route Handlers untuk webhook/integrasi.
- **Tidak ada modal** untuk CRUD. Create/edit/delete = halaman terpisah (route sendiri). Konfirmasi hapus = halaman konfirmasi terpisah, bukan `confirm()`.
- **Tidak ada `alert()`/`confirm()` native.** Semua feedback lewat **goey-toast**.
- Form: **react-hook-form + Zod**. Pesan validasi **Bahasa Indonesia**.
- Tabel: **shadcn DataTable** (TanStack Table) — server-side pagination/sort/filter.
- Setiap tombol aksi punya ikon **lucide-react**.
- Font **Poppins**.
- Komponen UI **hanya** dari shadcn/ui; jangan bikin komponen primitif dari nol kalau shadcn sudah punya.

## Notifikasi (goey-toast)

```ts
// app/providers.tsx — mount sekali
import { GooeyToaster } from 'goey-toast'
import 'goey-toast/styles.css'
// <GooeyToaster position="bottom-right" />

// pemakaian
import { gooeyToast } from 'goey-toast'
gooeyToast.success('Kontak tersimpan')
gooeyToast.error('Gagal mengirim broadcast')
gooeyToast.promise(saveContact(), {
  loading: 'Menyimpan…',
  success: 'Tersimpan',
  error: 'Gagal menyimpan',
})
```
- Peer deps: `react`, `react-dom`, `framer-motion`. Wajib `import 'goey-toast/styles.css'` sekali di entry.
- `gooeyToast.promise` dipakai untuk semua aksi async (simpan, kirim, connect channel) — kasih feedback loading → success/error otomatis.

## Penamaan

- Tabel & kolom DB: `snake_case`, plural untuk tabel.
- Endpoint: `kebab-case`, REST. Versi di prefix `/v1`.
- Event queue: `domain.action` (mis. `message.inbound`, `message.outbound`, `broadcast.batch`).
- TS: `camelCase` var, `PascalCase` tipe/komponen. Python: `snake_case`.

## Yang TIDAK boleh

- Scraping nomor / kontak pihak ketiga tanpa consent. Modul kontak hanya menerima: import milik tenant, opt-in form, click-to-WA, QR. Lihat `07-contacts-broadcast.md`.
- Broadcast ke kontak non-opt-in. Sistem harus memblok di level data, bukan sekadar UI.
- Hardcode kredensial channel. Semua di `channels` table (terenkripsi) atau secret manager.
