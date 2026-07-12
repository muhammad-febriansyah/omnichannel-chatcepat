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
from ..contracts.events import InboundMessage, Media, OutboundCommand, Party
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..models import Channel, Contact, Conversation, Message
from ..pipeline.decision import decide
from ..pipeline.reply import Reply
from ..repositories import channels, contacts, conversations, messages
from . import warmup

log = logging.getLogger("engine.inbound")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _preview(text: str | None, kind: str) -> str:
    return (text or f"[{kind}]")[:120]


_MIME_BY_EXT = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


def _guess_mime(url: str) -> str:
    ext = url.rsplit(".", 1)[-1].split("?")[0].lower() if "." in url else ""
    return _MIME_BY_EXT.get(ext, "image/jpeg")


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
    channel: Channel, contact: Contact, conv: Conversation, reply: Reply, idem: str
) -> None:
    is_media = bool(reply.media_url)
    cmd = OutboundCommand(
        event_id=uuid4().hex,
        idempotency_key=idem,
        channel_id=channel.id,
        to=Party(
            external_id=contact.external_id or contact.phone or "",
            phone=contact.phone,
        ),
        type=OutboundType.media if is_media else OutboundType.text,
        body=reply.text,
        media=Media(url=reply.media_url, mime=_guess_mime(reply.media_url)) if is_media else None,
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
            # Window layanan 24 jam berlaku untuk semua platform Meta: WA official +
            # Messenger + Instagram. Di luar window, free-form ditolak Meta → balasan
            # agen/lanjutan harus dalam window ini (di-enforce di send_agent_reply).
            if channel.type in ("wa_official", "instagram", "facebook"):
                conv.service_window_expires_at = now + timedelta(hours=SERVICE_WINDOW_HOURS)

            # Opt-out otomatis (07): kontak balas STOP/BERHENTI → opted_out.
            if _is_opt_out(inbound.body):
                contact.opt_in_status = "opted_out"

        tenant_str = str(tenant_id)
        await _publish_message_new(tenant_str, conv.id, inbound_msg, "contact")

        # Balas otomatis (flow + AI) dikontrol per-channel via toggle
        # auto_reply_enabled. Default: official ON, wa_unofficial OFF (balasan
        # otomatis dari nomor pribadi memicu deteksi spam WA → rawan banned).
        # OFF → hanya persist + realtime; agen balas manual.
        if not channel.auto_reply_enabled:
            return
        # wa_unofficial dgn auto-reply ON: hormati cap warm-up rolling-24h supaya
        # volume balasan otomatis tak memicu ban. Cap habis → skip balas (inbound
        # tetap tersimpan; agen bisa balas manual).
        if channel.type == "wa_unofficial":
            left = await warmup.remaining(session, channel, _now())
            if left is not None and left <= 0:
                log.info("auto-reply skip: cap warm-up channel %s habis", channel.id)
                return

        # --- DECIDE + REPLY ---
        # decide() bisa menulis (flow state) → txn sendiri, commit sebelum kirim balasan.
        async with session.begin():
            decision = await decide(session, conv, channel, contact, inbound)
        if decision.stop:
            return

        for i, reply in enumerate(decision.replies):
            if not reply or (not reply.text and not reply.media_url):
                continue
            is_media = bool(reply.media_url)
            idem = f"reply:{inbound.dedup_key}:{i}"
            async with session.begin():
                out_msg = await messages.add_outbound(
                    session,
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    channel_id=channel.id,
                    sender="bot",
                    body=reply.text,
                    idempotency_key=idem,
                    msg_type="image" if is_media else "text",
                    media={"url": reply.media_url} if is_media else None,
                )
                conv.last_message_at = _now()
                conv.last_message_preview = _preview(reply.text, "foto" if is_media else "text")
            await _publish_outbound(channel, contact, conv, reply, idem)
            await _publish_message_new(tenant_str, conv.id, out_msg, "bot")

        # Handoff: bot serahkan ke agen (set handler=agent) + realtime.
        if decision.handoff:
            async with session.begin():
                conv.handler = "agent"
            await _publish_conv_updated(tenant_str, conv)
