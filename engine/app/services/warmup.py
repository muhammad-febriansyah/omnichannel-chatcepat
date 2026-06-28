"""Warm-up + daily cap anti-banned untuk channel WhatsApp unofficial (whatsmeow).

Nomor pribadi yang kirim terlalu banyak per hari memicu deteksi spam WA → akun
dibatasi/banned, apalagi nomor baru. Cap = batas outbound per rolling 24 jam per
channel, naik bertahap sesuai umur channel (WARMUP_DAILY_CAPS, index = umur hari).

Hitungan `count_outbound_since` mencakup SEMUA outbound (broadcast + balasan 1:1 +
AI) — volume total yang memicu ban. Dipakai broadcast worker (07) dan kirim 1:1
(send_agent_reply / start_conversation). docs/prd/07.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import WARMUP_DAILY_CAPS, WARMUP_WINDOW_S
from ..models import Channel
from ..repositories import messages


class DailyCapReached(Exception):
    """Cap warm-up harian (rolling 24 jam) channel unofficial sudah tercapai."""


def daily_cap(channel: Channel, now: datetime) -> int:
    """Cap outbound rolling-24h sesuai umur channel (warm-up). 0 = nonaktif."""
    if not WARMUP_DAILY_CAPS:
        return 0
    created = channel.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age_days = max(0, (now - created).days)
    idx = min(age_days, len(WARMUP_DAILY_CAPS) - 1)
    return WARMUP_DAILY_CAPS[idx]


async def remaining(session: AsyncSession, channel: Channel, now: datetime) -> int | None:
    """Sisa kuota outbound rolling-24h. None = tanpa batas (cap nonaktif)."""
    cap = daily_cap(channel, now)
    if cap <= 0:
        return None
    used = await messages.count_outbound_since(
        session, channel.id, now - timedelta(seconds=WARMUP_WINDOW_S)
    )
    return max(0, cap - used)


async def enforce_unofficial(session: AsyncSession, channel: Channel) -> None:
    """Blok kirim 1:1 bila channel unofficial sudah melewati cap warm-up. Channel
    lain (official/telegram/ig/fb) tak punya risiko banned → lewat tanpa cek."""
    if channel.type != "wa_unofficial":
        return
    now = datetime.now(timezone.utc)
    left = await remaining(session, channel, now)
    if left is not None and left <= 0:
        cap = daily_cap(channel, now)
        raise DailyCapReached(
            f"Batas harian nomor WhatsApp (warm-up) tercapai: {cap} pesan per 24 "
            "jam. Tunggu kuota pulih, atau gunakan nomor official untuk volume tinggi."
        )
