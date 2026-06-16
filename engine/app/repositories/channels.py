from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Channel


async def get_by_id(session: AsyncSession, channel_id: uuid.UUID) -> Channel | None:
    """Lookup channel dari event gateway (channel_id tepercaya). tenant_id ada di row."""
    return await session.scalar(select(Channel).where(Channel.id == channel_id))
