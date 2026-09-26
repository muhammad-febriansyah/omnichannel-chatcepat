# ChatCepat Omnichannel

Omnichannel Social Media foundation untuk Instagram, Facebook, dan WhatsApp dengan Go gateway, Next.js dashboard, PostgreSQL, Redis, Asynq, dan SSE.

Stack ini ditambahkan ke path existing repository:

- `gateway/` — Go API, channel abstraction, mock/unofficial driver boundaries, guarded browser automation provider untuk Instagram/Facebook, health/rate/circuit guard, Asynq task client, SSE.
- `web/` — Next.js App Router + TypeScript + Tailwind + shadcn/ui. Console development ada di `/omnichannel`.
- `engine/migrations/versions/0012_omnichannel.py` — schema omnichannel, mengikuti aturan repository bahwa Alembic adalah pemilik DDL.
- `docker-compose.yml` — PostgreSQL, Redis, engine migration/API existing, Go gateway, Asynq worker, dan Next.js.

## Quick start

```bash
cp .env.example .env
# ganti SESSION_ENCRYPTION_KEY dengan nilai dari: openssl rand -hex 32
docker compose up -d
docker compose exec engine python -m app.seed
```

Buka:

- Dashboard existing: `http://localhost:3000`
- Omnichannel Console: `http://localhost:3000/omnichannel`
- Go API health: `http://localhost:8080/healthz`

Console dapat memakai workspace pertama hasil seed. Untuk workspace spesifik, simpan UUID tenant pada menu Settings atau kirim header `X-Workspace-ID`.

## End-to-end mock flow

1. Buka `/omnichannel` → Channels → Connect Instagram atau Facebook. Driver default Instagram adalah `mock`; Facebook development memakai boundary `unofficial` tetapi flow lokal tetap memakai `mock` agar tidak menghubungi provider.
2. Buka Automations → Create starter rule. Rule aktif untuk komentar yang mengandung `mau`.
3. Dari card channel, klik `Simulate 50 comments`.
4. Mock events masuk ke API, disimpan sebagai comments + contacts, dinormalisasi menjadi `comment.created`, lalu masuk ke Asynq.
5. `backend-worker` mengevaluasi rule dan menyimpan automation/action runs.
6. Comments, Contacts, Activity, Dashboard, dan Pending Actions diperbarui melalui SSE.

CLI equivalent:

```bash
# connect, ambil id dari response
curl -X POST http://localhost:8080/api/channels/instagram/connect \
  -H 'Content-Type: application/json' \
  -d '{"name":"Instagram development","username":"demo_account","driver":"mock"}'

curl -X POST http://localhost:8080/api/dev/instagram/mock-comments \
  -H 'Content-Type: application/json' \
  -d '{"connection_id":"<connection-id>","post_id":"post-001","count":50}'
```

`external_comment_id` adalah dedup key per connection. Mengirim event yang sama lagi tidak membuat comment, contact identity, atau automation run baru.

## API surface

API utama berada di `/api`:

- `POST /auth/register`, `POST /auth/login`, `GET /me`
- `GET /dashboard`, `GET /events`
- `GET /channels`, `POST /channels/instagram/connect`, `POST /channels/facebook/connect`
- `POST /channels/:id/reconnect`, `/pause`, `/resume`; `DELETE /channels/:id`; `GET /channels/:id/health`
- `GET /comments`, `GET /contacts`, `GET /contacts/:id`
- `GET/POST /automations`, `GET/PUT/DELETE /automations/:id`, `POST /automations/:id/activate`, `/deactivate`
- `GET /pending-actions`, `POST /pending-actions/:id/approve`, `/reject`
- `GET/POST /settings/automation` untuk global Instagram kill switch
- `POST /dev/instagram/mock-comment`, `POST /dev/instagram/mock-comments`
- `POST /dev/facebook/mock-comment`, `POST /dev/facebook/mock-comments`

