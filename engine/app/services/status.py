"""Terapkan event message.status (sent/delivered/read/failed) ke pesan + realtime (05)."""

from __future__ import annotations

import json

from ..bus import publish_realtime
from ..contracts.events import MessageStatus
from ..db import AsyncSessionLocal
from ..repositories import messages as messages_repo


async def apply_status_event(st: MessageStatus) -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            msg = await messages_repo.apply_status(
                session,
                idempotency_key=st.idempotency_key or None,
                provider_message_id=st.provider_message_id,
                status=st.status.value if hasattr(st.status, "value") else str(st.status),
            )
            if msg is None:
                return  # pesan tak ditemukan (mis. status untuk pesan tenant lain / lama)
            tenant_str = str(msg.tenant_id)
            payload = {
                "type": "message.status",
                "payload": {
                    "conversation_id": str(msg.conversation_id),
                    "message_id": str(msg.id),
                    "status": msg.status,
                },
            }
    await publish_realtime(tenant_str, json.dumps(payload))
