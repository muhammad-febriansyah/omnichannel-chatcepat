# 07 — Contacts & Broadcast (Compliant)

Dependensi: `02`, `04`. Modul ini sengaja dirancang **anti-spam by design** — aturan kepatuhan ditegakkan di level data, bukan cuma UI.

## Prinsip kepatuhan (non-negotiable)

1. **Tidak ada scraping nomor pihak ketiga.** Sistem tidak menyediakan fitur ambil nomor dari grup WA, follower IG, Google Maps, dsb. (Alasan: pelanggaran ToS WhatsApp → banned, dan pelanggaran UU PDP No.27/2022 → sanksi administratif + pidana, penegakan sudah berjalan.)
2. **Broadcast hanya ke `opt_in_status = opted_in`.** Diblok di query, bukan hanya tombol.
3. **Channel unofficial (whatsmeow): broadcast dibatasi keras** (rate rendah + opt-in wajib), karena paling rawan banned.

## Sumber kontak yang sah (`contacts.opt_in_source`)

| Source | Cara | opt_in default |
|---|---|---|
| `inbound` | Kontak chat duluan → otomatis masuk | `opted_in` (consent implisit via inisiasi) |
| `click_to_chat` | Klik iklan/link wa.me → chat | `opted_in` |
| `qr` | Scan QR → chat | `opted_in` |
| `form` | Isi form opt-in (web/landing) dengan centang persetujuan | `opted_in` |
| `import` | Admin upload CSV kontak **milik tenant sendiri** | `unknown` → wajib verifikasi |

> Import CSV: tenant menyatakan punya consent. Sistem tetap set `unknown` sampai ada interaksi/konfirmasi, dan **opt-out link wajib** ada di broadcast pertama. (Lindungi tenant & ChatCepat.)

## Opt-out

- Balasan kontak berisi kata kunci stop (`STOP`, `BERHENTI`, `UNSUB`) → engine set `opt_in_status = opted_out` otomatis.
- Broadcast template wajib punya cara berhenti.
- Kontak `opted_out` permanen diblok dari broadcast (boleh tetap dibalas kalau dia chat lagi — itu service, bukan broadcast).

## Import kontak (alur)

```
upload CSV → validasi format (E.164, dedup per tenant)
  → preview (berapa valid/duplikat/invalid)
  → konfirmasi → insert contacts (opt_in_source=import, status=unknown)
  → audit_log (siapa import, berapa)
```
- goey-toast `.promise` saat proses upload.
- Dedup pakai `uq_contact_phone (tenant_id, phone)`.

## Broadcast

### Alur
```
1. PILIH AUDIENCE   filter: tags / opt_in_status / channel / atribut.
                    sistem PAKSA tambah opt_in_status='opted_in'.
2. PILIH CHANNEL    official → wajib template approved.
                    unofficial → free text, tapi rate ketat + warning.
3. COMPOSE          isi pesan / pilih template. Snapshot ke body_snapshot.
4. JADWAL           kirim sekarang / scheduled_at.
5. KONFIRMASI       tampil: estimasi penerima, estimasi biaya (official), warning.
6. RUN              buat broadcast_recipients (status=pending).
                    skip otomatis kontak opted_out → status=skipped_optout.
                    worker throttle → message.outbound per penerima.
```

### Worker (engine)
- Ambil batch `broadcast_recipients` status pending (index `idx_bcast_recip`).
- **Throttle**:
  - official: sesuai rate limit Meta + per-user marketing limit.
  - unofficial: jeda acak besar (mis. 8–20 dtk), batas harian rendah, hanya jam wajar.
- Per penerima: publish `message.outbound` (idempotency_key = broadcast_id+contact_id).
- Update status dari delivery receipt (sent/delivered/failed).
- Update `broadcasts.stats`.

### Guard di level data (wajib)
```sql
-- audience query SELALU di-AND dengan ini; tidak bisa di-bypass dari UI
WHERE tenant_id = :tid AND opt_in_status = 'opted_in'
```
Engine menolak broadcast yang audience-nya menyertakan non-opt-in. Validasi ganda: web (UI) + engine (eksekusi).

## Strategi tumbuhkan kontak (pengganti "scraping")

Ditawarkan ke tenant sebagai fitur, semuanya consent-based:
- Generator **link & QR click-to-WhatsApp** (auto opt-in saat kontak chat).
- **Widget chat** untuk website tenant.
- **Form opt-in** (embed) dengan centang persetujuan.
- Import kontak existing milik tenant (dengan disclaimer consent).

> Hasil bisnisnya sama (database kontak tumbuh) tapi tiap nomor masuk dengan izin → aman dari banned & PDP.

## Metrik

- Broadcast: terkirim, delivered, gagal, opt-out rate (warning kalau opt-out tinggi).
- Kontak: total, opted_in, opted_out, growth per source.
