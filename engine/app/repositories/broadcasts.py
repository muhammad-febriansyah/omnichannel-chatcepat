from __future__ import annotations

import uuid

from datetime import datetime, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..models import Broadcast, BroadcastRecipient, Contact


async def get(session: AsyncSession, broadcast_id: uuid.UUID, *, lock: bool = False) -> Broadcast | None:
    stmt = select(Broadcast).where(Broadcast.id == broadcast_id)
    if lock:
        stmt = stmt.with_for_update()
    return await session.scalar(stmt)


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


# Recipients that count against the monthly broadcast quota: already sent/delivered,
# plus still queued in a running broadcast. Same month boundary as the web (UTC).
QUOTA_STATUSES = ("pending", "sent", "delivered")


async def month_usage(session: AsyncSession, tenant_id: uuid.UUID) -> int:
    start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return int(
        await session.scalar(
            select(func.count())
            .select_from(BroadcastRecipient)
            .where(
                BroadcastRecipient.tenant_id == tenant_id,
                BroadcastRecipient.status.in_(QUOTA_STATUSES),
                BroadcastRecipient.created_at >= start,
            )
        )
        or 0
    )


async def lock_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Serialize quota checks of one tenant (two broadcasts starting together)."""
    await session.execute(text("SELECT 1 FROM tenants WHERE id = :t FOR UPDATE"), {"t": tenant_id})


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


async def due_scheduled(session: AsyncSession, now, limit: int = 20) -> list[Broadcast]:
    """Scheduled broadcasts whose send time has come (all tenants; worker only)."""
    res = await session.scalars(
        select(Broadcast)
        .where(Broadcast.status == "scheduled", Broadcast.scheduled_at <= now)
        .order_by(Broadcast.scheduled_at)
        .limit(limit)
    )
    return list(res)


async def mark_failed(session: AsyncSession, broadcast_id: uuid.UUID, error: str) -> None:
    b = await get(session, broadcast_id, lock=True)
    if b is not None and b.status == "scheduled":
        b.status = "failed"
        b.stats = {**(b.stats or {}), "error": error[:300]}


def parse_click_payload(payload: str | None) -> tuple[uuid.UUID, int] | None:
    """Payload tombol broadcast = "bc:<broadcast_id>:<button_index>"."""
    if not payload or not payload.startswith("bc:"):
        return None
    parts = payload.split(":")
    if len(parts) != 3:
        return None
    try:
        return uuid.UUID(parts[1]), int(parts[2])
    except ValueError:
        return None


async def record_click(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    contact_id: uuid.UUID,
    label: str,
    at,
) -> bool:
    """Simpan tombol pertama yang diklik penerima. Klik ulang tidak menimpa (laporan
    menghitung keputusan awal). Return True bila ada baris yang tercatat."""
    res = await session.execute(
        update(BroadcastRecipient)
        .where(
            BroadcastRecipient.tenant_id == tenant_id,
            BroadcastRecipient.broadcast_id == broadcast_id,
            BroadcastRecipient.contact_id == contact_id,
            BroadcastRecipient.clicked_button.is_(None),
        )
        .values(clicked_button=label[:200], clicked_at=at)
    )
    return (res.rowcount or 0) > 0