Workspace scope berasal dari `X-Workspace-ID`, query `workspace_id`, `DEFAULT_WORKSPACE_ID`, atau tenant pertama di development. Production sebaiknya selalu memaksa scope dari session/auth middleware.

## Channel architecture

Core business logic hanya mengenal interface `internal/channel.Channel`:

```text
API / external event
        ↓
normalize + persist
        ↓
automation engine
        ↓
Asynq (Redis)
        ↓
worker: health → kill switch → circuit breaker → rate limiter
        ↓
channel.Channel
        ↓
adapter
```

Instagram driver factory:

- `INSTAGRAM_DRIVER=mock` — runnable dan tidak menghubungi Instagram.
- `INSTAGRAM_DRIVER=unofficial` — boundary terisolasi, provider belum dikonfigurasi. Tidak ada scraping, stealth browser, CAPTCHA/checkpoint/challenge bypass, fingerprint spoofing, proxy rotation, cookie stealing, atau mass engagement.
Official adapter Instagram disimpan sebagai placeholder internal, tetapi belum diregistrasikan di factory dan tidak bisa dipilih dari API. Saat siap nanti, cukup aktifkan kembali satu case factory; database, automation rules, action runs, queue, contacts, comments, dashboard, dan SSE tetap generic.

Facebook driver factory:

- `FACEBOOK_DRIVER=mock` — development tanpa koneksi eksternal.
- `FACEBOOK_DRIVER=unofficial` — boundary terisolasi dan aman, tetapi provider belum dikonfigurasi karena tidak ada endpoint/library yang boleh ditebak atau di-hardcode.
Facebook unofficial tidak berisi stealth automation, CAPTCHA/checkpoint/challenge bypass, fingerprint spoofing, proxy rotation, cookie stealing, atau mekanisme untuk menghindari deteksi/blokir. Jika provider resmi belum siap, gunakan mock.
Official adapter Facebook juga disimpan sebagai placeholder internal dan sengaja disembunyikan sampai provider resmi siap.

## Safety and account health

`channel_connections.status` mendukung:

`connected`, `disconnected`, `healthy`, `needs_attention`, `challenge_required`, `session_expired`, `rate_limited`, `disabled`, `error`.

Worker outbound hanya jalan saat `healthy`. Challenge, checkpoint, login verification, 2FA, session expired, rate limit, atau account error menghentikan automation. Admin harus menyelesaikan verifikasi manual lalu reconnect/resume.

Circuit breaker per account:

- default 3 consecutive failures → `needs_attention`
- default pause 30 menit
- env: `INSTAGRAM_FAILURE_THRESHOLD`, `INSTAGRAM_CIRCUIT_BREAKER_MINUTES`

Rate limiter per account memakai Redis key `rate:{channel}:{connection_id}` dan pacing key `pace:{channel}:{connection_id}`:

- default development 5 request/menit
- default minimum interval 5 detik antar outbound action pada account yang sama
- account berbeda memiliki bucket dan interval berbeda; worker tidak menggabungkan slot antar account
- env Instagram: `INSTAGRAM_REQUESTS_PER_MINUTE`, `INSTAGRAM_ACTION_INTERVAL_SECONDS`
- env Facebook: `FACEBOOK_REQUESTS_PER_MINUTE`, `FACEBOOK_ACTION_INTERVAL_SECONDS`
- pacing dilakukan sebagai operational safety, bukan jaminan bebas blokir
- response rate limit/temporary block → status `rate_limited` dan worker berhenti sementara

Global kill switch ada di Settings dan disimpan di `tenants.settings.pause_all_instagram_automations`.

## Encryption and credentials

`credentials_encrypted` dan `session_data_encrypted` memakai AES-256-GCM melalui `internal/cryptography.SessionCipher`. Key berasal dari `SESSION_ENCRYPTION_KEY` dan tidak pernah ditulis ke log atau frontend.

Frontend tidak menyimpan password. Password (bila kelak provider login memerlukannya) hanya boleh diterima backend untuk satu request, dipakai oleh `InstagramSessionProvider`, lalu dibuang. Session opaque disimpan terenkripsi. Jangan menyimpan password, cookie, token, atau session plaintext.

