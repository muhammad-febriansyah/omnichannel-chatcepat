"""Broadcast compliant (docs/prd/07).

Aturan keras (anti-spam by design):
- Hanya kontak `opted_in` yang dikirimi. `opted_out` → skipped_optout (tercatat).
  `unknown` dikecualikan. Guard di LEVEL DATA, bukan UI.
- Throttle outbound (official: rate Meta; unofficial: jeda acak besar, rawan banned).
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from ..bus import publish_outbound
from ..config import (
    BROADCAST_BATCH,
    BROADCAST_REST_EVERY,
    BROADCAST_REST_MAX_S,
    BROADCAST_REST_MIN_S,
    THROTTLE_OFFICIAL_S,
    THROTTLE_UNOFFICIAL_MAX_S,
    THROTTLE_UNOFFICIAL_MIN_S,
    WARMUP_DAILY_CAPS,
    WARMUP_WINDOW_S,
)
from ..contracts.events import OutboundCommand, Party, Template
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..models import Broadcast, BroadcastRecipient, Channel, Contact
from ..repositories import broadcasts, channels, conversations, messages
from . import warmup

log = logging.getLogger("engine.broadcast")


async def run_broadcast(broadcast_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> dict:
    """Bangun recipients dari audience (partisi opt_in), set status running."""
    async with AsyncSessionLocal() as session, session.begin():
        b = await broadcasts.get(session, broadcast_id)
        # Tenant scope (defense-in-depth): mismatch = tidak ada.
        if b is None or (tenant_id is not None and b.tenant_id != tenant_id):
            raise ValueError(f"broadcast {broadcast_id} tidak ada")
        if b.status not in ("draft", "scheduled"):
            return {"status": b.status, "skipped": True}

        contacts = await broadcasts.match_contacts(session, b.tenant_id, b.audience_filter)
        pending = skipped = 0
        for c in contacts:
            if c.opt_in_status == "opted_in":
                await broadcasts.add_recipient(
                    session, tenant_id=b.tenant_id, broadcast_id=b.id,
                    contact_id=c.id, status="pending",
                )
                pending += 1
            elif c.opt_in_status == "opted_out":
                await broadcasts.add_recipient(
                    session, tenant_id=b.tenant_id, broadcast_id=b.id,
                    contact_id=c.id, status="skipped_optout",
                )
                skipped += 1
            # unknown: dikecualikan (bukan consent)

        stats = {"total": pending, "sent": 0, "failed": 0, "skipped_optout": skipped}
        await broadcasts.set_status(session, b.id, "running", stats)
    return {"status": "running", "pending": pending, "skipped_optout": skipped}


def _throttle_seconds(channel: Channel | None) -> float:
    if channel is not None and channel.type == "wa_unofficial":
        return random.uniform(THROTTLE_UNOFFICIAL_MIN_S, THROTTLE_UNOFFICIAL_MAX_S)
    return THROTTLE_OFFICIAL_S


def _daily_cap(channel: Channel, now: datetime) -> int:
    """Cap outbound/rolling-24h sesuai umur channel (warmup). 0 = nonaktif.
    Sumber tunggal di services.warmup (dipakai broadcast + kirim 1:1)."""
    return warmup.daily_cap(channel, now)


def _build_command(
    b: Broadcast, channel: Channel | None, contact: Contact, conv_id, idem: str
) -> OutboundCommand:
    use_template = channel is not None and channel.type == "wa_official" and b.template_id
    if use_template:
        return OutboundCommand(
            event_id=uuid.uuid4().hex,
            idempotency_key=idem,
            channel_id=b.channel_id,
            to=Party(external_id=contact.external_id or contact.phone or "", phone=contact.phone),
            type=OutboundType.template,
            template=Template(name=b.template_id, lang="id", components=[]),
            conversation_id=conv_id,
        )
    return OutboundCommand(
        event_id=uuid.uuid4().hex,
        idempotency_key=idem,
        channel_id=b.channel_id,
        to=Party(external_id=contact.external_id or contact.phone or "", phone=contact.phone),
        type=OutboundType.text,
        body=b.body_snapshot or "",
        conversation_id=conv_id,
    )


async def dispatch(
    broadcast_id: uuid.UUID, throttle_s: float | None = None, batch: int = BROADCAST_BATCH
) -> dict:
    """Kirim semua penerima pending (throttle). Update status + stats. Idempoten per penerima."""
    sent = failed = 0
    async with AsyncSessionLocal() as session:
        async with session.begin():
            b = await broadcasts.get(session, broadcast_id)
            if b is None or b.status != "running":
                return {"skipped": True}
            channel = await channels.get_by_id(session, b.channel_id)
        mtype = "template" if (channel and channel.type == "wa_official" and b.template_id) else "text"
        is_unofficial = channel is not None and channel.type == "wa_unofficial"

        # Warmup + daily cap (unofficial, throttle default). cap_remaining None =
        # tanpa batas. Saat habis → pause: sisakan recipient pending, status tetap
        # running; worker re-invoke dispatch tiap poll, lanjut saat window longgar.
        cap_remaining: int | None = None
        if is_unofficial and throttle_s is None:
            now = datetime.now(timezone.utc)
            cap = _daily_cap(channel, now)
            if cap > 0:
                async with session.begin():
                    used = await messages.count_outbound_since(
                        session, b.channel_id, now - timedelta(seconds=WARMUP_WINDOW_S)
                    )
                cap_remaining = max(0, cap - used)
                # sisa 0 = worker poll tiap 5s sampai window longgar → debug, jangan spam info.
                log.log(
                    logging.INFO if cap_remaining > 0 else logging.DEBUG,
                    "broadcast %s cap warmup: %d terpakai %d, sisa %d",
                    broadcast_id, cap, used, cap_remaining,
                )

        paused = False
        while True:
            async with session.begin():
                recips: list[BroadcastRecipient] = await broadcasts.pending_recipients(
                    session, broadcast_id, batch
                )
            if not recips:
                break

            for r in recips:
                if cap_remaining is not None and cap_remaining <= 0:
                    paused = True
                    break
                idem = f"bcast:{broadcast_id}:{r.contact_id}"
                try:
                    async with session.begin():
                        conv = await conversations.get_or_create_active(
                            session, b.tenant_id, b.channel_id, r.contact_id
                        )
                        msg = await messages.add_outbound(
                            session,
                            tenant_id=b.tenant_id,
                            conversation_id=conv.id,
                            channel_id=b.channel_id,
                            sender="system",
                            body=b.body_snapshot or "",
                            idempotency_key=idem,
                            msg_type=mtype,
                        )
                        r.status = "sent"
                        r.message_id = msg.id
                        conv.last_message_at = datetime.now(timezone.utc)
                        conv.last_message_preview = (b.body_snapshot or "[template]")[:120]
                        cmd = _build_command(b, channel, r.contact, conv.id, idem)
                    await publish_outbound(cmd.model_dump_json(by_alias=True))
                    sent += 1
                    if cap_remaining is not None:
                        cap_remaining -= 1
                except Exception as e:  # noqa: BLE001
                    log.exception("broadcast recipient gagal: %s", r.contact_id)
                    async with session.begin():
                        r.status = "failed"
                        r.error = str(e)[:500]
                    failed += 1

                delay = throttle_s if throttle_s is not None else _throttle_seconds(channel)
                if delay > 0:
                    await asyncio.sleep(delay)

                # Rest panjang anti-banned: tiap N pesan terkirim, jeda lama acak
                # meniru manusia istirahat (hanya unofficial, hanya saat memakai
                # throttle default — bukan override eksplisit dari pemanggil).
                if (
                    is_unofficial
                    and throttle_s is None
                    and BROADCAST_REST_EVERY > 0
                    and r.status == "sent"
                    and sent > 0
                    and sent % BROADCAST_REST_EVERY == 0
                ):
                    rest = random.uniform(BROADCAST_REST_MIN_S, BROADCAST_REST_MAX_S)
                    log.info("broadcast %s rest %.0fs setelah %d kirim", broadcast_id, rest, sent)
                    await asyncio.sleep(rest)

            if paused:
                break

        # Stats akumulatif lintas re-invoke (cap bisa pecah broadcast jadi
        # beberapa dispatch). Pause → status tetap running (worker lanjut nanti).
        prev = b.stats or {}
        stats = {
            "total": prev.get("total", sent + failed),
            "sent": prev.get("sent", 0) + sent,
            "failed": prev.get("failed", 0) + failed,
            "skipped_optout": prev.get("skipped_optout", 0),
        }
        status = "running" if paused else "done"
        async with session.begin():
            await broadcasts.set_status(session, broadcast_id, status, stats)
        if paused:
            log.info("broadcast %s pause (cap warmup tercapai), %d terkirim run ini", broadcast_id, sent)
    return {"status": status, "sent": sent, "failed": failed, "paused": paused}
