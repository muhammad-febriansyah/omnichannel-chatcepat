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
from datetime import datetime, timezone

from ..bus import publish_outbound
from ..config import (
    BROADCAST_BATCH,
    THROTTLE_OFFICIAL_S,
    THROTTLE_UNOFFICIAL_MAX_S,
    THROTTLE_UNOFFICIAL_MIN_S,
)
from ..contracts.events import OutboundCommand, Party, Template
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..models import Broadcast, BroadcastRecipient, Channel, Contact
from ..repositories import broadcasts, channels, conversations, messages

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

        while True:
            async with session.begin():
                recips: list[BroadcastRecipient] = await broadcasts.pending_recipients(
                    session, broadcast_id, batch
                )
            if not recips:
                break

            for r in recips:
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
                except Exception as e:  # noqa: BLE001
                    log.exception("broadcast recipient gagal: %s", r.contact_id)
                    async with session.begin():
                        r.status = "failed"
                        r.error = str(e)[:500]
                    failed += 1

                delay = throttle_s if throttle_s is not None else _throttle_seconds(channel)
                if delay > 0:
                    await asyncio.sleep(delay)

        stats = {"total": sent + failed, "sent": sent, "failed": failed}
        async with session.begin():
            await broadcasts.set_status(session, broadcast_id, "done", _merge_stats(b, stats))
    return {"status": "done", "sent": sent, "failed": failed}


def _merge_stats(b: Broadcast, new: dict) -> dict:
    merged = dict(b.stats or {})
    merged.update(new)
    return merged
