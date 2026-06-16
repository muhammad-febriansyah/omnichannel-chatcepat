@AGENTS.md

# CLAUDE.md — web (Next.js App Router + TypeScript)

Dashboard + BFF. Baca root `CLAUDE.md` + `docs/prd/08-frontend.md`, `03-rbac.md`.
Stack ter-scaffold resmi: Next 16, React 19, Tailwind v4, shadcn/ui, goey-toast.

## Aturan keras

- **Tidak ada modal untuk CRUD.** Create/edit/delete = halaman terpisah (route sendiri). Konfirmasi hapus = halaman konfirmasi, **bukan** `confirm()`.
- **Tidak ada `alert()`/`confirm()` native.** Semua feedback lewat **goey-toast** (`gooeyToast` dari `@/components/ui/goey-toaster`). Aksi async → `gooeyToast.promise`. Pesan Bahasa Indonesia.
- Komponen UI **hanya** dari shadcn/ui (`npx shadcn@latest add ...`). Jangan bikin primitif dari nol. Font **Poppins** (`--font-poppins`).
- Form: **react-hook-form + Zod**. Pesan validasi **Bahasa Indonesia**.
- Tabel: **shadcn DataTable** (TanStack) — server-side pagination/sort/filter, keyset cursor.
- Tiap tombol aksi punya ikon **lucide-react**.

## Data

- ORM **Drizzle**, skema hasil `npm run db:pull` (introspect dari Alembic — **jangan tulis DDL**). Drizzle hanya select/insert/update.
- Eager loading via relational query (`with: {}`), batasi `columns` relasi besar. Zero N+1.
- **Server Actions** untuk mutasi CRUD admin; Route Handlers untuk webhook/OAuth callback (embedded signup).
- Tenant id selalu dari sesi auth, **tidak pernah** dari input user. Wrapper `db.scoped(tenantId)`.
- Permission cek **server-side** (`can(user, ability)`); UI hide/disable hanya kosmetik.

## Tabel yang ditulis web

`tenants`, `users`, `contacts`, `channels`, `flows`, `broadcasts`, `tags`. (Pesan/percakapan ditulis engine.)

## Realtime

`useRealtime(tenantId)` subscribe WS gateway (`NEXT_PUBLIC_WS_URL`), dispatch ke React Query cache.
Events: `message.new`, `conversation.updated`, `conversation.assigned`, `channel.status` (→ toast admin).
