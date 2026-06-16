# 08 — Frontend (Next.js + shadcn/ui + goey-toast)

Dependensi: `02`, `03`, `05`. Patuhi konvensi Next.js di `CLAUDE.md`.

## Stack frontend

- Next.js App Router + TypeScript.
- shadcn/ui + Tailwind. Font **Poppins**.
- Data: Drizzle (server) + Server Actions untuk mutasi; React Query untuk data klien yang realtime.
- Form: react-hook-form + Zod (pesan validasi Bahasa Indonesia).
- Tabel: shadcn DataTable (TanStack) server-side.
- Ikon: lucide-react (tiap tombol aksi).
- Notif: **goey-toast**.
- Realtime: WebSocket ke gateway.

## Setup goey-toast

Install (CLI ala shadcn, taruh wrapper di `components/ui/`):
```bash
npx goey-toast@latest init     # menaruh components/ui/goey-toaster.tsx + install deps
# atau manual:
npm install goey-toast framer-motion
```

Mount sekali di root:
```tsx
// app/providers.tsx  (client component)
'use client'
import { GooeyToaster } from 'goey-toast'
import 'goey-toast/styles.css'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GooeyToaster position="bottom-right" />
    </>
  )
}
```

Pemakaian standar (semua feedback lewat sini, **tidak ada `alert`/`confirm`**):
```ts
import { gooeyToast } from 'goey-toast'

// aksi async → selalu .promise
await gooeyToast.promise(connectChannel(id), {
  loading: 'Menghubungkan channel…',
  success: 'Channel terhubung',
  error:   'Gagal menghubungkan channel',
})

gooeyToast.success('Broadcast dijadwalkan')
gooeyToast.error('Audience kosong')
gooeyToast.warning('Channel ini rawan banned untuk broadcast')
gooeyToast.info('Service window kontak ini sudah lewat 24 jam')
```

> Konvensi: setiap Server Action yang mutasi data → klien bungkus dengan `gooeyToast.promise`. Pesan loading/success/error **Bahasa Indonesia**.

## Struktur halaman

```
/login
/(platform)/admin              ← super_admin: daftar tenant, paket, monitoring
/(app)
  /inbox                       ← inbox realtime (utama)
  /inbox/[conversationId]      ← thread + panel kontak + takeover
  /contacts                    ← DataTable kontak
  /contacts/new                ← halaman create (BUKAN modal)
  /contacts/[id]/edit
  /contacts/[id]/delete        ← halaman konfirmasi hapus (BUKAN confirm())
  /contacts/import             ← import CSV
  /broadcasts                  ← list
  /broadcasts/new              ← wizard: audience → channel → compose → jadwal → konfirmasi
  /broadcasts/[id]             ← detail + stats
  /flows                       ← list flow
  /flows/[id]                  ← flow builder (canvas)
  /ai-agent                    ← persona, knowledge base, tools
  /channels                    ← connect/kelola channel
  /channels/connect            ← pilih tipe → embedded signup / QR
  /settings/users              ← kelola user & role (admin)
  /settings/business-hours
  /reports
```

> Konvensi `CLAUDE.md`: CRUD = halaman terpisah, tidak ada modal. Hapus = halaman konfirmasi sendiri.

## Halaman utama: Inbox

Layout 3 kolom:
1. **Daftar percakapan** (kiri) — keyset pagination, filter status/channel/assigned, badge channel (warna per tipe), unread count. Update live via WS (`message.new`, `conversation.updated`).
2. **Thread** (tengah) — pesan, indikator pengirim (contact/bot/agent), status (sent/delivered/read). Auto-scroll. Tampilkan badge **service window** untuk wa_official (sisa waktu / "lewat 24 jam → harus template").
3. **Panel kontak** (kanan) — profil kontak, tags, opt-in status, atribut, riwayat. Tombol **Ambil alih** (takeover → set handler=agent), **Kembalikan ke bot**, **Resolve**, **Assign** (supervisor).

Komponen realtime:
```ts
// useRealtime(tenantId): subscribe WS gateway, dispatch ke React Query cache
// events: message.new, conversation.updated, conversation.assigned, channel.status
// channel.status → gooeyToast pada admin
```

## Komponen shadcn yang dipakai (jangan bikin dari nol)

`Button`, `Input`, `Textarea`, `Select`, `Combobox`, `Dialog` (hanya untuk non-CRUD ringan, bukan form CRUD), `Sheet` (panel kontak mobile), `Tabs`, `Badge`, `Avatar`, `DataTable`, `Card`, `Form` (rhf), `Calendar/DatePicker` (jadwal broadcast), `Switch`, `Tooltip`, `Skeleton` (loading), `Command` (search).

## Broadcast wizard (anti-spam visible)

- Step audience: tampilkan estimasi penerima **setelah** filter opt-in dipaksa. Kalau pilih channel unofficial → banner warning merah (rawan banned).
- Step konfirmasi: tampilkan jumlah opted-out yang **otomatis di-skip**, estimasi biaya (official), tombol kirim pakai `gooeyToast.promise`.

## Flow builder

- Canvas node-edge (react-flow / @xyflow/react). Node sesuai tipe di `06`.
- Simpan ke `flows.definition` (JSON graph). Tombol "Test" jalankan flow ke nomor admin.

## Loading & error

- `Skeleton` untuk list saat fetch.
- Semua error aksi → `gooeyToast.error` dengan pesan jelas Bahasa Indonesia (jangan tampilkan stack/teknis ke user).
- Empty state ramah (mis. inbox kosong: "Belum ada percakapan").

## Aksesibilitas & responsif

- Mobile: inbox jadi single-column (list → thread → panel via Sheet).
- Kontras warna badge cukup; ikon selalu disertai teks/aria-label.
