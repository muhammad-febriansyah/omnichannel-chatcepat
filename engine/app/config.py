"""Konfigurasi engine dari environment."""

from __future__ import annotations

import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://chatcepat:chatcepat@localhost:5432/chatcepat"
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Auth servis-ke-servis (Web → Engine). Lihat docs/prd/09.
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "change-me")

# Redis Streams (09-api-contracts)
STREAM_INBOUND = "message.inbound"
STREAM_OUTBOUND = "message.outbound"
STREAM_STATUS = "message.status"
CONSUMER_GROUP = "engine"

# Pub/Sub realtime per tenant
REALTIME_PREFIX = "realtime."

# Service window WA official (jam)
SERVICE_WINDOW_HOURS = 24

# Flow state hangus kalau idle (jam) — docs/prd/05,06
FLOW_STATE_TTL_HOURS = 1

# AI agent (06) — TODO PRODUK provider LLM. Kosong = AI nonaktif → fallback.
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-opus-4-8")
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "1024"))
OPENAI_CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM = 1536
RAG_TOP_K = 5
# Memori AI: jumlah pesan terakhir yang dikirim sebagai konteks percakapan (06).
AI_HISTORY_LIMIT = int(os.environ.get("AI_HISTORY_LIMIT", "10"))
# Eskalasi low-confidence: balasan saat AI angkat tangan → handoff ke agen (06).
AI_ESCALATION_MESSAGE = "Baik, saya hubungkan dengan agen kami. Mohon tunggu sebentar ya."

# Fallback default kalau tak ada flow/AI yang menjawab (06)
DEFAULT_FALLBACK_MESSAGE = "Terima kasih, pesan Anda kami terima. Agen kami akan segera membalas."

# Opt-out otomatis (07): balasan kontak berisi kata kunci ini → opted_out
OPT_OUT_KEYWORDS = {"stop", "berhenti", "unsub", "unsubscribe"}

# Broadcast (07) — throttle anti-banned
BROADCAST_BATCH = 50
THROTTLE_OFFICIAL_S = 0.1
THROTTLE_UNOFFICIAL_MIN_S = 8.0
THROTTLE_UNOFFICIAL_MAX_S = 20.0
# Rest panjang anti-banned (unofficial): tiap N pesan terkirim, jeda lama acak
# meniru manusia istirahat. 0 = nonaktif. Hanya berlaku untuk wa_unofficial.
BROADCAST_REST_EVERY = int(os.environ.get("BROADCAST_REST_EVERY", "20"))
BROADCAST_REST_MIN_S = float(os.environ.get("BROADCAST_REST_MIN_S", "60"))
BROADCAST_REST_MAX_S = float(os.environ.get("BROADCAST_REST_MAX_S", "180"))

# Warmup + daily cap anti-banned (unofficial). Cap = batas outbound per rolling
# 24 jam per channel, naik bertahap sesuai umur channel (hari sejak dibuat).
# Index = umur hari; nilai = cap. Umur >= panjang list → cap matang (nilai akhir).
# Override via env WARMUP_DAILY_CAPS="20,40,80,...". 0 = nonaktif (tanpa batas).
WARMUP_WINDOW_S = 24 * 3600


def _parse_caps(raw: str) -> list[int]:
    try:
        caps = [int(x) for x in raw.split(",") if x.strip()]
    except ValueError:
        caps = []
    return caps or [20, 40, 80, 160, 320, 500, 750, 1000]


WARMUP_DAILY_CAPS = _parse_caps(os.environ.get("WARMUP_DAILY_CAPS", ""))
