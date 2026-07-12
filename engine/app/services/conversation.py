"""Aksi percakapan dari agen (web → engine). Web tak menulis tabel domain (01),
jadi balas/takeover lewat engine. docs/prd/05."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from ..bus import publish_outbound, publish_realtime
from ..contracts.events import OutboundCommand, Party, Template
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..repositories import contacts, conversations, messages
from . import warmup
from .warmup import DailyCapReached  # noqa: F401  (re-export untuk route)


class ServiceWindowClosed(Exception):
    """WA official: window layanan 24 jam tutup → teks free-form ditolak Meta.

    Di luar window, percakapan hanya bisa dibuka ulang lewat template (HSM).
    Route map ke HTTP 409 supaya agen tahu harus pilih template, bukan 500.
    """


async def send_agent_reply(
    conversation_id: uuid.UUID,
    body: str,
    agent_id: uuid.UUID | None = None,
    tenant_id: uuid.UUID | None = None,
) -> dict:
    """Agen balas → takeover (handler=agent), persist message, publish outbound + realtime."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            conv = await conversations.get_with_state(session, conversation_id)
            # Tenant scope (defense-in-depth): mismatch = tidak ada.
            if conv is None or (tenant_id is not None and conv.tenant_id != tenant_id):
                raise ValueError(f"percakapan {conversation_id} tidak ada")
            channel = conv.channel
            contact = conv.contact
            # Platform Meta (WA official + Messenger + Instagram): teks free-form hanya
            # boleh dalam window layanan 24 jam. Di luar window Meta tolak → balasan
            # gagal diam-diam. Blok di sini sebelum persist+kirim. Channel lain
            # (wa_unofficial/telegram) tak punya window → lewat.
            if channel.type in ("wa_official", "instagram", "facebook"):
                expires = conv.service_window_expires_at
                if expires is None or expires <= datetime.now(timezone.utc):
                    if channel.type == "wa_official":
                        raise ServiceWindowClosed(
                            "Window layanan WhatsApp 24 jam sudah tutup. Kontak harus "
                            "membalas dulu, atau buka percakapan lewat template (HSM)."
                        )
                    label = "Instagram" if channel.type == "instagram" else "Messenger"
                    raise ServiceWindowClosed(
                        f"Window pesan {label} 24 jam sudah tutup. Kontak harus "
                        "mengirim pesan lagi sebelum kamu bisa membalas."
                    )
            # Warm-up cap (unofficial): blok bila volume rolling-24h sudah lewat batas.
            await warmup.enforce_unofficial(session, channel)
            idem = f"agent:{conversation_id}:{uuid.uuid4().hex}"
            msg = await messages.add_outbound(
                session,
                tenant_id=conv.tenant_id,
                conversation_id=conv.id,
                channel_id=channel.id,
                sender="agent",
                agent_id=agent_id,
                body=body,
                idempotency_key=idem,
            )
            conv.handler = "agent"
            if agent_id is not None:
                conv.assigned_agent_id = agent_id
            conv.last_message_at = datetime.now(timezone.utc)
            conv.last_message_preview = body[:120]
            tenant_str = str(conv.tenant_id)
            cmd = OutboundCommand(
                event_id=uuid.uuid4().hex,
                idempotency_key=idem,
                channel_id=channel.id,
                to=Party(external_id=contact.external_id or contact.phone or "", phone=contact.phone),
                type=OutboundType.text,
                body=body,
                conversation_id=conv.id,
            )
            msg_id = str(msg.id)

        await publish_outbound(cmd.model_dump_json(by_alias=True))
        await publish_realtime(
            tenant_str,
            json.dumps(
                {
                    "type": "message.new",
                    "payload": {
                        "conversation_id": str(conversation_id),
                        "message": {"id": msg_id, "direction": "outbound", "sender": "agent", "body": body},
                    },
                }
            ),
        )
        await publish_realtime(
            tenant_str,
            json.dumps(
                {
                    "type": "conversation.updated",
                    "payload": {"conversation_id": str(conversation_id), "handler": "agent"},
                }
            ),
        )
    return {"message_id": msg_id, "handler": "agent"}


def _normalize_phone(raw: str) -> str:
    """MSISDN E.164 tanpa '+' (cocok format inbound + dibutuhkan WA/JID).

    Normalisasi nomor Indonesia: '0812…'→'62812…', '812…'→'62812…'.
    Nomor yang sudah diawali kode negara (62, 1, …) dibiarkan.
    """
    d = "".join(ch for ch in raw if ch.isdigit())
    if d.startswith("0"):
        d = "62" + d[1:]
    elif d.startswith("8"):
        # Nomor HP Indonesia tanpa kode negara (mulai '8') → tambah '62'.
        d = "62" + d
    return d


