from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Message

# Urutan status — cegah downgrade saat event datang tak berurutan (read→delivered).
_STATUS_RANK = {"queued": 0, "sent": 1, "delivered": 2, "read": 3}


async def apply_status(
    session: AsyncSession,
    *,
    idempotency_key: str | None,
    provider_message_id: str | None,
    status: str,
) -> Message | None:
    """Terapkan status pengiriman ke pesan outbound (05). Match by idempotency_key
    dulu (event 'sent' dari gateway), lalu provider_message_id (delivered/read dari
    webhook). 'failed' selalu menang; selain itu hanya naik peringkat. Return msg/None.
    """
    msg: Message | None = None
    if idempotency_key:
        msg = await session.scalar(
            select(Message).where(Message.idempotency_key == idempotency_key)
        )
    if msg is None and provider_message_id:
        msg = await session.scalar(
            select(Message).where(Message.provider_message_id == provider_message_id)
        )
    if msg is None:
        return None

    # Simpan provider_message_id dari event 'sent' supaya delivered/read bisa match.
    if provider_message_id and not msg.provider_message_id:
        msg.provider_message_id = provider_message_id

    if status == "failed":
        msg.status = "failed"
    elif msg.status != "failed" and _STATUS_RANK.get(status, 0) > _STATUS_RANK.get(msg.status, 0):
        msg.status = status
    return msg


async def count_inbound(session: AsyncSession, conversation_id: uuid.UUID) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.direction == "inbound",
        )
    ) or 0


async def exists_provider(
    session: AsyncSession, channel_id: uuid.UUID, provider_message_id: str | None
) -> bool:
    """Cek dedup (uq_msg_provider). provider_message_id NULL → anggap belum ada."""
    if not provider_message_id:
        return False
    found = await session.scalar(
        select(Message.id).where(
            Message.channel_id == channel_id,
            Message.provider_message_id == provider_message_id,
        )
    )
    return found is not None


async def recent_turns(
    session: AsyncSession, conversation_id: uuid.UUID, limit: int
) -> list[Message]:
    """`limit` pesan terakhir (ada body) urut lama→baru, untuk memori AI (06).

    Termasuk pesan inbound terkini (sudah di-persist sebelum decide). Pemanggil
    yang melampirkan query terpisah harus membuang turn terakhir bila duplikat.
    """
    rows = await session.scalars(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.body.isnot(None),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return list(reversed(list(rows)))


async def add_inbound(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    channel_id: uuid.UUID,
    msg_type: str,
    body: str | None,
    media: dict | None,
    provider_message_id: str | None,
) -> Message:
    msg = Message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        channel_id=channel_id,
        direction="inbound",
        sender="contact",
        type=msg_type,
        body=body,
        media=media,
        provider_message_id=provider_message_id,
        status="delivered",
    )
    session.add(msg)
    await session.flush()
    return msg


async def add_outbound(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    channel_id: uuid.UUID,
    sender: str,
    body: str | None,
    idempotency_key: str,
    agent_id: uuid.UUID | None = None,
    msg_type: str = "text",
) -> Message:
    msg = Message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        channel_id=channel_id,
        direction="outbound",
        sender=sender,
        agent_id=agent_id,
        type=msg_type,
        body=body,
        idempotency_key=idempotency_key,
        status="queued",
    )
    session.add(msg)
    await session.flush()
    return msg
