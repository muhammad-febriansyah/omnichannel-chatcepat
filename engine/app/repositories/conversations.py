from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from ..models import Conversation
from ..rbac import can_view_all_conversations


def apply_visibility(stmt: Select, role: str | None, user_id) -> Select:
    """Scope data: agent hanya lihat percakapan yg di-assign ke dia (docs/prd/03)."""
    if not can_view_all_conversations(role):
        stmt = stmt.where(Conversation.assigned_agent_id == user_id)
    return stmt


async def get_or_create_active(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> Conversation:
    """Percakapan aktif (status != resolved) per (channel, contact) — uq_conv_open."""
    existing = await session.scalar(
        select(Conversation).where(
            Conversation.channel_id == channel_id,
            Conversation.contact_id == contact_id,
            Conversation.status != "resolved",
        )
    )
    if existing is not None:
        return existing

    conv = Conversation(
        tenant_id=tenant_id,
        channel_id=channel_id,
        contact_id=contact_id,
        status="open",
        handler="bot",
        unread_count=0,
    )
    session.add(conv)
    await session.flush()
    return conv


async def get_with_state(
    session: AsyncSession, conversation_id: uuid.UUID
) -> Conversation | None:
    """Conversation + state + relasi (eager) untuk decision pipeline. Zero N+1."""
    return await session.scalar(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            joinedload(Conversation.channel),
            joinedload(Conversation.contact),
            selectinload(Conversation.state),
        )
    )
