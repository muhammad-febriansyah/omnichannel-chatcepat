from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ConversationState


async def get(session: AsyncSession, conversation_id: uuid.UUID) -> ConversationState | None:
    return await session.scalar(
        select(ConversationState).where(
            ConversationState.conversation_id == conversation_id
        )
    )


async def upsert(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    flow_id: uuid.UUID | None,
    current_node_id: str | None,
    context: dict,
    expires_at: datetime,
) -> ConversationState:
    state = await get(session, conversation_id)
    if state is None:
        state = ConversationState(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            flow_id=flow_id,
            current_node_id=current_node_id,
            context=context,
            expires_at=expires_at,
        )
        session.add(state)
    else:
        state.flow_id = flow_id
        state.current_node_id = current_node_id
        state.context = context
        state.expires_at = expires_at
    await session.flush()
    return state


async def delete(session: AsyncSession, conversation_id: uuid.UUID) -> None:
    state = await get(session, conversation_id)
    if state is not None:
        await session.delete(state)
        await session.flush()
