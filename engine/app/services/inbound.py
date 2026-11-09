"""HandleInboundMessage — decision pipeline (docs/prd/05).

DEDUP -> RESOLVE -> PERSIST -> PUBLISH RT -> DECIDE -> REPLY.
Satu action; transaksi persist & reply terpisah supaya idempoten + realtime urut.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from urllib.parse import urljoin

from ..bus import publish_outbound, publish_realtime
from ..config import APP_BASE_URL, OPT_OUT_KEYWORDS, SERVICE_WINDOW_HOURS
from ..contracts.events import Button, InboundMessage, Media, OutboundCommand, Party
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..models import Channel, Contact, Conversation, Message
from ..pipeline.decision import decide
from ..pipeline.reply import Reply, options_as_text
from ..repositories import broadcasts, channels, contacts, conversations, messages
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


def comment_replies(replies: list[Reply]) -> list[Reply]:
    """Shape a comment flow's output for Meta's rules: public replies stay as they are;
    everything else becomes ONE private reply (Meta allows a single DM per comment,
    text only), joined in order."""
    public = [r for r in replies if r and r.mode == "comment_reply" and r.text]
    private_parts = []
    for r in replies:
        if not r or r.mode == "comment_reply":
            continue
        text = options_as_text(r.text, r.buttons) if r.buttons else (r.text or "")
        if r.media_url and not text:
            continue
        if text.strip():
            private_parts.append(text.strip())
    out = list(public)
    if private_parts:
        out.append(Reply(text="\n\n".join(private_parts), mode="private_reply"))
    return out


async def _publish_outbound(
    channel: Channel,
    contact: Contact,
    conv: Conversation,
    reply: Reply,
    idem: str,
    comment_id: str | None = None,
) -> None:
    is_media = bool(reply.media_url)
    # Real WA buttons only exist on the Cloud API; elsewhere options go into the text.
    interactive = bool(reply.buttons) and not is_media and channel.type == "wa_official"
    body = reply.text
    if reply.buttons and not interactive:
        body = options_as_text(reply.text, reply.buttons)
    if is_media:
        out_type = OutboundType.media
    elif interactive:
        out_type = OutboundType.interactive
    else:
        out_type = OutboundType.text
    cmd = OutboundCommand(
        event_id=uuid4().hex,
        idempotency_key=idem,
        channel_id=channel.id,
        to=Party(
            external_id=contact.external_id or contact.phone or "",
            phone=contact.phone,
        ),
        type=out_type,
        body=body,
        media=Media(url=urljoin(APP_BASE_URL + "/", reply.media_url), mime=_guess_mime(reply.media_url)) if is_media else None,
        buttons=[Button(id=i, title=t) for i, t in reply.buttons] if interactive else None,
        conversation_id=conv.id,
        comment_id=comment_id if reply.mode else None,
        reply_mode=reply.mode if comment_id else None,
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
                # Comments share the thread with DMs; label them so agents can tell.
                body=f"💬 Komentar: {inbound.body}" if inbound.comment else inbound.body,
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
            # Komentar publik TIDAK membuka window (hanya private reply 1x yang boleh).
            if channel.type in ("wa_official", "instagram", "facebook") and not inbound.comment:
                conv.service_window_expires_at = now + timedelta(hours=SERVICE_WINDOW_HOURS)

            # Opt-out otomatis (07): kontak balas STOP/BERHENTI → opted_out.
            if _is_opt_out(inbound.body):
                contact.opt_in_status = "opted_out"

            # Klik tombol broadcast → catat untuk laporan (terlepas dari balas otomatis).
            click = broadcasts.parse_click_payload(inbound.payload)
            if click is not None:
                await broadcasts.record_click(
                    session, tenant_id, click[0], contact.id, inbound.body or "", now
                )

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
        # --- DECIDE + REPLY ---
        # decide() bisa menulis (flow state) → txn sendiri, commit sebelum kirim balasan.
        async with session.begin():
            if channel.type == "wa_unofficial":
                left = await warmup.remaining(session, channel, _now())
                if left is not None and left <= 0:
                    log.info("auto-reply skip: cap warm-up channel %s habis", channel.id)
                    return
            decision = await decide(session, conv, channel, contact, inbound)
        if decision.stop:
            return

        comment_id = inbound.comment.comment_id if inbound.comment else None
        replies = comment_replies(decision.replies) if comment_id else decision.replies
        for i, reply in enumerate(replies):
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
                    body=f"↪ Balas komentar: {reply.text}" if reply.mode == "comment_reply" else reply.text,
                    idempotency_key=idem,
                    msg_type="image" if is_media else "text",
                    media={"url": reply.media_url} if is_media else None,
                )
                conv.last_message_at = _now()
                conv.last_message_preview = _preview(reply.text, "foto" if is_media else "text")
            await _publish_outbound(channel, contact, conv, reply, idem, comment_id)
            await _publish_message_new(tenant_str, conv.id, out_msg, "bot")

        # Handoff: bot serahkan ke agen (set handler=agent) + realtime.
        if decision.handoff:
            async with session.begin():
                conv.handler = "agent"
            await _publish_conv_updated(tenant_str, conv)
