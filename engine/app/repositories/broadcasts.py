from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..models import Broadcast, BroadcastRecipient, Contact


async def get(session: AsyncSession, broadcast_id: uuid.UUID) -> Broadcast | None:
    return await session.scalar(select(Broadcast).where(Broadcast.id == broadcast_id))


async def match_contacts(
    session: AsyncSession, tenant_id: uuid.UUID, audience_filter: dict
) -> list[Contact]:
    """Kontak yang cocok filter (tags overlap, attributes contains). TANPA filter opt_in
    di sini — partisi opt_in dilakukan di service supaya opted_out tercatat skipped.
    """
    stmt = select(Contact).where(Contact.tenant_id == tenant_id)
    tags = (audience_filter or {}).get("tags")
    if tags:
        stmt = stmt.where(Contact.tags.overlap(tags))
    attrs = (audience_filter or {}).get("attributes")
    if attrs:
        stmt = stmt.where(Contact.attributes.contains(attrs))
    res = await session.scalars(stmt)
    return list(res)


async def add_recipient(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    contact_id: uuid.UUID,
    status: str,
) -> BroadcastRecipient:
    r = BroadcastRecipient(
        tenant_id=tenant_id,
        broadcast_id=broadcast_id,
        contact_id=contact_id,
        status=status,
    )
    session.add(r)
    return r


async def pending_recipients(
    session: AsyncSession, broadcast_id: uuid.UUID, limit: int
) -> list[BroadcastRecipient]:
    """Batch penerima pending + kontak (eager). Index idx_bcast_recip."""
    res = await session.scalars(
        select(BroadcastRecipient)
        .where(
            BroadcastRecipient.broadcast_id == broadcast_id,
            BroadcastRecipient.status == "pending",
        )
        .options(joinedload(BroadcastRecipient.contact))
        .limit(limit)
    )
    return list(res)


async def count_pending(session: AsyncSession, broadcast_id: uuid.UUID) -> int:
    from sqlalchemy import func

    return await session.scalar(
        select(func.count())
        .select_from(BroadcastRecipient)
        .where(
            BroadcastRecipient.broadcast_id == broadcast_id,
            BroadcastRecipient.status == "pending",
        )
    ) or 0


async def set_status(
    session: AsyncSession, broadcast_id: uuid.UUID, status: str, stats: dict | None = None
) -> None:
    values: dict = {"status": status}
    if stats is not None:
        values["stats"] = stats
    await session.execute(
        update(Broadcast).where(Broadcast.id == broadcast_id).values(**values)
    )


async def running_broadcasts(session: AsyncSession, limit: int = 20) -> list[Broadcast]:
    res = await session.scalars(
        select(Broadcast).where(Broadcast.status == "running").limit(limit)
    )
    return list(res)