async def start_conversation(
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    phone: str,
    *,
    name: str | None = None,
    msg_type: str = "text",
    body: str | None = None,
    template_name: str | None = None,
    template_lang: str = "id",
    agent_id: uuid.UUID | None = None,
) -> dict:
    """Mulai percakapan baru ke 1 nomor (compose) → kirim pesan pertama outbound.

    Reuse find-or-create kontak + percakapan. Kontak baru = opt_in unknown
    (consent belum tentu ada; ini bukan broadcast). docs/prd/05, 07.
    """
    from sqlalchemy import select

    from ..models import Channel

    phone_norm = _normalize_phone(phone)
    if not phone_norm:
        raise ValueError("nomor telepon tidak valid")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            channel = await session.scalar(
                select(Channel).where(Channel.id == channel_id, Channel.tenant_id == tenant_id)
            )
            if channel is None:
                raise ValueError(f"channel {channel_id} tidak ada")
            if channel.status != "connected":
                raise ValueError("channel belum terhubung")
            # Warm-up cap (unofficial): first-contact/compose paling rawan banned —
            # blok bila volume rolling-24h sudah lewat batas umur channel.
            await warmup.enforce_unofficial(session, channel)

            contact = await contacts.get_or_create(
                session,
                tenant_id,
                external_id=None,
                phone=phone_norm,
                name=name,
                opt_in_status="unknown",
                opt_in_source="click_to_chat",
            )
            conv = await conversations.get_or_create_active(
                session, tenant_id, channel.id, contact.id
            )

            preview = body if (msg_type == "text" and body) else f"[template: {template_name}]"
            idem = f"agent:{conv.id}:{uuid.uuid4().hex}"
            msg = await messages.add_outbound(
                session,
                tenant_id=tenant_id,
                conversation_id=conv.id,
                channel_id=channel.id,
                sender="agent",
                agent_id=agent_id,
                body=body,
                idempotency_key=idem,
                msg_type=msg_type,
            )
            conv.handler = "agent"
            if agent_id is not None:
                conv.assigned_agent_id = agent_id
            conv.last_message_at = datetime.now(timezone.utc)
            conv.last_message_preview = (preview or "")[:120]

            to = Party(external_id=contact.external_id or phone_norm, phone=phone_norm)
            if msg_type == "template":
                cmd = OutboundCommand(
                    event_id=uuid.uuid4().hex,
                    idempotency_key=idem,
                    channel_id=channel.id,
                    to=to,
                    type=OutboundType.template,
                    template=Template(name=template_name, lang=template_lang, components=[]),
                    conversation_id=conv.id,
                )
            else:
                cmd = OutboundCommand(
                    event_id=uuid.uuid4().hex,
                    idempotency_key=idem,
                    channel_id=channel.id,
                    to=to,
                    type=OutboundType.text,
                    body=body,
                    conversation_id=conv.id,
                )
            tenant_str = str(tenant_id)
            conv_id = conv.id
            msg_id = str(msg.id)

        await publish_outbound(cmd.model_dump_json(by_alias=True))
        await publish_realtime(
            tenant_str,
            json.dumps(
                {
                    "type": "message.new",
                    "payload": {
                        "conversation_id": str(conv_id),
                        "message": {"id": msg_id, "direction": "outbound", "sender": "agent", "body": preview},
                    },
                }
            ),
        )
        await _publish_conv_updated(tenant_str, conv_id, handler="agent")
    return {"conversation_id": str(conv_id), "message_id": msg_id}


async def _publish_conv_updated(tenant_str: str, conversation_id: uuid.UUID, **fields) -> None:
    await publish_realtime(
        tenant_str,
        json.dumps(
            {
                "type": "conversation.updated",
                "payload": {"conversation_id": str(conversation_id), **fields},
            }
        ),
    )


async def _load(session, conversation_id: uuid.UUID, tenant_id: uuid.UUID | None = None):
    from sqlalchemy import select
    from ..models import Conversation

    conv = await session.scalar(select(Conversation).where(Conversation.id == conversation_id))
    # Tenant scope (defense-in-depth): mismatch diperlakukan = tidak ada (jangan bocor).
    if conv is None or (tenant_id is not None and conv.tenant_id != tenant_id):
        raise ValueError(f"percakapan {conversation_id} tidak ada")
    return conv


async def set_status(
    conversation_id: uuid.UUID, status: str, tenant_id: uuid.UUID | None = None
) -> dict:
    """Ubah status percakapan (open/resolved). docs/prd/05."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            conv = await _load(session, conversation_id, tenant_id)
            conv.status = status
            conv.updated_at = datetime.now(timezone.utc)
            tenant_str = str(conv.tenant_id)
        await _publish_conv_updated(tenant_str, conversation_id, status=status)
    return {"status": status}


async def set_handler(
    conversation_id: uuid.UUID, handler: str, tenant_id: uuid.UUID | None = None
) -> dict:
    """Pindah penanganan (bot/agent). 'bot' = kembalikan ke AI agent. docs/prd/05."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            conv = await _load(session, conversation_id, tenant_id)
            conv.handler = handler
            if handler == "bot":
                conv.assigned_agent_id = None
            conv.updated_at = datetime.now(timezone.utc)
            tenant_str = str(conv.tenant_id)
        await _publish_conv_updated(tenant_str, conversation_id, handler=handler)
    return {"handler": handler}


async def assign_conversation(
    conversation_id: uuid.UUID, agent_id: uuid.UUID, tenant_id: uuid.UUID | None = None
) -> dict:
    """Tugaskan percakapan ke agen (handler=agent). Butuh conversation.assign. docs/prd/05."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            conv = await _load(session, conversation_id, tenant_id)
            conv.assigned_agent_id = agent_id
            conv.handler = "agent"
            conv.updated_at = datetime.now(timezone.utc)
            tenant_str = str(conv.tenant_id)
        await _publish_conv_updated(
            tenant_str, conversation_id, handler="agent", assigned_agent_id=str(agent_id)
        )
    return {"assigned_agent_id": str(agent_id), "handler": "agent"}
