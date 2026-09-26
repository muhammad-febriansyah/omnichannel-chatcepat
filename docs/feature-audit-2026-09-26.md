# Audit fitur — 26 September 2026

## Perbaikan

- api.co: sembunyikan pilihan provider, pengajuan WA, template HSM, dan channel terkait dari daftar/pilihan kirim. Panggilan daftar akun/template dinonaktifkan; data historis dipertahankan.
- Auto reply: hilangkan transaksi bertumpuk pada pemeriksaan warmup; ubah URL media lokal menjadi absolut untuk pengiriman.
- Broadcast: validasi channel/isi, serialisasi persiapan penerima, cegah dua dispatcher aktif pada kampanye sama, periksa ulang opt-in dan koneksi sebelum mengirim.
- Inbox/kontak: validasi pesan awal, larang composer berbasis nomor pada channel non-WhatsApp, pertahankan kode negara eksplisit, tolak penugasan agen lintas tenant.
- Flow: hormati status nonaktif saat melanjutkan flow; jalankan fallback saat trigger lain tidak cocok.
- Social automation: target posting eksplisit, selector target komentar tepat, pagination, deduplikasi per pengguna/posting/action, periksa ulang rule/pengaturan sebelum job, dan hitung percobaan hanya ketika pengiriman dicoba.
- Sesi: baca role/status pengguna terkini; tolak pengguna nonaktif dan tenant nonaktif, bukan mempercayai cookie lama.
- Reset password: pengiriman email produksi melalui layanan yang sudah tersedia, token diklaim atomik agar tidak dapat dipakai bersamaan, token tidak ditampilkan pada build produksi.
- Billing: snapshot periode paket, verifikasi signature fail-closed, cocokkan nominal/reference, transaksi dengan lock order dan tenant agar callback paralel tidak menggandakan atau menghilangkan perpanjangan.
- Upload: tolak SVG baru dan tambahkan sandbox CSP/nosniff pada respons file lokal.
- UI: perbaiki error lint state-in-effect/render purity pada composer, banner masa aktif, dan counter landing.

## Bukti pengujian

- Engine: 48 tes lulus, termasuk PostgreSQL terisolasi untuk auto reply, broadcast paralel/opt-out, flow, penugasan agen, serta upgrade/downgrade migrasi 0018 dan 0019.
- Web: 6 tes lulus; callback pembayaran paralel diuji pada PostgreSQL terisolasi. Cakupan lain: nomor internasional, api.co tanpa network, sesi terkini, periode paket, signature tanpa konfigurasi.
- Gateway: `go test ./...` lulus dengan PostgreSQL dan Chrome lokal; fixture DOM Instagram/Facebook tidak mengakses akun asli.
- Lint: nol error, tiga warning tersisa (React Hook Form, TanStack Table, dan directive generated contracts).
- Build produksi dan pemeriksaan TypeScript lulus; warning Next.js tersisa terkait konvensi middleware dan tracing file upload.
- Email reset diuji dengan mock provider, bukan email nyata.

## Batas verifikasi / deployment

Migrasi database aplikasi belum diterapkan. Docker lokal tidak aktif; database sementara hanya dipakai untuk tes. Jalankan migrasi sampai `0019_order_period` sebelum deploy kode ini.

Belum ada pengujian end-to-end memakai akun WhatsApp, Instagram, Facebook, Mailketing, atau pembayaran Duitku asli. Selector sosial tetap perlu smoke test akun uji; perubahan DOM platform dapat memerlukan pembaruan.

Audit ini bukan jaminan semua kemungkinan bug hilang. Ketahanan saat crash di antara penyimpanan database dan publikasi queue (durable outbox), penanganan ulang kegagalan consumer, serta pencabutan seluruh sesi setelah perubahan password belum diperbaiki dalam patch ini. Tombol quick reply native WhatsApp unofficial bukan fitur yang ditambahkan patch ini.
