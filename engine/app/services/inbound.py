"""HandleInboundMessage — decision pipeline (docs/prd/05).

DEDUP -> RESOLVE -> PERSIST -> PUBLISH RT -> DECIDE -> REPLY.
Satu action; transaksi persist & reply terpisah supaya idempoten + realtime urut.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from ..bus import publish_outbound, publish_realtime
from ..config import OPT_OUT_KEYWORDS, SERVICE_WINDOW_HOURS
from ..contracts.events import InboundMessage, OutboundCommand, Party
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..models import Channel, Contact, Conversation, Message
from ..pipeline.decision import decide
from ..repositories import channels, contacts, conversations, messages

log = logging.getLogger("engine.inbound")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _preview(text: str | None, kind: str) -> str:
    return (text or f"[{kind}]")[:120]


def _is_opt_out(body: str | None) -> bool:
    if not body:
        return False
    return body.strip().lower() in OPT_OUT_KEYWORDS


async def _publish_message_new(
    tenant_id: str, conv_id, msg: Message, sender: str
) -> None:
    payload = {
        "type": "message.new",
        "payload": {
            "conversation_id": str(conv_id),
            "message": {
                "id": str(msg.id),
                "direction": msg.direction,
                "sender": sender,
                "type": msg.type,
                "body": msg.body,
            },
        },
    }
    await publish_realtime(tenant_id, json.dumps(payload))


async def _publish_conv_updated(tenant_id: str, conv: Conversation) -> None:
    payload = {
        "type": "conversation.updated",
        "payload": {
            "conversation_id": str(conv.id),
            "handler": conv.handler,
            "status": conv.status,
        },
    }
    await publish_realtime(tenant_id, json.dumps(payload))


async def _publish_outbound(
    channel: Channel, contact: Contact, conv: Conversation, body: str, idem: str
) -> None:
    cmd = OutboundCommand(
        event_id=uuid4().hex,
        idempotency_key=idem,
        channel_id=channel.id,
        to=Party(
            external_id=contact.external_id or contact.phone or "",
            phone=contact.phone,
        ),
        type=OutboundType.text,
        body=body,
        conversation_id=conv.id,
    )
    await publish_outbound(cmd.model_dump_json(by_alias=True))


async def handle(inbound: InboundMessage) -> None:
    async with AsyncSessionLocal() as session:
        # --- TXN 1: dedup + resolve + persist ---
        async with session.begin():
            channel = await channels.get_by_id(session, inbound.channel_id)
            if channel is None:
                log.warning("inbound channel tidak dikenal: %s", inbound.channel_id)
                return
            tenant_id = channel.tenant_id

            if await messages.exists_provider(
                session, channel.id, inbound.provider_message_id
            ):
                log.info("dedup: %s sudah diproses", inbound.dedup_key)
                return

            contact = await contacts.get_or_create(
                session,
                tenant_id,
                external_id=inbound.from_.external_id,
                phone=inbound.from_.phone,
                name=inbound.from_.name,
            )
            conv = await conversations.get_or_create_active(
                session, tenant_id, channel.id, contact.id
            )
            inbound_msg = await messages.add_inbound(
                session,
                tenant_id=tenant_id,
                conversation_id=conv.id,
                channel_id=channel.id,
                msg_type=inbound.type.value,
                body=inbound.body,
                media=inbound.media.model_dump() if inbound.media else None,
                provider_message_id=inbound.provider_message_id,
            )
            now = _now()
            conv.last_message_at = now
            conv.last_message_preview = _preview(inbound.body, inbound.type.value)
            conv.unread_count = conv.unread_count + 1
            if channel.type == "wa_official":
                conv.service_window_expires_at = now + timedelta(hours=SERVICE_WINDOW_HOURS)

            # Opt-out otomatis (07): kontak balas STOP/BERHENTI → opted_out.
            if _is_opt_out(inbound.body):
                contact.opt_in_status = "opted_out"

        tenant_str = str(tenant_id)
        await _publish_message_new(tenant_str, conv.id, inbound_msg, "contact")

        # --- DECIDE + REPLY ---
        # decide() bisa menulis (flow state) → txn sendiri, commit sebelum kirim balasan.
        async with session.begin():
            decision = await decide(session, conv, channel, contact, inbound)
        if decision.stop:
            return

        for i, reply in enumerate(decision.replies):
            if not reply:
                continue
            idem = f"reply:{inbound.dedup_key}:{i}"
            async with session.begin():
                out_msg = await messages.add_outbound(
                    session,
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    channel_id=channel.id,
                    sender="bot",
                    body=reply,
                    idempotency_key=idem,
                )
                conv.last_message_at = _now()
                conv.last_message_preview = _preview(reply, "text")
            await _publish_outbound(channel, contact, conv, reply, idem)
            await _publish_message_new(tenant_str, conv.id, out_msg, "bot")

        # Handoff: bot serahkan ke agen (set handler=agent) + realtime.
        if decision.handoff:
            async with session.begin():
                conv.handler = "agent"
            await _publish_conv_updated(tenant_str, conv)