## Queue and realtime

Asynq task saat ini:

- `automation:process`

Payload selalu membawa `task_id`, `workspace_id`, `connection_id`, `action`, `payload`, `created_at`. `channel_action_runs.idempotency_key` unique dan dibentuk dari automation run + action + comment.

Redis Streams dan WS gateway lama tetap tersedia untuk flow existing. Omnichannel dashboard menggunakan Redis Pub/Sub + SSE `/api/events` dengan event seperti `comment.created`, `automation.started`, `automation.success`, `automation.failed`, `pending_action.created`, dan activity/status events.

## Testing

```bash
cd gateway
go test ./...

cd ../web
npm run build
```

Test simulator 50 comment adalah endpoint development, bukan fitur mass engagement: 50 user berbeda (`user001`–`user050`) dibuat sebagai incoming comments. Tidak ada 50 akun Instagram dan tidak ada outbound fan-out default.

## Social browser automation (MVP bertahap)

Foundation browser automation berada di `gateway/`, bukan membuat servis backend baru:

- `gateway/internal/browser` — persistent Chromium profiles, per-account lock, dan lifecycle Rod.
- `gateway/internal/social` — repository, Gin API, account/job state machine, rule matcher, idempotency, health guard, activity log, dan Redis enqueue.
- `gateway/internal/social/instagram` dan `gateway/internal/social/facebook` — selector/provider terpisah untuk session check, scanner, reply comment, private reply, dan reply message.
- `gateway/cmd/scanner` — scanner worker konservatif yang hanya menyimpan incoming event; tidak langsung mengirim balasan.
- `gateway/cmd/worker` — action worker Asynq terpisah untuk social jobs.
- `engine/migrations/versions/0014_social_automation.py` — DDL account/job foundation.
- `engine/migrations/versions/0016_social_automation_rules.py` — DDL rules, keywords, incoming events, dedupe action, settings, health fields, dan relasi job.

Endpoint foundation memakai prefix `/api` dan membutuhkan `X-Workspace-ID` (development boleh fallback ke tenant pertama). Di luar development, set `SOCIAL_API_TOKEN` dan kirim `Authorization: Bearer <token>`.

Flow connect: `POST /api/accounts/:id/connect` membuka Chromium untuk login manual, lalu `POST /api/accounts/:id/validate-session` memeriksa session dan mengubah status menjadi `connected`. Username, password, OTP, dan 2FA tidak pernah diisi otomatis.

Dashboard `/automation` menyediakan Rules, Incoming, Activity, dan Settings. Automation default OFF per account. Rule mendukung keyword `exact`, `contains`, `starts_with`, beberapa action berurutan (`reply_comment`, `send_private_reply`, `reply_message`), response variation, ignore keyword, duplicate protection, self-event guard, cooldown, dan account health pause.

Scanner/action berjalan melalui queue `social:scanner` dan `social:jobs`. Private reply hanya dibuat dari incoming comment yang tersimpan; tidak ada endpoint cold DM. Jika selector tidak menemukan target event secara tepat, action gagal aman dan tidak membalas target yang ambigu.

Comment scanner memerlukan URL posting eksplisit di Social Automation → Settings →
Posting yang dipantau (maksimal 50 URL per akun). Jalankan migrasi
`0018_social_comment_targets` sebelum menjalankan gateway versi ini. Scanner membuka
posting tersebut dan memuat komentar berikutnya melalui kontrol “more comments” /
“komentar lainnya”; batas 100 halaman atau timeout dilaporkan sebagai error, dengan
komentar yang sudah terbaca tetap diproses. Selector browser tetap perlu diverifikasi
pada akun live ketika tampilan Instagram/Facebook berubah.

Action baru dideduplikasi per akun, posting, pengguna, dan jenis action. Reply komentar
dan private reply memiliki kunci terpisah. Komentar dari pengguna berbeda tetap mendapat
action masing-masing; event tanpa identitas pengguna tetap memakai deduplikasi event.
Riwayat action sebelum migrasi tidak dihapus atau diubah.

