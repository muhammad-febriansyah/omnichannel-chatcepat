"""Aksi percakapan dari agen (web → engine). Web tak menulis tabel domain (01),
jadi balas/takeover lewat engine. docs/prd/05."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from ..bus import publish_outbound, publish_realtime
from ..contracts.events import OutboundCommand, Party
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal
from ..repositories import conversations, messages


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
