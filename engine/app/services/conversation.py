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
    conversation_id: uuid.UUID, body: str, agent_id: uuid.UUID | None = None
) -> dict:
    """Agen balas → takeover (handler=agent), persist message, publish outbound + realtime."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            conv = await conversations.get_with_state(session, conversation_id)
            if conv is None:
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