Tes DOM lokal: set `SOCIAL_TEST_BROWSER` ke executable Chromium lalu jalankan
`go test ./internal/social/...` dari `gateway/`. Tes konkurensi database memakai
`SOCIAL_TEST_DATABASE_URL` pada PostgreSQL terisolasi dan membuat schema tes sementara.

Selector browser bersifat konservatif dan perlu diverifikasi pada DOM akun uji karena Facebook/Instagram dapat mengubah halaman. Fitur tidak melakukan CAPTCHA/checkpoint bypass, stealth patch, fingerprint spoofing, proxy rotation, credential automation, atau random behavior untuk menghindari deteksi.

Catatan browser manual: `BROWSER_HEADLESS=false` membutuhkan display desktop. Jalankan gateway secara lokal untuk login manual, atau siapkan display/noVNC yang terisolasi pada deployment Docker. Image saat ini tidak mengekspos port debugging Chromium ke jaringan.

## Notifikasi email Mailketing

Engine memiliki template email ChatCepat dengan logo, header, body, CTA, dan footer untuk:

- welcome email setelah pendaftaran berhasil;
- reset password sekali pakai (link berlaku 30 menit);
- reminder H-3 sebelum paket berakhir;
- pemberitahuan saat paket sudah berakhir.

Set `MAILKETING_API_TOKEN` di `.env` server. Sender `chatcepat.id@gmail.com` harus sudah ditambahkan/diizinkan di Mailketing, dan `MAILKETING_LOGO_URL` harus dapat diakses publik oleh email client. Worker `engine-notifications` menyimpan deduplikasi pengiriman di `email_notifications` sehingga reminder tidak dikirim berulang pada polling berikutnya.

## Troubleshooting

- `workspace resolve` gagal → jalankan `docker compose exec engine python -m app.seed`, atau masukkan tenant UUID di Settings.
- worker tidak memproses → cek `docker compose logs backend-worker`; pastikan Redis healthy dan `APP_ROLE=worker`.
- automation failed karena status account → cek Channels → Health, circuit breaker, rate limiter, dan global kill switch.
- dashboard lama meminta login → gunakan auth existing di `/login`; console development `/omnichannel` tidak menggantikan auth production.
- migration gagal → cek `docker compose logs engine` dan pastikan PostgreSQL sudah healthy.

## Production notes

- Integrasi api.co disembunyikan melalui `web/lib/features.ts`; data historis tidak dihapus. Pengajuan WA official dan template HSM provider lama tidak tersedia di UI.
- Sebelum menjalankan versi ini, terapkan migrasi engine sampai `0019_order_period` (`alembic upgrade head` dari direktori engine). Migrasi `0018` menambahkan target posting/deduplikasi komentar; `0019` menyimpan periode paket pada order. Cadangkan database sebelum migrasi produksi.
- Reset password produksi membutuhkan engine, `SERVICE_TOKEN` yang sama, konfigurasi Mailketing, dan `APP_BASE_URL` publik yang benar. Kegagalan pengiriman tidak lagi ditampilkan sebagai sukses.
- Catatan cakupan audit dan tes: [audit fitur September 2026](docs/feature-audit-2026-09-26.md).

- Set `APP_ENV=production`, `SESSION_ENCRYPTION_KEY` random, `NEXTAUTH_SECRET`, `SERVICE_TOKEN`, database TLS, dan origin/CORS yang spesifik.
- Tambahkan auth middleware nyata pada `/api`, jangan mengandalkan workspace header dari browser.
- Pisahkan Redis DB/instance untuk queue dan realtime bila diperlukan.
- Jalankan API dan worker sebagai deployment terpisah, tetapi tetap gunakan package channel yang sama.
- Aktifkan kembali adapter official melalui Meta API resmi setelah app review, webhook verification, permission, token lifecycle, dan rate policy siap.
