# CLAUDE.md — ChatCepat (root)

Konvensi global + peta servis. Baca ini sebelum modul mana pun.
PRD lengkap: `docs/prd/` (mulai dari `docs/prd/CLAUDE.md`, lalu `00`→`10`).

## Peta servis

| Folder | Bahasa | Tanggung jawab |
|---|---|---|
| `gateway/` | Go | Semua I/O channel (whatsmeow, webhook Meta, Telegram), WS realtime |
| `engine/` | Python (FastAPI + SQLAlchemy 2.0 async) | Auto-reply, AI agent, persist pesan, broadcast worker. **Pemilik migration (Alembic = skema kanonik).** |
| `web/` | Next.js (App Router, TS) | Dashboard tenant, BFF, CRUD admin. Drizzle introspect skema. |
| `contracts/` | JSON Schema | **Sumber kebenaran event schema** (`09`). Generate tipe ke 3 bahasa. |

Tiap servis punya `CLAUDE.md` sendiri dengan aturan spesifik.

## Prinsip umum (wajib di semua servis)

- **Multi-tenant row-level.** Single DB. Tiap tabel domain punya `tenant_id` (UUID, NOT NULL, FK `tenants`). Tenant scope wajib otomatis, bukan manual per query. Lihat `docs/prd/02-data-model.md`.
- **Idempoten.** Semua consumer queue + webhook handler idempoten (dedup key). Pesan masuk bisa dobel.
- **Zero N+1.** Endpoint list wajib eager-load relasi yang dirender. `selectinload` koleksi, `joinedload` many-to-one (engine); Drizzle `with: {}` (web).
- **Index komposit selalu diawali `tenant_id`.** Keyset/cursor pagination, bukan OFFSET.
- **Uang = BIGINT** (rupiah penuh, no float).
- **Snapshot data transaksi.** Broadcast/invoice salin nilai, jangan join ke master yang berubah.
- **UTC di DB** (`TIMESTAMPTZ`), konversi WIB hanya di presentasi.

## Skema = satu pemilik

- DDL hanya di `engine/migrations` (Alembic). Tidak ada `CREATE/ALTER TABLE` di luar itu.
- Web `drizzle-kit pull` introspect dari DB. Drizzle hanya select/insert/update.
- Go tidak punya migration domain (cuma whatsmeow `sqlstore`).

## Event schema = satu pemilik

Ubah event = edit `contracts/events.schema.json` → `make contracts` → commit. Jangan ubah tipe event langsung di servis. `contracts/generated/*` di-commit tapi jangan edit manual.

## Yang TIDAK boleh

- Scraping nomor/kontak pihak ketiga tanpa consent. Lihat `docs/prd/07-contacts-broadcast.md`.
- Broadcast ke kontak non-opt-in. Blok di level data, bukan UI.
- Hardcode kredensial channel. Semua di `channels.credentials` (terenkripsi) atau secret manager.

## Penamaan

- Tabel/kolom DB: `snake_case`, plural tabel.
- Endpoint: `kebab-case`, REST, prefix `/v1`.
- Event queue: `domain.action` (`message.inbound`, `message.outbound`, `message.status`).
- TS: `camelCase` var, `PascalCase` tipe. Python: `snake_case`.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->